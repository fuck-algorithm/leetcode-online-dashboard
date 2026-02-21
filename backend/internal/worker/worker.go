package worker

import (
	"encoding/json"
	"fmt"
	"leetcode-dashboard/internal/cache"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
	"leetcode-dashboard/internal/websocket"
	"log"
	"sync"
	"time"
)

// Worker manages WebSocket subscriptions for problems
type Worker struct {
	clients   map[string]*websocket.LeetCodeWSClient
	problems  []string
	mu        sync.RWMutex
	stopChan  chan struct{}
	batchSize int
	interval  time.Duration
	hub       *websocket.Hub // WebSocket hub for broadcasting to frontend
}

// NewWorker creates a new worker instance
func NewWorker(problems []string, batchSize int, interval time.Duration, hub *websocket.Hub) *Worker {
	return &Worker{
		clients:   make(map[string]*websocket.LeetCodeWSClient),
		problems:  problems,
		stopChan:  make(chan struct{}),
		batchSize: batchSize,
		interval:  interval,
		hub:       hub,
	}
}

// Start begins the background worker
func (w *Worker) Start() {
	log.Printf("Starting worker for %d problems", len(w.problems))

	// Start minute-level persistence goroutine
	go w.persistenceWorker()

	// Start real-time broadcaster
	go w.broadcastWorker()

	// Process problems in batches
	go w.processBatches()
}

// persistenceWorker handles minute-level persistence to SQLite
// Reads from memory cache once per minute, ensuring one record per problem per minute
func (w *Worker) persistenceWorker() {
	minuteTicker := time.NewTicker(time.Minute)
	defer minuteTicker.Stop()

	for {
		select {
		case <-w.stopChan:
			return
		case <-minuteTicker.C:
			w.persistFromCache()
		}
	}
}

// persistFromCache reads current state from memory cache and persists to database
func (w *Worker) persistFromCache() {
	statuses := cache.GetCache().GetAll()
	if len(statuses) == 0 {
		return
	}

	db := database.GetDB()
	if db == nil {
		return
	}

	now := time.Now()
	batch := make([]*models.OnlineCount, 0, len(statuses))

	for _, s := range statuses {
		batch = append(batch, &models.OnlineCount{
			FrontendID: s.FrontendID,
			Count:      s.OnlineCount,
			Timestamp:  now,
		})
	}

	// Use transaction for batch insert
	tx := db.Begin()
	for _, count := range batch {
		if err := tx.Create(count).Error; err != nil {
			log.Printf("Failed to persist online count: %v", err)
		}
	}
	if err := tx.Commit().Error; err != nil {
		log.Printf("Failed to commit batch: %v", err)
		tx.Rollback()
	} else {
		log.Printf("Persisted %d online count records (minute snapshot)", len(batch))
	}
}

// broadcastWorker periodically broadcasts batch updates to frontend
func (w *Worker) broadcastWorker() {
	ticker := time.NewTicker(5 * time.Second) // Broadcast every 5 seconds
	defer ticker.Stop()

	for {
		select {
		case <-w.stopChan:
			return
		case <-ticker.C:
			w.broadcastBatchUpdate()
		}
	}
}

// broadcastBatchUpdate sends current status to all WebSocket clients (Hot 100 only)
func (w *Worker) broadcastBatchUpdate() {
	if w.hub == nil {
		return
	}

	// Only get Hot 100 problems, not all problems
	statuses := cache.GetCache().GetHot100(w.problems)
	if len(statuses) == 0 {
		return
	}

	problems := make([]map[string]interface{}, 0, len(statuses))
	total := 0

	for _, s := range statuses {
		problems = append(problems, map[string]interface{}{
			"frontend_id":  s.FrontendID,
			"slug":         s.Slug,
			"title":        s.Title,
			"title_cn":     s.TitleCn,
			"difficulty":   s.Difficulty,
			"paid_only":    s.PaidOnly,
			"topic_tags":   s.TopicTags,
			"online_count": s.OnlineCount,
			"last_updated": s.LastUpdated.Unix(),
		})
		total += s.OnlineCount
	}

	w.hub.BroadcastBatchUpdate(problems)
}

// Stop terminates all WebSocket connections
func (w *Worker) Stop() {
	close(w.stopChan)

	w.mu.Lock()
	defer w.mu.Unlock()

	for slug, client := range w.clients {
		log.Printf("Closing connection for %s", slug)
		client.Close()
	}
}

// processBatches processes problems in batches to avoid overwhelming the server
func (w *Worker) processBatches() {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	batchIndex := 0
	totalBatches := (len(w.problems) + w.batchSize - 1) / w.batchSize

	// Process first batch immediately
	w.processBatch(batchIndex, totalBatches)
	batchIndex++

	for {
		select {
		case <-w.stopChan:
			return
		case <-ticker.C:
			w.processBatch(batchIndex, totalBatches)
			batchIndex++
			if batchIndex >= totalBatches {
				batchIndex = 0 // Restart from beginning
			}
		}
	}
}

// processBatch processes a single batch of problems
func (w *Worker) processBatch(batchIndex, totalBatches int) {
	start := batchIndex * w.batchSize
	end := start + w.batchSize
	if end > len(w.problems) {
		end = len(w.problems)
	}

	batch := w.problems[start:end]
	log.Printf("Processing batch %d/%d (%d problems)", batchIndex+1, totalBatches, len(batch))

	for _, slug := range batch {
		go w.subscribeToProblem(slug)
	}
}

// subscribeToProblem creates and manages a WebSocket connection for a problem
func (w *Worker) subscribeToProblem(slug string) {
	w.mu.RLock()
	existing, ok := w.clients[slug]
	w.mu.RUnlock()

	// If already connected, skip
	if ok && existing.IsConnected() {
		return
	}

	// Create new client
	client := websocket.NewLeetCodeWSClient(slug,
		func(data []byte) {
			w.handleMessage(slug, data)
		},
		func(err error) {
			log.Printf("WebSocket error for %s: %v", slug, err)
			// Trigger reconnection
			go func() {
				time.Sleep(5 * time.Second)
				w.subscribeToProblem(slug)
			}()
		},
	)

	if err := client.Connect(); err != nil {
		log.Printf("Failed to connect to %s: %v", slug, err)
		return
	}

	w.mu.Lock()
	w.clients[slug] = client
	w.mu.Unlock()

	log.Printf("Connected to %s", slug)
}

// handleMessage processes incoming WebSocket messages
// LeetCode sends plain text numbers like "44" representing online count
func (w *Worker) handleMessage(slug string, data []byte) {
	// Try to parse as plain number first (LeetCode format)
	var count int
	if _, err := fmt.Sscanf(string(data), "%d", &count); err == nil {
		w.saveOnlineCount(slug, count)
		log.Printf("[%s] Online count: %d", slug, count)
		return
	}

	// Fallback: try JSON format (in case format changes)
	var msg struct {
		Type  string `json:"type"`
		Count int    `json:"count"`
		Data  struct {
			Count int `json:"count"`
		} `json:"data"`
	}

	if err := json.Unmarshal(data, &msg); err == nil {
		if msg.Count > 0 {
			w.saveOnlineCount(slug, msg.Count)
			log.Printf("[%s] Online count from JSON: %d", slug, msg.Count)
		} else if msg.Data.Count > 0 {
			w.saveOnlineCount(slug, msg.Data.Count)
			log.Printf("[%s] Online count from JSON data: %d", slug, msg.Data.Count)
		}
		return
	}

	// Log unrecognized message format for debugging
	log.Printf("[%s] Unrecognized message format: %s", slug, string(data))
}

// saveOnlineCount updates memory cache only (persistence is handled by persistenceWorker)
func (w *Worker) saveOnlineCount(slug string, count int) {
	db := database.GetDB()
	if db == nil {
		return
	}

	// Find or create problem
	var problem models.Problem
	result := db.Where("slug = ?", slug).First(&problem)
	if result.Error != nil {
		problem = models.Problem{Slug: slug}
		if err := db.Create(&problem).Error; err != nil {
			log.Printf("Failed to create problem %s: %v", slug, err)
			return
		}
	}

	// Update memory cache (real-time only, no persistence here)
	// Parse Tags JSON string to []string
	var topicTags []string
	if problem.Tags != "" {
		json.Unmarshal([]byte(problem.Tags), &topicTags)
	}
	cache.GetCache().Update(slug, count, problem.FrontendID, problem.Title, problem.TitleCn, problem.Difficulty, problem.PaidOnly, topicTags)

	// Broadcast immediate update to WebSocket clients
	if w.hub != nil {
		w.hub.BroadcastStatusUpdate(slug, count, cache.GetCache().GetTotalOnline())
	}
}

// GetConnectionStatus returns the status of all connections
func (w *Worker) GetConnectionStatus() map[string]bool {
	w.mu.RLock()
	defer w.mu.RUnlock()

	status := make(map[string]bool)
	for slug, client := range w.clients {
		status[slug] = client.IsConnected()
	}
	return status
}
