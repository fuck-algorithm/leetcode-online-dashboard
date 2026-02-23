package worker

import (
	"encoding/json"
	"leetcode-dashboard/internal/cache"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
	"leetcode-dashboard/internal/redis"
	"leetcode-dashboard/internal/websocket"
	"log"
	"time"

	"gorm.io/gorm"
)

// Worker manages data broadcasting and persistence from Redis
// Note: WebSocket crawling is now handled by the dedicated crawler service
type Worker struct {
	problems  []string
	stopChan  chan struct{}
	batchSize int
	interval  time.Duration
	hub       *websocket.Hub // WebSocket hub for broadcasting to frontend
}

// NewWorker creates a new worker instance
func NewWorker(problems []string, batchSize int, interval time.Duration, hub *websocket.Hub) *Worker {
	return &Worker{
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
}

// persistenceWorker handles minute-level persistence from cache to MySQL
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

// persistFromCache reads current state from cache and persists to database (dual-site)
func (w *Worker) persistFromCache() {
	// Get CN site data
	cnStatuses, err := redis.GetAllOnlineCountsBySite("cn")
	if err != nil {
		log.Printf("Failed to get CN online counts: %v", err)
	}

	// Get COM site data
	comStatuses, err := redis.GetAllOnlineCountsBySite("com")
	if err != nil {
		log.Printf("Failed to get COM online counts: %v", err)
	}

	if len(cnStatuses) == 0 && len(comStatuses) == 0 {
		return
	}

	db := database.GetDB()
	if db == nil {
		return
	}

	now := time.Now()
	totalCN := 0
	totalCOM := 0

	// Persist CN site data
	for _, s := range cnStatuses {
		if s.FrontendID == "" {
			continue
		}
		record := &models.OnlineCountCN{
			FrontendID: s.FrontendID,
			Count:      s.OnlineCount,
			Timestamp:  now,
		}
		if err := db.Create(record).Error; err != nil {
			log.Printf("Failed to persist CN online count for %s: %v", s.FrontendID, err)
		}
		totalCN += s.OnlineCount
	}

	// Persist COM site data
	for _, s := range comStatuses {
		if s.FrontendID == "" {
			continue
		}
		record := &models.OnlineCountCOM{
			FrontendID: s.FrontendID,
			Count:      s.OnlineCount,
			Timestamp:  now,
		}
		if err := db.Create(record).Error; err != nil {
			log.Printf("Failed to persist COM online count for %s: %v", s.FrontendID, err)
		}
		totalCOM += s.OnlineCount
	}

	// Persist unified data (sum of CN + COM for each problem)
	w.persistUnifiedData(db, cnStatuses, comStatuses, now)

	// Persist total online aggregates
	w.persistTotalOnlineAggregate(totalCN, totalCOM, now)

	log.Printf("Persisted %d CN + %d COM records", len(cnStatuses), len(comStatuses))
}

// persistUnifiedData creates unified records combining CN and COM data
func (w *Worker) persistUnifiedData(db *gorm.DB, cnStatuses, comStatuses []*redis.ProblemOnlineStatus, timestamp time.Time) {
	// Create a map to track which problems we've processed
	processed := make(map[string]bool)

	// Process CN data
	for _, s := range cnStatuses {
		if s.FrontendID == "" {
			continue
		}
		
		// Find matching COM data
		comCount := 0
		for _, com := range comStatuses {
			if com.FrontendID == s.FrontendID {
				comCount = com.OnlineCount
				break
			}
		}

		record := &models.OnlineCountUnified{
			FrontendID: s.FrontendID,
			CountCN:    s.OnlineCount,
			CountCOM:   comCount,
			CountTotal: s.OnlineCount + comCount,
			Timestamp:  timestamp,
		}
		if err := db.Create(record).Error; err != nil {
			log.Printf("Failed to persist unified online count for %s: %v", s.FrontendID, err)
		}
		processed[s.FrontendID] = true
	}

	// Process remaining COM-only data
	for _, s := range comStatuses {
		if s.FrontendID == "" || processed[s.FrontendID] {
			continue
		}
		
		record := &models.OnlineCountUnified{
			FrontendID: s.FrontendID,
			CountCN:    0,
			CountCOM:   s.OnlineCount,
			CountTotal: s.OnlineCount,
			Timestamp:  timestamp,
		}
		if err := db.Create(record).Error; err != nil {
			log.Printf("Failed to persist unified online count for %s: %v", s.FrontendID, err)
		}
	}
}

// persistTotalOnlineAggregate stores the total online count to the aggregate tables
func (w *Worker) persistTotalOnlineAggregate(totalCN, totalCOM int, timestamp time.Time) {
	db := database.GetDB()
	if db == nil {
		return
	}

	now := time.Now()
	minuteBucket := now.Truncate(time.Minute)
	hourBucket := now.Truncate(time.Hour)
	dayBucket := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// Save CN aggregate
	cnAgg := &models.TotalOnlineAggregateCN{
		Timestamp:  minuteBucket,
		Total:      totalCN,
		HourBucket: hourBucket,
		DayBucket:  dayBucket,
	}
	if err := db.Where("timestamp = ?", minuteBucket).Assign(cnAgg).FirstOrCreate(&models.TotalOnlineAggregateCN{}).Error; err != nil {
		db.Model(&models.TotalOnlineAggregateCN{}).Where("timestamp = ?", minuteBucket).Update("total", totalCN)
	}

	// Save COM aggregate
	comAgg := &models.TotalOnlineAggregateCOM{
		Timestamp:  minuteBucket,
		Total:      totalCOM,
		HourBucket: hourBucket,
		DayBucket:  dayBucket,
	}
	if err := db.Where("timestamp = ?", minuteBucket).Assign(comAgg).FirstOrCreate(&models.TotalOnlineAggregateCOM{}).Error; err != nil {
		db.Model(&models.TotalOnlineAggregateCOM{}).Where("timestamp = ?", minuteBucket).Update("total", totalCOM)
	}

	// Save unified aggregate
	unifiedAgg := &models.TotalOnlineAggregateUnified{
		Timestamp:  minuteBucket,
		TotalCN:    totalCN,
		TotalCOM:   totalCOM,
		Total:      totalCN + totalCOM,
		HourBucket: hourBucket,
		DayBucket:  dayBucket,
	}
	if err := db.Where("timestamp = ?", minuteBucket).Assign(unifiedAgg).FirstOrCreate(&models.TotalOnlineAggregateUnified{}).Error; err != nil {
		db.Model(&models.TotalOnlineAggregateUnified{}).Where("timestamp = ?", minuteBucket).Updates(map[string]interface{}{
			"total_cn":  totalCN,
			"total_com": totalCOM,
			"total":     totalCN + totalCOM,
		})
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
// 优先从 Redis 读取三列数据，Redis 不可用时回退到数据库
func (w *Worker) broadcastBatchUpdate() {
	if w.hub == nil {
		return
	}

	problems := make([]map[string]interface{}, 0, len(w.problems))
	total := 0

	for _, slug := range w.problems {
		// 优先从 Redis 读取 CN/COM 数据
		cnStatus, _ := redis.GetOnlineCountBySite(slug, "cn")
		comStatus, _ := redis.GetOnlineCountBySite(slug, "com")

		countCN := 0
		countCOM := 0
		frontendID := ""
		title := ""
		titleCn := ""
		difficulty := "Medium"
		paidOnly := false
		var topicTags []string
		lastUpdated := time.Now()

		if cnStatus != nil {
			countCN = cnStatus.OnlineCount
			frontendID = cnStatus.FrontendID
			title = cnStatus.Title
			titleCn = cnStatus.TitleCn
			difficulty = cnStatus.Difficulty
			paidOnly = cnStatus.PaidOnly
			topicTags = cnStatus.TopicTags
			lastUpdated = cnStatus.LastUpdated
		}

		if comStatus != nil {
			countCOM = comStatus.OnlineCount
			// 如果 CN 没有元数据，使用 COM 的
			if frontendID == "" {
				frontendID = comStatus.FrontendID
				title = comStatus.Title
				titleCn = comStatus.TitleCn
				difficulty = comStatus.Difficulty
				paidOnly = comStatus.PaidOnly
				topicTags = comStatus.TopicTags
				lastUpdated = comStatus.LastUpdated
			}
		}

		// Redis 没有数据时，从内存缓存或数据库兜底
		if countCN == 0 && countCOM == 0 {
			if cached, ok := cache.GetCache().Get(slug); ok && cached.OnlineCount > 0 {
				// 使用缓存的汇总数据（旧版本兼容）
				countCN = cached.OnlineCountCN
				countCOM = cached.OnlineCountCOM
				frontendID = cached.FrontendID
				title = cached.Title
				titleCn = cached.TitleCn
				difficulty = cached.Difficulty
				paidOnly = cached.PaidOnly
				topicTags = cached.TopicTags
				lastUpdated = cached.LastUpdated
			} else {
				// 从数据库兜底
				db := database.GetDB()
				if db != nil {
					var problem models.Problem
					if err := db.Where("slug = ?", slug).First(&problem).Error; err == nil {
						frontendID = problem.FrontendID
						title = problem.Title
						titleCn = problem.TitleCn
						difficulty = problem.Difficulty
						paidOnly = problem.PaidOnly
						if problem.Tags != "" {
							json.Unmarshal([]byte(problem.Tags), &topicTags)
						}
					}
				}
			}
		}

		countTotal := countCN + countCOM
		problems = append(problems, map[string]interface{}{
			"frontend_id":        frontendID,
			"slug":               slug,
			"title":              title,
			"title_cn":           titleCn,
			"difficulty":         difficulty,
			"paid_only":          paidOnly,
			"topic_tags":         topicTags,
			"online_count":       countTotal,
			"online_count_cn":    countCN,
			"online_count_com":   countCOM,
			"online_count_total": countTotal,
			"last_updated":       lastUpdated.Unix(),
		})
		total += countTotal
	}

	w.hub.BroadcastBatchUpdate(problems)
}

// loadLatestFromDB loads the latest online count data from database for all problems
// Combines CN + COM data for display
func (w *Worker) loadLatestFromDB() []*cache.ProblemStatus {
	db := database.GetDB()
	if db == nil {
		return nil
	}

	var results []*cache.ProblemStatus

	for _, slug := range w.problems {
		var problem models.Problem
		if err := db.Where("slug = ?", slug).First(&problem).Error; err != nil {
			continue
		}

		// Get latest unified online count (combines CN + COM)
		var latestCount models.OnlineCountUnified
		err := db.Where("frontend_id = ?", problem.FrontendID).
			Order("timestamp DESC").
			First(&latestCount).Error

		count := 0
		countCN := 0
		countCOM := 0
		if err == nil {
			count = latestCount.CountTotal
			countCN = latestCount.CountCN
			countCOM = latestCount.CountCOM
		}

		// Parse Tags JSON string to []string
		var topicTags []string
		if problem.Tags != "" {
			json.Unmarshal([]byte(problem.Tags), &topicTags)
		}

		results = append(results, &cache.ProblemStatus{
			FrontendID:     problem.FrontendID,
			Slug:           problem.Slug,
			Title:          problem.Title,
			TitleCn:        problem.TitleCn,
			Difficulty:     problem.Difficulty,
			PaidOnly:       problem.PaidOnly,
			TopicTags:      topicTags,
			OnlineCount:    count,
			OnlineCountCN:  countCN,
			OnlineCountCOM: countCOM,
			LastUpdated:    latestCount.Timestamp,
		})
	}

	if len(results) > 0 {
		log.Printf("Loaded %d problems from database for broadcast", len(results))
	}

	return results
}

// Stop terminates the worker
func (w *Worker) Stop() {
	close(w.stopChan)
}

// GetConnectionStatus returns dummy status (crawler handles actual connections)
func (w *Worker) GetConnectionStatus() map[string]bool {
	return make(map[string]bool)
}
