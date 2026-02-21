package handlers

import (
	"leetcode-dashboard/internal/cache"
	"leetcode-dashboard/internal/config"
	"time"

	"github.com/gin-gonic/gin"
)

// ProblemStatusResponse represents the API response for problem status
type ProblemStatusResponse struct {
	FrontendID  string    `json:"frontend_id"`
	Slug        string    `json:"slug"`
	Title       string    `json:"title"`
	Difficulty  string    `json:"difficulty"`
	PaidOnly    bool      `json:"paid_only"`
	TopicTags   []string  `json:"topic_tags"`
	OnlineCount int       `json:"online_count"`
	LastUpdated time.Time `json:"last_updated"`
}

// GetProblemsFromCache returns all problems from memory cache
func GetProblemsFromCache(c *gin.Context) {
	statuses := cache.GetCache().GetAll()

	result := make([]ProblemStatusResponse, 0, len(statuses))
	for _, s := range statuses {
		// 优先使用中文标题
		title := s.TitleCn
		if title == "" {
			title = s.Title
		}
		result = append(result, ProblemStatusResponse{
			FrontendID:  s.FrontendID,
			Slug:        s.Slug,
			Title:       title,
			Difficulty:  s.Difficulty,
			PaidOnly:    s.PaidOnly,
			TopicTags:   s.TopicTags,
			OnlineCount: s.OnlineCount,
			LastUpdated: s.LastUpdated,
		})
	}

	Success(c, result)
}

// GetHot100FromCache returns Hot100 problems from memory cache
func GetHot100FromCache(c *gin.Context) {
	cfg := config.Load()
	statuses := cache.GetCache().GetHot100(cfg.Problems)

	result := make([]ProblemStatusResponse, 0, len(statuses))
	for _, s := range statuses {
		// 优先使用中文标题
		title := s.TitleCn
		if title == "" {
			title = s.Title
		}
		result = append(result, ProblemStatusResponse{
			FrontendID:  s.FrontendID,
			Slug:        s.Slug,
			Title:       title,
			Difficulty:  s.Difficulty,
			PaidOnly:    s.PaidOnly,
			TopicTags:   s.TopicTags,
			OnlineCount: s.OnlineCount,
			LastUpdated: s.LastUpdated,
		})
	}

	Success(c, result)
}

// GetLatestOnlineCountsFromCache returns latest online counts from memory cache
func GetLatestOnlineCountsFromCache(c *gin.Context) {
	statuses := cache.GetCache().GetAll()

	result := make([]map[string]interface{}, 0, len(statuses))
	for _, s := range statuses {
		result = append(result, map[string]interface{}{
			"frontend_id": s.FrontendID,
			"slug":        s.Slug,
			"count":       s.OnlineCount,
			"timestamp":   s.LastUpdated,
		})
	}

	Success(c, result)
}
