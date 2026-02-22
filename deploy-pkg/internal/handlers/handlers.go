package handlers

import (
	"leetcode-dashboard/internal/cache"
	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
	"log"
	"net/http"
	"strconv"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Response 统一响应结构
type Response struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"`
}

// Success 返回成功响应
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code: 200,
		Msg:  "success",
		Data: data,
	})
}

// Error 返回错误响应
func Error(c *gin.Context, code int, msg string) {
	c.JSON(code, Response{
		Code: code,
		Msg:  msg,
		Data: nil,
	})
}

// GetProblems returns all problems with their latest online counts
func GetProblems(c *gin.Context) {
	db := database.GetDB()

	var problems []models.Problem
	if err := db.Find(&problems).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Get latest online count for each problem
	var result []models.ProblemWithOnlineCount
	for _, p := range problems {
		var latestCount models.OnlineCount
		db.Where("frontend_id = ?", p.FrontendID).Order("timestamp DESC").First(&latestCount)

		result = append(result, models.ProblemWithOnlineCount{
			Problem:     p,
			OnlineCount: latestCount.Count,
			LastUpdated: latestCount.Timestamp,
		})
	}

	c.JSON(http.StatusOK, result)
}

// GetHot100 returns the LeetCode Hot 100 problems with latest online counts
// 从内存缓存读取，避免数据库查询
func GetHot100(c *gin.Context) {
	cfg := config.Load()
	statuses := cache.GetCache().GetHot100(cfg.Problems)

	// 使用自定义响应结构，包含 topic_tags
	type problemResponse struct {
		models.Problem
		TopicTags   []string  `json:"topic_tags"`
		OnlineCount int       `json:"online_count"`
		LastUpdated time.Time `json:"last_updated"`
	}

	result := make([]problemResponse, 0, len(statuses))
	for _, s := range statuses {
		result = append(result, problemResponse{
			Problem: models.Problem{
				FrontendID: s.FrontendID,
				Slug:       s.Slug,
				Title:      s.Title,
				TitleCn:    s.TitleCn,
				Difficulty: s.Difficulty,
				PaidOnly:   s.PaidOnly,
			},
			TopicTags:   s.TopicTags,
			OnlineCount: s.OnlineCount,
			LastUpdated: s.LastUpdated,
		})
	}

	c.JSON(http.StatusOK, result)
}

// isNumeric checks if a string contains only digits
func isNumeric(s string) bool {
	for _, r := range s {
		if !unicode.IsDigit(r) {
			return false
		}
	}
	return len(s) > 0
}

// resolveProblemID converts a problem identifier (numeric or slug) to frontend_id
func resolveProblemID(db *gorm.DB, id string) (string, error) {
	// If it's numeric, verify it exists in database
	if isNumeric(id) {
		var problem models.Problem
		if err := db.Where("frontend_id = ?", id).First(&problem).Error; err != nil {
			log.Printf("[resolveProblemID] Problem with frontend_id '%s' not found: %v", id, err)
			return "", err
		}
		return id, nil
	}

	// Otherwise, try to find by slug (case-insensitive)
	var problem models.Problem
	if err := db.Where("LOWER(slug) = LOWER(?)", id).First(&problem).Error; err != nil {
		log.Printf("[resolveProblemID] Failed to find problem with slug '%s': %v", id, err)
		return "", err
	}

	log.Printf("[resolveProblemID] Found problem: slug='%s', frontend_id='%s'", problem.Slug, problem.FrontendID)
	return problem.FrontendID, nil
}

// GetOnlineCounts returns online count history for a problem
func GetOnlineCounts(c *gin.Context) {
	db := database.GetDB()
	problemID := c.Param("id")

	// Resolve problem ID (support both numeric and slug formats)
	frontendID, err := resolveProblemID(db, problemID)
	if err != nil {
		Error(c, http.StatusNotFound, "Problem not found")
		return
	}

	// Parse query parameters
	limit := 100
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	var counts []models.OnlineCount
	if err := db.Where("frontend_id = ?", frontendID).
		Order("timestamp DESC").
		Limit(limit).
		Find(&counts).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, counts)
}

// GetOnlineCountsByQuery returns online count history for a problem using query param
func GetOnlineCountsByQuery(c *gin.Context) {
	db := database.GetDB()
	problemID := c.Query("problemId")
	if problemID == "" {
		Error(c, http.StatusBadRequest, "Missing problemId query parameter")
		return
	}

	// Resolve problem ID (support both numeric and slug formats)
	frontendID, err := resolveProblemID(db, problemID)
	if err != nil {
		Error(c, http.StatusNotFound, "Problem not found")
		return
	}

	// Parse query parameters
	hours := 24
	if h := c.Query("hours"); h != "" {
		if parsed, err := strconv.Atoi(h); err == nil {
			hours = parsed
		}
	}

	// Calculate cutoff time
	cutoff := time.Now().Add(-time.Duration(hours) * time.Hour)

	// Parse date range parameters (支持到天或精确到秒)
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	startTimeStr := c.Query("startTime")
	endTimeStr := c.Query("endTime")

	var startTime, endTime time.Time
	var useDateRange bool

	if startTimeStr != "" && endTimeStr != "" {
		// 精确时间格式：2006-01-02 15:04:05
		if s, err := time.Parse("2006-01-02 15:04:05", startTimeStr); err == nil {
			startTime = s
			useDateRange = true
		}
		if e, err := time.Parse("2006-01-02 15:04:05", endTimeStr); err == nil {
			endTime = e
			useDateRange = true
		}
	} else if startDate != "" && endDate != "" {
		// 日期格式（兼容旧版）：2006-01-02，endDate扩展到当天结束
		if s, err := time.Parse("2006-01-02", startDate); err == nil {
			startTime = s
			useDateRange = true
		}
		if e, err := time.Parse("2006-01-02", endDate); err == nil {
			endTime = e.Add(24*time.Hour - time.Second)
			useDateRange = true
		}
	}

	var counts []models.OnlineCount

	if useDateRange {
		// Use date range filter
		if err := db.Where("frontend_id = ? AND timestamp >= ? AND timestamp <= ?", frontendID, startTime, endTime).
			Order("timestamp DESC").
			Find(&counts).Error; err != nil {
			Error(c, http.StatusInternalServerError, err.Error())
			return
		}
	} else {
		// Use hours filter (default behavior)
		if err := db.Where("frontend_id = ? AND timestamp > ?", frontendID, cutoff).
			Order("timestamp DESC").
			Find(&counts).Error; err != nil {
			Error(c, http.StatusInternalServerError, err.Error())
			return
		}
	}

	Success(c, counts)
}

// GetLatestOnlineCounts returns the latest online count for all problems
func GetLatestOnlineCounts(c *gin.Context) {
	db := database.GetDB()

	// Get problems from last 5 minutes
	cutoff := time.Now().Add(-5 * time.Minute)

	var counts []models.OnlineCount
	subQuery := db.Table("online_counts").
		Select("frontend_id, MAX(timestamp) as max_time").
		Group("frontend_id")

	if err := db.Table("online_counts AS oc").
		Joins("INNER JOIN (?) AS latest ON oc.frontend_id = latest.frontend_id AND oc.timestamp = latest.max_time", subQuery).
		Where("oc.timestamp > ?", cutoff).
		Find(&counts).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, counts)
}

// HealthCheck returns the health status
func HealthCheck(c *gin.Context) {
	Success(c, gin.H{
		"status":    "healthy",
		"timestamp": time.Now(),
	})
}
