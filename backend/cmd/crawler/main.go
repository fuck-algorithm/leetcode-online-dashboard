package main

import (
	"encoding/json"
	"fmt"
	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
	"leetcode-dashboard/internal/redis"
	"leetcode-dashboard/internal/websocket"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// ClientKey represents a unique key for a problem-site combination
type ClientKey struct {
	Slug string
	Site websocket.SiteType
}

// String returns the string representation of the key
func (k ClientKey) String() string {
	return k.Slug + "-" + string(k.Site)
}

// Crawler 爬虫管理器 - 支持双站点 (leetcode.cn + leetcode.com)
type Crawler struct {
	clients   map[ClientKey]*websocket.LeetCodeWSClient
	problems  []string
	mu        sync.RWMutex
	stopChan  chan struct{}
	batchSize int
	interval  time.Duration
}

// NewCrawler 创建新的爬虫实例 - 支持双站点
func NewCrawler(problems []string, batchSize int, interval time.Duration) *Crawler {
	return &Crawler{
		clients:   make(map[ClientKey]*websocket.LeetCodeWSClient),
		problems:  problems,
		stopChan:  make(chan struct{}),
		batchSize: batchSize,
		interval:  interval,
	}
}

// Start 启动爬虫
func (c *Crawler) Start() {
	log.Printf("Starting crawler for %d problems", len(c.problems))

	// 启动批量处理
	go c.processBatches()

	// 启动定时更新总在线人数
	go c.updateTotalOnline()
}

// Stop 停止爬虫
func (c *Crawler) Stop() {
	close(c.stopChan)

	c.mu.Lock()
	defer c.mu.Unlock()

	for key, client := range c.clients {
		log.Printf("Closing connection for %s [%s]", key.Slug, key.Site)
		client.Close()
	}
}

// processBatches 批量处理题目
func (c *Crawler) processBatches() {
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	batchIndex := 0
	totalBatches := (len(c.problems) + c.batchSize - 1) / c.batchSize

	// 立即处理第一批
	c.processBatch(batchIndex, totalBatches)
	batchIndex++

	for {
		select {
		case <-c.stopChan:
			return
		case <-ticker.C:
			c.processBatch(batchIndex, totalBatches)
			batchIndex++
			if batchIndex >= totalBatches {
				batchIndex = 0
			}
		}
	}
}

// processBatch 处理单个批次 - 同时订阅CN和COM两个站点
func (c *Crawler) processBatch(batchIndex, totalBatches int) {
	start := batchIndex * c.batchSize
	end := start + c.batchSize
	if end > len(c.problems) {
		end = len(c.problems)
	}

	batch := c.problems[start:end]
	log.Printf("Processing batch %d/%d (%d problems) for both CN and COM sites", batchIndex+1, totalBatches, len(batch))

	for _, slug := range batch {
		// 同时订阅CN和COM两个站点
		go c.subscribeToProblem(slug, websocket.SiteCN)
		go c.subscribeToProblem(slug, websocket.SiteCOM)
	}
}

// subscribeToProblem 订阅指定站点的题目
func (c *Crawler) subscribeToProblem(slug string, site websocket.SiteType) {
	key := ClientKey{Slug: slug, Site: site}

	c.mu.RLock()
	existing, ok := c.clients[key]
	c.mu.RUnlock()

	// 如果已连接，跳过
	if ok && existing.IsConnected() {
		return
	}

	// 创建新客户端
	client := websocket.NewLeetCodeWSClient(slug, site,
		func(data []byte) {
			c.handleMessage(slug, site, data)
		},
		func(err error) {
			log.Printf("WebSocket error for %s [%s]: %v", slug, site, err)
			// 触发重连
			go func() {
				time.Sleep(5 * time.Second)
				c.subscribeToProblem(slug, site)
			}()
		},
	)

	if err := client.Connect(); err != nil {
		log.Printf("Failed to connect to %s [%s]: %v", slug, site, err)
		return
	}

	c.mu.Lock()
	c.clients[key] = client
	c.mu.Unlock()

	log.Printf("Connected to %s [%s]", slug, site)
}

// handleMessage 处理消息 - 区分站点
func (c *Crawler) handleMessage(slug string, site websocket.SiteType, data []byte) {
	var count int
	if _, err := fmt.Sscanf(string(data), "%d", &count); err == nil {
		c.saveOnlineCount(slug, site, count)
		return
	}

	// 尝试 JSON 格式
	var msg struct {
		Type  string `json:"type"`
		Count int    `json:"count"`
		Data  struct {
			Count int `json:"count"`
		} `json:"data"`
	}

	if err := json.Unmarshal(data, &msg); err == nil {
		if msg.Count > 0 {
			c.saveOnlineCount(slug, site, msg.Count)
		} else if msg.Data.Count > 0 {
			c.saveOnlineCount(slug, site, msg.Data.Count)
		}
		return
	}

	log.Printf("[%s-%s] Unrecognized message format: %s", slug, site, string(data))
}

// saveOnlineCount 保存指定站点的在线人数到 Redis 和 MySQL
func (c *Crawler) saveOnlineCount(slug string, site websocket.SiteType, count int) {
	// 从数据库获取题目元数据
	db := database.GetDB()
	if db == nil {
		// 如果数据库不可用，仅更新 Redis
		c.updateRedisWithSite(slug, site, count, nil)
		return
	}

	// 查询数据库获取题目信息
	var problem struct {
		FrontendID string
		Title      string
		TitleCn    string
		Difficulty string
		PaidOnly   bool
		Tags       string
	}

	result := db.Table("problems").
		Select("frontend_id, title, title_cn, difficulty, paid_only, tags").
		Where("slug = ?", slug).
		Scan(&problem)

	if result.Error != nil {
		log.Printf("Failed to get problem %s: %v", slug, result.Error)
		return
	}

	// 解析标签
	var topicTags []string
	if problem.Tags != "" {
		json.Unmarshal([]byte(problem.Tags), &topicTags)
	}

	// 更新 Redis (带站点信息)
	c.updateRedisWithSite(slug, site, count, &redis.ProblemMetaInfo{
		FrontendID: problem.FrontendID,
		Title:      problem.Title,
		TitleCn:    problem.TitleCn,
		Difficulty: problem.Difficulty,
		PaidOnly:   problem.PaidOnly,
		TopicTags:  topicTags,
	})

	// 持久化到对应站点的MySQL表
	c.persistToMySQL(problem.FrontendID, site, count)

	log.Printf("[%s-%s] Online count: %d", slug, site, count)

	// 发布更新通知 (带站点信息)
	redis.PublishOnlineUpdateWithSite(slug, site, count)
}

// ProblemMetaInfo holds problem metadata for Redis update
type ProblemMetaInfo redis.ProblemMetaInfo

// updateRedisWithSite 更新带站点信息的Redis数据
func (c *Crawler) updateRedisWithSite(slug string, site websocket.SiteType, count int, meta *redis.ProblemMetaInfo) {
	// 更新站点特定的在线人数
	status := &redis.ProblemOnlineStatus{
		Site:        string(site),
		OnlineCount: count,
		LastUpdated: time.Now(),
	}
	
	if meta != nil {
		status.FrontendID = meta.FrontendID
		status.Slug = slug
		status.Title = meta.Title
		status.TitleCn = meta.TitleCn
		status.Difficulty = meta.Difficulty
		status.PaidOnly = meta.PaidOnly
		status.TopicTags = meta.TopicTags
	}

	if err := redis.UpdateOnlineCountWithSite(slug, site, status); err != nil {
		log.Printf("Failed to update Redis for %s [%s]: %v", slug, site, err)
	}
}

// persistToMySQL 持久化到对应站点的MySQL表
func (c *Crawler) persistToMySQL(frontendID string, site websocket.SiteType, count int) {
	db := database.GetDB()
	if db == nil {
		return
	}

	now := time.Now()

	switch site {
	case websocket.SiteCN:
		record := &models.OnlineCountCN{
			FrontendID: frontendID,
			Count:      count,
			Timestamp:  now,
		}
		if err := db.Create(record).Error; err != nil {
			log.Printf("Failed to persist CN online count for %s: %v", frontendID, err)
		}
	case websocket.SiteCOM:
		record := &models.OnlineCountCOM{
			FrontendID: frontendID,
			Count:      count,
			Timestamp:  now,
		}
		if err := db.Create(record).Error; err != nil {
			log.Printf("Failed to persist COM online count for %s: %v", frontendID, err)
		}
	}
}

// updateTotalOnline 定时更新总在线人数
func (c *Crawler) updateTotalOnline() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-c.stopChan:
			return
		case <-ticker.C:
			c.calculateTotalOnline()
		}
	}
}

// calculateTotalOnline 计算双站点总在线人数并持久化
func (c *Crawler) calculateTotalOnline() {
	// 获取CN和COM的在线人数
	cnTotal, comTotal, unifiedTotal, err := redis.GetTotalOnlineBySite()
	if err != nil {
		log.Printf("Failed to get online counts by site: %v", err)
		return
	}

	// 更新Redis中的汇总数据
	if err := redis.UpdateTotalOnlineBySite(cnTotal, comTotal, unifiedTotal); err != nil {
		log.Printf("Failed to update total online by site: %v", err)
	}

	// 持久化到MySQL聚合表
	c.persistTotalOnlineToMySQL(cnTotal, comTotal, unifiedTotal)
}

// persistTotalOnlineToMySQL 持久化总在线人数到MySQL聚合表
func (c *Crawler) persistTotalOnlineToMySQL(cnTotal, comTotal, unifiedTotal int) {
	db := database.GetDB()
	if db == nil {
		return
	}

	now := time.Now()
	minuteBucket := now.Truncate(time.Minute)
	hourBucket := now.Truncate(time.Hour)
	dayBucket := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// 保存CN站点聚合数据
	cnAggregate := &models.TotalOnlineAggregateCN{
		Timestamp:  minuteBucket,
		Total:      cnTotal,
		HourBucket: hourBucket,
		DayBucket:  dayBucket,
	}
	if err := db.Where("timestamp = ?", minuteBucket).FirstOrCreate(&models.TotalOnlineAggregateCN{}, cnAggregate).Error; err != nil {
		// 更新现有记录
		db.Model(&models.TotalOnlineAggregateCN{}).Where("timestamp = ?", minuteBucket).Update("total", cnTotal)
	}

	// 保存COM站点聚合数据
	comAggregate := &models.TotalOnlineAggregateCOM{
		Timestamp:  minuteBucket,
		Total:      comTotal,
		HourBucket: hourBucket,
		DayBucket:  dayBucket,
	}
	if err := db.Where("timestamp = ?", minuteBucket).FirstOrCreate(&models.TotalOnlineAggregateCOM{}, comAggregate).Error; err != nil {
		db.Model(&models.TotalOnlineAggregateCOM{}).Where("timestamp = ?", minuteBucket).Update("total", comTotal)
	}

	// 保存Unified汇总数据
	unifiedAggregate := &models.TotalOnlineAggregateUnified{
		Timestamp:  minuteBucket,
		TotalCN:    cnTotal,
		TotalCOM:   comTotal,
		Total:      unifiedTotal,
		HourBucket: hourBucket,
		DayBucket:  dayBucket,
	}
	if err := db.Where("timestamp = ?", minuteBucket).FirstOrCreate(&models.TotalOnlineAggregateUnified{}, unifiedAggregate).Error; err != nil {
		db.Model(&models.TotalOnlineAggregateUnified{}).Where("timestamp = ?", minuteBucket).Updates(map[string]interface{}{
			"total_cn":  cnTotal,
			"total_com": comTotal,
			"total":     unifiedTotal,
		})
	}

	log.Printf("Total online - CN: %d, COM: %d, Unified: %d", cnTotal, comTotal, unifiedTotal)
}

func main() {
	log.Println("Starting LeetCode WSS Crawler...")

	// 加载配置
	cfg := config.Load()

	// 初始化数据库（用于获取题目元数据）
	if err := database.Init(cfg.DSN(), cfg.ProblemData); err != nil {
		log.Printf("Warning: Failed to initialize database: %v", err)
		log.Println("Crawler will continue without database, using cached data only")
	}

	// 初始化 Redis
	redisCfg := &redis.Config{
		Host:     getEnv("REDIS_HOST", "localhost"),
		Port:     getEnv("REDIS_PORT", "6379"),
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       0,
	}

	if err := redis.Init(redisCfg); err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}
	defer redis.Close()

	// 创建并启动爬虫
	crawler := NewCrawler(cfg.Problems, cfg.BatchSize, time.Duration(cfg.IntervalSec)*time.Second)
	crawler.Start()

	log.Printf("Crawler started for %d problems", len(cfg.Problems))
	log.Println("Press Ctrl+C to stop")

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down crawler...")
	crawler.Stop()
	log.Println("Crawler stopped")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
