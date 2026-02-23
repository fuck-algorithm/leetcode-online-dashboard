package crawler

import (
	"log"
	"time"

	"leetcode-dashboard/internal/websocket"
)

// Batcher handles batch processing of problems
type Batcher struct {
	manager   *Manager
	processor *MessageProcessor
	interval  time.Duration
	stopChan  chan struct{}
}

// NewBatcher creates a new batch processor
func NewBatcher(manager *Manager, processor *MessageProcessor, interval time.Duration) *Batcher {
	return &Batcher{
		manager:   manager,
		processor: processor,
		interval:  interval,
		stopChan:  make(chan struct{}),
	}
}

// Start begins the batch processing loop
func (b *Batcher) Start() {
	go b.processBatches()
}

// Stop stops the batch processing
func (b *Batcher) Stop() {
	close(b.stopChan)
}

// processBatches processes problems in batches
func (b *Batcher) processBatches() {
	ticker := time.NewTicker(b.interval)
	defer ticker.Stop()

	batchIndex := 0
	problems := b.manager.GetProblems()
	batchSize := b.manager.GetBatchSize()
	totalBatches := (len(problems) + batchSize - 1) / batchSize

	// Process first batch immediately
	b.processBatch(batchIndex, totalBatches, problems, batchSize)
	batchIndex++

	for {
		select {
		case <-b.stopChan:
			return
		case <-ticker.C:
			b.processBatch(batchIndex, totalBatches, problems, batchSize)
			batchIndex++
			if batchIndex >= totalBatches {
				batchIndex = 0
			}
		}
	}
}

// processBatch processes a single batch
func (b *Batcher) processBatch(batchIndex, totalBatches int, problems []string, batchSize int) {
	start := batchIndex * batchSize
	end := start + batchSize
	if end > len(problems) {
		end = len(problems)
	}

	batch := problems[start:end]
	log.Printf("Processing batch %d/%d (%d problems) for both CN and COM sites", batchIndex+1, totalBatches, len(batch))

	for _, slug := range batch {
		// Subscribe to both CN and COM sites
		go b.subscribeToProblem(slug, websocket.SiteCN)
		go b.subscribeToProblem(slug, websocket.SiteCOM)
	}
}

// subscribeToProblem creates a WebSocket connection for a problem
func (b *Batcher) subscribeToProblem(slug string, site websocket.SiteType) {
	// Check if already connected
	if existing, ok := b.manager.GetClient(slug, site); ok && existing.IsConnected() {
		return
	}

	// Create new client
	client := websocket.NewLeetCodeWSClient(slug, site,
		func(data []byte) {
			b.processor.ProcessMessage(slug, site, data)
		},
		func(err error) {
			log.Printf("WebSocket error for %s [%s]: %v", slug, site, err)
			// Trigger reconnection
			go func() {
				time.Sleep(5 * time.Second)
				b.subscribeToProblem(slug, site)
			}()
		},
	)

	if err := client.Connect(); err != nil {
		log.Printf("Failed to connect to %s [%s]: %v", slug, site, err)
		return
	}

	b.manager.SetClient(slug, site, client)
	log.Printf("Connected to %s [%s]", slug, site)
}
