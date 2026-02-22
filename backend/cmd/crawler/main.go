package main

import (
	"encoding/json"
	"fmt"
	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/redis"
	"leetcode-dashboard/internal/websocket"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// Crawler 爬虫管理器
type Crawler struct {
	clients   map[string]*websocket.LeetCodeWSClient
	problems  []string
	mu        sync.RWMutex
	stopChan  chan struct{}
	batchSize int
	interval  time.Duration
}

// NewCrawler 创建新的爬虫实例
func NewCrawler(problems []string, batchSize int, interval time.Duration) *Crawler {
	return &Crawler{
		clients:   make(map[string]*websocket.LeetCodeWSClient),
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

	for slug, client := range c.clients {
		log.Printf("Closing connection for %s", slug)
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

// processBatch 处理单个批次
func (c *Crawler) processBatch(batchIndex, totalBatches int) {
	start := batchIndex * c.batchSize
	end := start + c.batchSize
	if end > len(c.problems) {
		end = len(c.problems)
	}

	batch := c.problems[start:end]
	log.Printf("Processing batch %d/%d (%d problems)", batchIndex+1, totalBatches, len(batch))

	for _, slug := range batch {
		go c.subscribeToProblem(slug)
	}
}

// subscribeToProblem 订阅题目
func (c *Crawler) subscribeToProblem(slug string) {
	c.mu.RLock()
	existing, ok := c.clients[slug]
	c.mu.RUnlock()

	// 如果已连接，跳过
	if ok && existing.IsConnected() {
		return
	}

	// 创建新客户端
	client := websocket.NewLeetCodeWSClient(slug,
		func(data []byte) {
			c.handleMessage(slug, data)
		},
		func(err error) {
			log.Printf("WebSocket error for %s: %v", slug, err)
			// 触发重连
			go func() {
				time.Sleep(5 * time.Second)
				c.subscribeToProblem(slug)
			}()
		},
	)

	if err := client.Connect(); err != nil {
		log.Printf("Failed to connect to %s: %v", slug, err)
		return
	}

	c.mu.Lock()
	c.clients[slug] = client
	c.mu.Unlock()

	log.Printf("Connected to %s", slug)
}

// handleMessage 处理消息
func (c *Crawler) handleMessage(slug string, data []byte) {
	var count int
	if _, err := fmt.Sscanf(string(data), "%d", &count); err == nil {
		c.saveOnlineCount(slug, count)
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
			c.saveOnlineCount(slug, msg.Count)
		} else if msg.Data.Count > 0 {
			c.saveOnlineCount(slug, msg.Data.Count)
		}
		return
	}

	log.Printf("[%s] Unrecognized message format: %s", slug, string(data))
}

// saveOnlineCount 保存在线人数到 Redis
func (c *Crawler) saveOnlineCount(slug string, count int) {
	// 从数据库获取题目元数据
	db := database.GetDB()
	if db == nil {
		// 如果数据库不可用，使用 Redis 中的缓存数据
		existing, _ := redis.GetOnlineCount(slug)
		if existing != nil {
			existing.OnlineCount = count
			existing.LastUpdated = time.Now()
			if err := redis.UpdateOnlineCount(slug, existing); err != nil {
				log.Printf("Failed to update Redis for %s: %v", slug, err)
			} else {
				log.Printf("[%s] Online count: %d (from cache)", slug, count)
			}
			// 发布更新
			redis.PublishOnlineUpdate(slug, count)
		}
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

	// 更新 Redis
	status := &redis.ProblemOnlineStatus{
		FrontendID:  problem.FrontendID,
		Slug:        slug,
		Title:       problem.Title,
		TitleCn:     problem.TitleCn,
		Difficulty:  problem.Difficulty,
		PaidOnly:    problem.PaidOnly,
		TopicTags:   topicTags,
		OnlineCount: count,
		LastUpdated: time.Now(),
	}

	if err := redis.UpdateOnlineCount(slug, status); err != nil {
		log.Printf("Failed to update Redis for %s: %v", slug, err)
		return
	}

	log.Printf("[%s] Online count: %d", slug, count)

	// 发布更新通知
	redis.PublishOnlineUpdate(slug, count)
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

// calculateTotalOnline 计算总在线人数
func (c *Crawler) calculateTotalOnline() {
	statuses, err := redis.GetAllOnlineCounts()
	if err != nil {
		log.Printf("Failed to get all online counts: %v", err)
		return
	}

	total := 0
	for _, s := range statuses {
		total += s.OnlineCount
	}

	if err := redis.UpdateTotalOnline(total); err != nil {
		log.Printf("Failed to update total online: %v", err)
	}
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
