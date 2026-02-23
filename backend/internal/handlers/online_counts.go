package handlers

import (
	"log"
	"net/http"
	"sort"
	"strconv"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
)

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
// 支持同时返回 CN/COM/Total 三个数据，减少前端请求次数
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

	// Parse site parameter (cn, com, unified, or all)
	site := c.Query("site")
	if site == "" {
		site = "all" // 默认返回所有数据
	}

	// 如果请求所有数据，同时查询 CN/COM/Unified
	if site == "all" {
		var cnCounts []models.OnlineCountCN
		var comCounts []models.OnlineCountCOM
		var unifiedCounts []models.OnlineCountUnified

		db.Where("frontend_id = ?", frontendID).Order("timestamp DESC").Limit(limit).Find(&cnCounts)
		db.Where("frontend_id = ?", frontendID).Order("timestamp DESC").Limit(limit).Find(&comCounts)
		db.Where("frontend_id = ?", frontendID).Order("timestamp DESC").Limit(limit).Find(&unifiedCounts)

		// 合并数据，按时间戳对齐
		mergedData := mergeOnlineCounts(cnCounts, comCounts, unifiedCounts)
		Success(c, mergedData)
		return
	}

	var counts interface{}
	switch site {
	case "cn":
		var cnCounts []models.OnlineCountCN
		if err := db.Where("frontend_id = ?", frontendID).
			Order("timestamp DESC").
			Limit(limit).
			Find(&cnCounts).Error; err != nil {
			Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		counts = cnCounts
	case "com":
		var comCounts []models.OnlineCountCOM
		if err := db.Where("frontend_id = ?", frontendID).
			Order("timestamp DESC").
			Limit(limit).
			Find(&comCounts).Error; err != nil {
			Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		counts = comCounts
	default:
		var unifiedCounts []models.OnlineCountUnified
		if err := db.Where("frontend_id = ?", frontendID).
			Order("timestamp DESC").
			Limit(limit).
			Find(&unifiedCounts).Error; err != nil {
			Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		counts = unifiedCounts
	}

	Success(c, counts)
}

// mergeOnlineCounts 合并 CN/COM/Unified 数据，按时间戳对齐
func mergeOnlineCounts(cnCounts []models.OnlineCountCN, comCounts []models.OnlineCountCOM, unifiedCounts []models.OnlineCountUnified) []map[string]interface{} {
	// 使用 map 按时间戳合并
	dataMap := make(map[time.Time]map[string]interface{})

	// 处理 Unified 数据（优先，因为包含 CN 和 COM）
	for _, u := range unifiedCounts {
		t := u.Timestamp.Truncate(time.Minute)
		if _, ok := dataMap[t]; !ok {
			dataMap[t] = map[string]interface{}{
				"timestamp": u.Timestamp,
			}
		}
		dataMap[t]["count_cn"] = u.CountCN
		dataMap[t]["count_com"] = u.CountCOM
		dataMap[t]["count"] = u.CountTotal
	}

	// 处理 CN 数据（补充）
	for _, cn := range cnCounts {
		t := cn.Timestamp.Truncate(time.Minute)
		if _, ok := dataMap[t]; !ok {
			dataMap[t] = map[string]interface{}{
				"timestamp": cn.Timestamp,
			}
		}
		if _, ok := dataMap[t]["count_cn"]; !ok {
			dataMap[t]["count_cn"] = cn.Count
		}
	}

	// 处理 COM 数据（补充）
	for _, com := range comCounts {
		t := com.Timestamp.Truncate(time.Minute)
		if _, ok := dataMap[t]; !ok {
			dataMap[t] = map[string]interface{}{
				"timestamp": com.Timestamp,
			}
		}
		if _, ok := dataMap[t]["count_com"]; !ok {
			dataMap[t]["count_com"] = com.Count
		}
	}

	// 转换为有序数组
	result := make([]map[string]interface{}, 0, len(dataMap))
	for _, v := range dataMap {
		// 确保 count 字段存在
		if _, ok := v["count"]; !ok {
			cn := 0
			com := 0
			if c, ok := v["count_cn"].(int); ok {
				cn = c
			}
			if c, ok := v["count_com"].(int); ok {
				com = c
			}
			v["count"] = cn + com
		}
		result = append(result, v)
	}

	// 按时间戳排序
	sort.Slice(result, func(i, j int) bool {
		return result[i]["timestamp"].(time.Time).After(result[j]["timestamp"].(time.Time))
	})

	return result
}

// GetOnlineCountsByQuery returns online count history for a problem using query param
// 支持同时返回 CN/COM/Total 三个数据，减少前端请求次数
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
	limit := 1000
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	// Calculate cutoff time
	hours := 24
	if h := c.Query("hours"); h != "" {
		if parsed, err := strconv.Atoi(h); err == nil {
			hours = parsed
		}
	}
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

	// Parse site parameter (cn, com, unified, or all)
	site := c.Query("site")
	if site == "" {
		site = "all" // 默认返回所有数据
	}

	// 如果请求所有数据，同时查询 CN/COM/Unified
	if site == "all" {
		var cnCounts []models.OnlineCountCN
		var comCounts []models.OnlineCountCOM
		var unifiedCounts []models.OnlineCountUnified

		if useDateRange {
			db.Where("frontend_id = ? AND timestamp >= ? AND timestamp <= ?", frontendID, startTime, endTime).Order("timestamp DESC").Limit(limit).Find(&cnCounts)
			db.Where("frontend_id = ? AND timestamp >= ? AND timestamp <= ?", frontendID, startTime, endTime).Order("timestamp DESC").Limit(limit).Find(&comCounts)
			db.Where("frontend_id = ? AND timestamp >= ? AND timestamp <= ?", frontendID, startTime, endTime).Order("timestamp DESC").Limit(limit).Find(&unifiedCounts)
		} else {
			db.Where("frontend_id = ? AND timestamp > ?", frontendID, cutoff).Order("timestamp DESC").Limit(limit).Find(&cnCounts)
			db.Where("frontend_id = ? AND timestamp > ?", frontendID, cutoff).Order("timestamp DESC").Limit(limit).Find(&comCounts)
			db.Where("frontend_id = ? AND timestamp > ?", frontendID, cutoff).Order("timestamp DESC").Limit(limit).Find(&unifiedCounts)
		}

		mergedData := mergeOnlineCounts(cnCounts, comCounts, unifiedCounts)
		Success(c, mergedData)
		return
	}

	var counts interface{}

	if useDateRange {
		// Use date range filter
		switch site {
		case "cn":
			var cnCounts []models.OnlineCountCN
			if err := db.Where("frontend_id = ? AND timestamp >= ? AND timestamp <= ?", frontendID, startTime, endTime).
				Order("timestamp DESC").
				Find(&cnCounts).Error; err != nil {
				Error(c, http.StatusInternalServerError, err.Error())
				return
			}
			counts = cnCounts
		case "com":
			var comCounts []models.OnlineCountCOM
			if err := db.Where("frontend_id = ? AND timestamp >= ? AND timestamp <= ?", frontendID, startTime, endTime).
				Order("timestamp DESC").
				Find(&comCounts).Error; err != nil {
				Error(c, http.StatusInternalServerError, err.Error())
				return
			}
			counts = comCounts
		default:
			var unifiedCounts []models.OnlineCountUnified
			if err := db.Where("frontend_id = ? AND timestamp >= ? AND timestamp <= ?", frontendID, startTime, endTime).
				Order("timestamp DESC").
				Find(&unifiedCounts).Error; err != nil {
				Error(c, http.StatusInternalServerError, err.Error())
				return
			}
			counts = unifiedCounts
		}
	} else {
		// Use hours filter (default behavior)
		switch site {
		case "cn":
			var cnCounts []models.OnlineCountCN
			if err := db.Where("frontend_id = ? AND timestamp > ?", frontendID, cutoff).
				Order("timestamp DESC").
				Find(&cnCounts).Error; err != nil {
				Error(c, http.StatusInternalServerError, err.Error())
				return
			}
			counts = cnCounts
		case "com":
			var comCounts []models.OnlineCountCOM
			if err := db.Where("frontend_id = ? AND timestamp > ?", frontendID, cutoff).
				Order("timestamp DESC").
				Find(&comCounts).Error; err != nil {
				Error(c, http.StatusInternalServerError, err.Error())
				return
			}
			counts = comCounts
		default:
			var unifiedCounts []models.OnlineCountUnified
			if err := db.Where("frontend_id = ? AND timestamp > ?", frontendID, cutoff).
				Order("timestamp DESC").
				Find(&unifiedCounts).Error; err != nil {
				Error(c, http.StatusInternalServerError, err.Error())
				return
			}
			counts = unifiedCounts
		}
	}

	Success(c, counts)
}

// GetLatestOnlineCounts returns the latest online count for all problems (unified by default)
func GetLatestOnlineCounts(c *gin.Context) {
	db := database.GetDB()

	// Get site parameter
	site := c.Query("site")
	if site == "" {
		site = "unified"
	}

	// Get problems from last 5 minutes
	cutoff := time.Now().Add(-5 * time.Minute)

	var results interface{}

	switch site {
	case "cn":
		var counts []models.OnlineCountCN
		subQuery := db.Table("online_counts_cn").
			Select("frontend_id, MAX(timestamp) as max_time").
			Group("frontend_id")
		if err := db.Table("online_counts_cn AS oc").
			Joins("INNER JOIN (?) AS latest ON oc.frontend_id = latest.frontend_id AND oc.timestamp = latest.max_time", subQuery).
			Where("oc.timestamp > ?", cutoff).
			Find(&counts).Error; err != nil {
			Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		results = counts
	case "com":
		var counts []models.OnlineCountCOM
		subQuery := db.Table("online_counts_com").
			Select("frontend_id, MAX(timestamp) as max_time").
			Group("frontend_id")
		if err := db.Table("online_counts_com AS oc").
			Joins("INNER JOIN (?) AS latest ON oc.frontend_id = latest.frontend_id AND oc.timestamp = latest.max_time", subQuery).
			Where("oc.timestamp > ?", cutoff).
			Find(&counts).Error; err != nil {
			Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		results = counts
	default:
		var counts []models.OnlineCountUnified
		subQuery := db.Table("online_counts_unified").
			Select("frontend_id, MAX(timestamp) as max_time").
			Group("frontend_id")
		if err := db.Table("online_counts_unified AS oc").
			Joins("INNER JOIN (?) AS latest ON oc.frontend_id = latest.frontend_id AND oc.timestamp = latest.max_time", subQuery).
			Where("oc.timestamp > ?", cutoff).
			Find(&counts).Error; err != nil {
			Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		results = counts
	}

	Success(c, results)
}
