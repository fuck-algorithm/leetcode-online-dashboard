package handlers

import (
	"leetcode-dashboard/internal/cache"
	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
	"log"
	"net/http"
	"sort"
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

// GetTotalOnlineCountHistory returns the total online count from pre-aggregated table
// This is much faster than real-time aggregation from online_counts table
func GetTotalOnlineCountHistory(c *gin.Context) {
	db := database.GetDB()
	if db == nil {
		Error(c, http.StatusInternalServerError, "Database not available")
		return
	}

	// Get hours parameter (default 24 hours)
	hours := 24
	if h := c.Query("hours"); h != "" {
		if parsed, err := strconv.Atoi(h); err == nil && parsed > 0 && parsed <= 168 {
			hours = parsed
		}
	}

	// Calculate cutoff time
	cutoff := time.Now().Add(-time.Duration(hours) * time.Hour)

	type TotalOnlinePoint struct {
		Timestamp time.Time `json:"timestamp"`
		Total     int       `json:"total"`
	}

	var results []TotalOnlinePoint

	// Query from pre-aggregated table - much faster than real-time aggregation
	var aggregates []models.TotalOnlineAggregate
	if err := db.Where("timestamp >= ?", cutoff).
		Order("timestamp ASC").
		Find(&aggregates).Error; err != nil {
		Error(c, http.StatusInternalServerError, "Failed to query aggregate history: "+err.Error())
		return
	}

	// Convert to response format
	for _, agg := range aggregates {
		results = append(results, TotalOnlinePoint{
			Timestamp: agg.Timestamp,
			Total:     agg.Total,
		})
	}

	// Fill in missing minutes with 0 values for continuous chart
	var filledResults []TotalOnlinePoint
	now := time.Now()
	current := cutoff.Truncate(time.Minute)
	dataIndex := 0

	for current.Before(now) || current.Equal(now) {
		point := TotalOnlinePoint{
			Timestamp: current,
			Total:     0,
		}

		// Check if we have data for this minute
		if dataIndex < len(results) {
			dataTime := results[dataIndex].Timestamp.Truncate(time.Minute)
			if dataTime.Equal(current) {
				point.Total = results[dataIndex].Total
				dataIndex++
			}
		}

		filledResults = append(filledResults, point)
		current = current.Add(time.Minute)
	}

	Success(c, gin.H{
		"hours":   hours,
		"points":  len(filledResults),
		"data":    filledResults,
	})
}

// GetTotalOnlineCountAggregate returns aggregated total online count data
// Supports custom time range and granularity (minute/hour/day)
func GetTotalOnlineCountAggregate(c *gin.Context) {
	db := database.GetDB()
	if db == nil {
		Error(c, http.StatusInternalServerError, "Database not available")
		return
	}

	// Parse granularity parameter (minute, hour, day)
	granularity := c.Query("granularity")
	if granularity == "" {
		granularity = "minute"
	}
	if granularity != "minute" && granularity != "hour" && granularity != "day" {
		Error(c, http.StatusBadRequest, "Invalid granularity. Must be 'minute', 'hour', or 'day'")
		return
	}

	// Parse time range parameters
	now := time.Now()
	var startTime, endTime time.Time

	if start := c.Query("start"); start != "" {
		if parsed, err := time.Parse(time.RFC3339, start); err == nil {
			startTime = parsed
		} else {
			Error(c, http.StatusBadRequest, "Invalid start time format. Use RFC3339 format (e.g., 2024-01-01T00:00:00Z)")
			return
		}
	} else {
		// Default: last 24 hours
		startTime = now.Add(-24 * time.Hour)
	}

	if end := c.Query("end"); end != "" {
		if parsed, err := time.Parse(time.RFC3339, end); err == nil {
			endTime = parsed
		} else {
			Error(c, http.StatusBadRequest, "Invalid end time format. Use RFC3339 format")
			return
		}
	} else {
		endTime = now
	}

	// Validate time range (max 1 year)
	maxDuration := 365 * 24 * time.Hour
	if endTime.Sub(startTime) > maxDuration {
		Error(c, http.StatusBadRequest, "Time range too large. Maximum allowed is 1 year")
		return
	}

	if endTime.Before(startTime) {
		Error(c, http.StatusBadRequest, "End time must be after start time")
		return
	}

	type AggregatePoint struct {
		Timestamp time.Time `json:"timestamp"`
		Total     int       `json:"total"`
	}

	var results []AggregatePoint

	// Query from pre-aggregated table based on granularity
	// This is much faster than real-time aggregation from online_counts table
	switch granularity {
	case "minute":
		// Query minute-level data directly from aggregate table
		var aggregates []models.TotalOnlineAggregate
		if err := db.Where("timestamp >= ? AND timestamp <= ?", startTime, endTime).
			Order("timestamp ASC").
			Find(&aggregates).Error; err != nil {
			Error(c, http.StatusInternalServerError, "Failed to query aggregate data: "+err.Error())
			return
		}
		for _, agg := range aggregates {
			results = append(results, AggregatePoint{
				Timestamp: agg.Timestamp,
				Total:     agg.Total,
			})
		}
	case "hour":
		// Query hour-level aggregated data using hour_bucket
		// Group by hour_bucket and take the last value of each hour (or average)
		type HourlyAggregate struct {
			HourBucket time.Time
			Total      int
		}
		var hourlyResults []HourlyAggregate
		rawSQL := `
			SELECT 
				hour_bucket,
				AVG(total) as total
			FROM total_online_aggregates
			WHERE hour_bucket >= ? AND hour_bucket <= ?
			GROUP BY hour_bucket
			ORDER BY hour_bucket ASC
		`
		if err := db.Raw(rawSQL, startTime.Truncate(time.Hour), endTime.Truncate(time.Hour)).Scan(&hourlyResults).Error; err != nil {
			// Fallback: query all and aggregate in memory
			var aggregates []models.TotalOnlineAggregate
			if err := db.Where("timestamp >= ? AND timestamp <= ?", startTime, endTime).
				Order("timestamp ASC").
				Find(&aggregates).Error; err != nil {
				Error(c, http.StatusInternalServerError, "Failed to query aggregate data: "+err.Error())
				return
			}
			// Group by hour bucket
			hourMap := make(map[time.Time]int)
			for _, agg := range aggregates {
				hourMap[agg.HourBucket] = agg.Total
			}
			for hour, total := range hourMap {
				results = append(results, AggregatePoint{
					Timestamp: hour,
					Total:     total,
				})
			}
			// Sort by timestamp
			sort.Slice(results, func(i, j int) bool {
				return results[i].Timestamp.Before(results[j].Timestamp)
			})
		} else {
			for _, hr := range hourlyResults {
				results = append(results, AggregatePoint{
					Timestamp: hr.HourBucket,
					Total:     hr.Total,
				})
			}
		}
	case "day":
		// Query day-level aggregated data using day_bucket
		type DailyAggregate struct {
			DayBucket time.Time
			Total     int
		}
		var dailyResults []DailyAggregate
		rawSQL := `
			SELECT 
				day_bucket,
				AVG(total) as total
			FROM total_online_aggregates
			WHERE day_bucket >= ? AND day_bucket <= ?
			GROUP BY day_bucket
			ORDER BY day_bucket ASC
		`
		if err := db.Raw(rawSQL, time.Date(startTime.Year(), startTime.Month(), startTime.Day(), 0, 0, 0, 0, startTime.Location()),
			time.Date(endTime.Year(), endTime.Month(), endTime.Day(), 0, 0, 0, 0, endTime.Location())).Scan(&dailyResults).Error; err != nil {
			// Fallback: query all and aggregate in memory
			var aggregates []models.TotalOnlineAggregate
			if err := db.Where("timestamp >= ? AND timestamp <= ?", startTime, endTime).
				Order("timestamp ASC").
				Find(&aggregates).Error; err != nil {
				Error(c, http.StatusInternalServerError, "Failed to query aggregate data: "+err.Error())
				return
			}
			// Group by day bucket
			dayMap := make(map[time.Time][]int)
			for _, agg := range aggregates {
				dayMap[agg.DayBucket] = append(dayMap[agg.DayBucket], agg.Total)
			}
			for day, totals := range dayMap {
				avg := 0
				if len(totals) > 0 {
					sum := 0
					for _, t := range totals {
						sum += t
					}
					avg = sum / len(totals)
				}
				results = append(results, AggregatePoint{
					Timestamp: day,
					Total:     avg,
				})
			}
			// Sort by timestamp
			sort.Slice(results, func(i, j int) bool {
				return results[i].Timestamp.Before(results[j].Timestamp)
			})
		} else {
			for _, dr := range dailyResults {
				results = append(results, AggregatePoint{
					Timestamp: dr.DayBucket,
					Total:     dr.Total,
				})
			}
		}
	}

	Success(c, gin.H{
		"granularity": granularity,
		"start_time":  startTime.Format(time.RFC3339),
		"end_time":    endTime.Format(time.RFC3339),
		"points":      len(results),
		"data":        results,
	})
}
