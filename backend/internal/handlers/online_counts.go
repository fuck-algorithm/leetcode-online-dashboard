package handlers

import (
	"fmt"
	"log"
	"net/http"
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

// bucketInterval 根据时间跨度选择聚合桶粒度，保证返回点数在可渲染范围（≤~2000 点）。
// bucket 只会从本函数产生，均为 PostgreSQL date_bin 合法 interval 字面量（白名单，无注入风险）。
func bucketInterval(d time.Duration) string {
	switch {
	case d <= 6*time.Hour:
		return "1 minute"
	case d <= 48*time.Hour:
		return "5 minutes"
	case d <= 7*24*time.Hour:
		return "15 minutes"
	case d <= 30*24*time.Hour:
		return "1 hour"
	case d <= 180*24*time.Hour:
		return "6 hours"
	default:
		return "12 hours"
	}
}

// queryOnlineCounts 查询单题历史在线人数（含时间过滤 + 自动聚合），供多个 handler 复用。
// 返回 []map[string]interface{}，元素含 timestamp / count / count_cn / count_com。
// bucket 参数只能来自 bucketInterval 白名单，SQL 拼接无注入风险。
func queryOnlineCounts(db *gorm.DB, frontendID, site string, start, end time.Time) ([]map[string]interface{}, error) {
	span := end.Sub(start)
	if span <= 0 {
		span = time.Hour
	}
	bucket := bucketInterval(span)

	// 时间范围 ≥ 2× 桶粒度时才聚合；否则直接返回窗口内原始记录（避免短窗口聚合失真）。
	// 短窗口仍走统一查询，保证响应结构一致。
	bucketed := span >= 2*minBucketDuration(bucket)

	var cnExpr, comExpr, totalExpr string
	table := "online_counts_unified"
	switch site {
	case "cn":
		table = "online_counts_cn"
		cnExpr = "ROUND(AVG(count))::int"
		comExpr = "0"
		totalExpr = "ROUND(AVG(count))::int"
	case "com":
		table = "online_counts_com"
		cnExpr = "0"
		comExpr = "ROUND(AVG(count))::int"
		totalExpr = "ROUND(AVG(count))::int"
	default:
		cnExpr = "ROUND(AVG(count_cn))::int"
		comExpr = "ROUND(AVG(count_com))::int"
		totalExpr = "ROUND(AVG(count_total))::int"
	}

	if !bucketed {
		switch site {
		case "cn":
			var cnRows []models.OnlineCountCN
			if err := db.Where("frontend_id = ? AND timestamp >= ? AND timestamp <= ?", frontendID, start, end).
				Order("timestamp ASC").Find(&cnRows).Error; err != nil {
				return nil, err
			}
			result := make([]map[string]interface{}, 0, len(cnRows))
			for _, r := range cnRows {
				result = append(result, map[string]interface{}{
					"timestamp": r.Timestamp,
					"count":     r.Count,
					"count_cn":  r.Count,
					"count_com": 0,
				})
			}
			return result, nil
		case "com":
			var comRows []models.OnlineCountCOM
			if err := db.Where("frontend_id = ? AND timestamp >= ? AND timestamp <= ?", frontendID, start, end).
				Order("timestamp ASC").Find(&comRows).Error; err != nil {
				return nil, err
			}
			result := make([]map[string]interface{}, 0, len(comRows))
			for _, r := range comRows {
				result = append(result, map[string]interface{}{
					"timestamp": r.Timestamp,
					"count":     r.Count,
					"count_cn":  0,
					"count_com": r.Count,
				})
			}
			return result, nil
		default:
			// all / unified：直接查 unified 表，一次拿到 CN/COM/Total
			var rows []models.OnlineCountUnified
			if err := db.Where("frontend_id = ? AND timestamp >= ? AND timestamp <= ?", frontendID, start, end).
				Order("timestamp ASC").Find(&rows).Error; err != nil {
				return nil, err
			}
			result := make([]map[string]interface{}, 0, len(rows))
			for _, r := range rows {
				result = append(result, map[string]interface{}{
					"timestamp": r.Timestamp,
					"count":     r.CountTotal,
					"count_cn":  r.CountCN,
					"count_com": r.CountCOM,
				})
			}
			return result, nil
		}
	}

	// 聚合查询：date_bin 按桶分组取平均值。
	sqlQuery := fmt.Sprintf(
		`SELECT date_bin(interval '%s', timestamp, TIMESTAMPTZ '2000-01-01') AS bucket,
		 %s AS count_cn, %s AS count_com, %s AS count_total
		 FROM %s
		 WHERE frontend_id = ? AND timestamp >= ? AND timestamp <= ?
		 GROUP BY bucket ORDER BY bucket ASC`,
		bucket, cnExpr, comExpr, totalExpr, table)
	type bucketRow struct {
		Bucket     time.Time
		CountCN    int
		CountCOM   int
		CountTotal int
	}
	var rows []bucketRow
	if err := db.Raw(sqlQuery, frontendID, start, end).Scan(&rows).Error; err != nil {
		return nil, err
	}
	result := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		result = append(result, map[string]interface{}{
			"timestamp": r.Bucket,
			"count":     r.CountTotal,
			"count_cn":  r.CountCN,
			"count_com": r.CountCOM,
		})
	}
	return result, nil
}

// GetOnlineCounts returns online count history for a problem
// 支持同时返回 CN/COM/Total 三个数据，减少前端请求次数。
//
// 参数：
//   - startTime / endTime：精确时间（2006-01-02 15:04:05，本地时区），同时给出时按时间范围过滤并自动聚合；
//   - hours：没有时间范围时的回看窗口（默认 24）；
//   - limit：无时间范围时返回最近 limit 条原始记录（默认 100，兼容旧调用）；
//   - site：cn / com / unified / all（默认 all，直接查 unified 单表即可拿到 CN/COM/Total 三值）。
func GetOnlineCounts(c *gin.Context) {
	db := database.GetDB()
	problemID := c.Param("id")

	// Resolve problem ID (support both numeric and slug formats)
	frontendID, err := resolveProblemID(db, problemID)
	if err != nil {
		Error(c, http.StatusNotFound, "Problem not found")
		return
	}

	limit := 100
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 10000 {
			limit = parsed
		}
	}

	site := c.Query("site")
	if site == "" {
		site = "all"
	}

	// 解析时间范围：startTime/endTime 优先，其次 hours 回看窗口
	start, end := parseTimeRange(c)
	span := end.Sub(start)

	// 无显式时间范围时：保持旧语义，返回最近 limit 条原始记录（兼容 Skills 页 curl 示例等）
	hasExplicitRange := c.Query("startTime") != "" && c.Query("endTime") != ""
	if !hasExplicitRange && c.Query("hours") == "" && span >= 24*time.Hour {
		result, err := queryOnlineCounts(db, frontendID, site, start, end)
		if err != nil {
			Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		// 截断到最近 limit 条（已是 ASC 排序，取末尾）
		if len(result) > limit {
			result = result[len(result)-limit:]
		}
		Success(c, result)
		return
	}

	result, err := queryOnlineCounts(db, frontendID, site, start, end)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	Success(c, result)
}

// minBucketDuration 返回 interval 字符串对应的最短时长（用于判断是否值得聚合）
func minBucketDuration(bucket string) time.Duration {
	switch bucket {
	case "1 minute":
		return time.Minute
	case "5 minutes":
		return 5 * time.Minute
	case "15 minutes":
		return 15 * time.Minute
	case "1 hour":
		return time.Hour
	case "6 hours":
		return 6 * time.Hour
	default:
		return 12 * time.Hour
	}
}

// parseTimeRange 解析 startTime/endTime（精确到秒）或 hours（回看窗口）。
func parseTimeRange(c *gin.Context) (start, end time.Time) {
	startTimeStr := c.Query("startTime")
	endTimeStr := c.Query("endTime")
	if startTimeStr != "" && endTimeStr != "" {
		if s, err := time.ParseInLocation("2006-01-02 15:04:05", startTimeStr, time.Local); err == nil {
			start = s
		}
		if e, err := time.ParseInLocation("2006-01-02 15:04:05", endTimeStr, time.Local); err == nil {
			end = e
		}
	}
	if start.IsZero() || end.IsZero() {
		hours := 24
		if h, err := strconv.Atoi(c.Query("hours")); err == nil && h > 0 && h <= 24*730 {
			hours = h
		}
		end = time.Now()
		start = end.Add(-time.Duration(hours) * time.Hour)
	}
	if end.Before(start) {
		start, end = end, start
	}
	return start, end
}

// GetOnlineCountsByQuery returns online count history for a problem using query param
// 支持同时返回 CN/COM/Total 三个数据，减少前端请求次数。
// 与 GetOnlineCounts 共享同一套时间过滤 + 自动聚合逻辑（queryOnlineCounts）。
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

	limit := 1000
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	// 解析时间范围：startTime/endTime 精确到秒；startDate/endDate 兼容旧版日期格式；
	// 都没有时用 hours 回看窗口（默认 24）。
	start, end := parseTimeRange(c)
	if sd := c.Query("startDate"); sd != "" && c.Query("startTime") == "" {
		if s, err := time.Parse("2006-01-02", sd); err == nil {
			start = s
		}
	}
	if ed := c.Query("endDate"); ed != "" && c.Query("endTime") == "" {
		if e, err := time.Parse("2006-01-02", ed); err == nil {
			end = e.Add(24*time.Hour - time.Second)
		}
	}
	if end.Before(start) {
		start, end = end, start
	}

	site := c.Query("site")
	if site == "" {
		site = "all"
	}

	result, err := queryOnlineCounts(db, frontendID, site, start, end)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	// 兼容旧语义：无显式时间范围时截断到最近 limit 条（已是 ASC 排序，取末尾）
	if c.Query("startTime") == "" && c.Query("startDate") == "" && len(result) > limit {
		result = result[len(result)-limit:]
	}
	Success(c, result)
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
