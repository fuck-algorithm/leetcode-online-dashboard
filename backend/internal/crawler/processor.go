package crawler

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
	"leetcode-dashboard/internal/redis"
	"leetcode-dashboard/internal/websocket"
)

// MessageProcessor processes WebSocket messages
type MessageProcessor struct {
	manager *Manager
}

// NewMessageProcessor creates a new message processor
func NewMessageProcessor(manager *Manager) *MessageProcessor {
	return &MessageProcessor{manager: manager}
}

// ProcessMessage handles incoming WebSocket messages
func (p *MessageProcessor) ProcessMessage(slug string, site websocket.SiteType, data []byte) {
	var count int
	if _, err := fmt.Sscanf(string(data), "%d", &count); err == nil {
		p.saveOnlineCount(slug, site, count)
		return
	}

	// Try JSON format
	var msg struct {
		Type  string `json:"type"`
		Count int    `json:"count"`
		Data  struct {
			Count int `json:"count"`
		} `json:"data"`
	}

	if err := json.Unmarshal(data, &msg); err == nil {
		if msg.Count > 0 {
			p.saveOnlineCount(slug, site, msg.Count)
		} else if msg.Data.Count > 0 {
			p.saveOnlineCount(slug, site, msg.Data.Count)
		}
		return
	}

	log.Printf("[%s-%s] Unrecognized message format: %s", slug, site, string(data))
}

// saveOnlineCount saves the online count for a specific problem and site
func (p *MessageProcessor) saveOnlineCount(slug string, site websocket.SiteType, count int) {
	db := database.GetDB()
	if db == nil {
		// Update Redis only if DB is not available
		p.updateRedis(slug, site, count, nil)
		return
	}

	// Get problem info
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

	// Parse tags
	var topicTags []string
	if problem.Tags != "" {
		json.Unmarshal([]byte(problem.Tags), &topicTags)
	}

	// Update Redis
	p.updateRedis(slug, site, count, &redis.ProblemMetaInfo{
		FrontendID: problem.FrontendID,
		Title:      problem.Title,
		TitleCn:    problem.TitleCn,
		Difficulty: problem.Difficulty,
		PaidOnly:   problem.PaidOnly,
		TopicTags:  topicTags,
	})

	// Persist to MySQL
	p.persistToMySQL(problem.FrontendID, site, count)

	log.Printf("[%s-%s] Online count: %d", slug, site, count)

	// Publish update
	redis.PublishOnlineUpdateWithSite(slug, site, count)
}

// updateRedis updates Redis with site-specific data
func (p *MessageProcessor) updateRedis(slug string, site websocket.SiteType, count int, meta *redis.ProblemMetaInfo) {
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

// persistToMySQL persists data to MySQL
func (p *MessageProcessor) persistToMySQL(frontendID string, site websocket.SiteType, count int) {
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
