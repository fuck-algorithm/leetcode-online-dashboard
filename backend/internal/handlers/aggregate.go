package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
)

type AggregatePoint struct {
	Timestamp time.Time `json:"timestamp"`
	Total     int       `json:"total"`
}

// GetTotalOnlineCountHistory returns the total online count from pre-aggregated table
// Returns data with cn, com, and total fields for chart display
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

	// Data point with all three dimensions
	type TotalOnlineDataPoint struct {
		Timestamp time.Time `json:"timestamp"`
		Total     int       `json:"total"`
		CN        int       `json:"cn"`
		COM       int       `json:"com"`
	}

	// Query all three tables
	var cnAggregates []models.TotalOnlineAggregateCN
	var comAggregates []models.TotalOnlineAggregateCOM
	var unifiedAggregates []models.TotalOnlineAggregateUnified

	// Query CN data
	if err := db.Where("timestamp >= ?", cutoff).
		Order("timestamp ASC").
		Find(&cnAggregates).Error; err != nil {
		Error(c, http.StatusInternalServerError, "Failed to query CN aggregate history: "+err.Error())
		return
	}

	// Query COM data
	if err := db.Where("timestamp >= ?", cutoff).
		Order("timestamp ASC").
		Find(&comAggregates).Error; err != nil {
		Error(c, http.StatusInternalServerError, "Failed to query COM aggregate history: "+err.Error())
		return
	}

	// Query Unified data (contains total)
	if err := db.Where("timestamp >= ?", cutoff).
		Order("timestamp ASC").
		Find(&unifiedAggregates).Error; err != nil {
		Error(c, http.StatusInternalServerError, "Failed to query unified aggregate history: "+err.Error())
		return
	}

	// Build maps for quick lookup
	cnMap := make(map[time.Time]int)
	comMap := make(map[time.Time]int)
	totalMap := make(map[time.Time]int)

	for _, agg := range cnAggregates {
		cnMap[agg.Timestamp.Truncate(time.Minute)] = agg.Total
	}
	for _, agg := range comAggregates {
		comMap[agg.Timestamp.Truncate(time.Minute)] = agg.Total
	}
	for _, agg := range unifiedAggregates {
		totalMap[agg.Timestamp.Truncate(time.Minute)] = agg.Total
	}

	// Fill in missing minutes with values from all three sources
	var filledResults []TotalOnlineDataPoint
	now := time.Now()
	current := cutoff.Truncate(time.Minute)

	for current.Before(now) || current.Equal(now) {
		point := TotalOnlineDataPoint{
			Timestamp: current,
			Total:     0,
			CN:        0,
			COM:       0,
		}

		// Get values from maps
		if val, ok := cnMap[current]; ok {
			point.CN = val
		}
		if val, ok := comMap[current]; ok {
			point.COM = val
		}
		if val, ok := totalMap[current]; ok {
			point.Total = val
		} else {
			// If total not stored, calculate from CN + COM
			point.Total = point.CN + point.COM
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

	// Parse site parameter
	site := c.Query("site")
	if site == "" {
		site = "unified"
	}

	var results []AggregatePoint

	// Query from pre-aggregated table based on granularity and site
	switch granularity {
	case "minute":
		// Query minute-level data directly from aggregate table based on site
		switch site {
		case "cn":
			var aggregates []models.TotalOnlineAggregateCN
			if err := db.Where("timestamp >= ? AND timestamp <= ?", startTime, endTime).
				Order("timestamp ASC").
				Find(&aggregates).Error; err != nil {
				Error(c, http.StatusInternalServerError, "Failed to query CN aggregate data: "+err.Error())
				return
			}
			for _, agg := range aggregates {
				results = append(results, AggregatePoint{
					Timestamp: agg.Timestamp,
					Total:     agg.Total,
				})
			}
		case "com":
			var aggregates []models.TotalOnlineAggregateCOM
			if err := db.Where("timestamp >= ? AND timestamp <= ?", startTime, endTime).
				Order("timestamp ASC").
				Find(&aggregates).Error; err != nil {
				Error(c, http.StatusInternalServerError, "Failed to query COM aggregate data: "+err.Error())
				return
			}
			for _, agg := range aggregates {
				results = append(results, AggregatePoint{
					Timestamp: agg.Timestamp,
					Total:     agg.Total,
				})
			}
		default:
			var aggregates []models.TotalOnlineAggregateUnified
			if err := db.Where("timestamp >= ? AND timestamp <= ?", startTime, endTime).
				Order("timestamp ASC").
				Find(&aggregates).Error; err != nil {
				Error(c, http.StatusInternalServerError, "Failed to query unified aggregate data: "+err.Error())
				return
			}
			for _, agg := range aggregates {
				results = append(results, AggregatePoint{
					Timestamp: agg.Timestamp,
					Total:     agg.Total,
				})
			}
		}
	case "hour":
		results = queryHourlyAggregate(db, site, startTime, endTime)
	case "day":
		results = queryDailyAggregate(db, site, startTime, endTime)
	}

	Success(c, gin.H{
		"granularity": granularity,
		"start_time":  startTime.Format(time.RFC3339),
		"end_time":    endTime.Format(time.RFC3339),
		"points":      len(results),
		"data":        results,
	})
}

func queryHourlyAggregate(db *gorm.DB, site string, startTime, endTime time.Time) []AggregatePoint {
	type HourlyAggregate struct {
		HourBucket time.Time
		Total      int
	}
	var hourlyResults []HourlyAggregate
	
	var tableName string
	switch site {
	case "cn":
		tableName = "total_online_aggregates_cn"
	case "com":
		tableName = "total_online_aggregates_com"
	default:
		tableName = "total_online_aggregates_unified"
	}
	
	rawSQL := fmt.Sprintf(`
		SELECT 
			hour_bucket,
			AVG(total) as total
		FROM %s
		WHERE hour_bucket >= ? AND hour_bucket <= ?
		GROUP BY hour_bucket
		ORDER BY hour_bucket ASC
	`, tableName)
	
	var results []AggregatePoint
	
	if err := db.Raw(rawSQL, startTime.Truncate(time.Hour), endTime.Truncate(time.Hour)).Scan(&hourlyResults).Error; err != nil {
		// Fallback: query all and aggregate in memory
		return queryMinuteAsFallback(db, site, startTime, endTime)
	}
	
	for _, hr := range hourlyResults {
		results = append(results, AggregatePoint{
			Timestamp: hr.HourBucket,
			Total:     hr.Total,
		})
	}
	return results
}

func queryDailyAggregate(db *gorm.DB, site string, startTime, endTime time.Time) []AggregatePoint {
	type DailyAggregate struct {
		DayBucket time.Time
		Total     int
	}
	var dailyResults []DailyAggregate
	
	var tableName string
	switch site {
	case "cn":
		tableName = "total_online_aggregates_cn"
	case "com":
		tableName = "total_online_aggregates_com"
	default:
		tableName = "total_online_aggregates_unified"
	}
	
	rawSQL := fmt.Sprintf(`
		SELECT 
			day_bucket,
			AVG(total) as total
		FROM %s
		WHERE day_bucket >= ? AND day_bucket <= ?
		GROUP BY day_bucket
		ORDER BY day_bucket ASC
	`, tableName)
	
	var results []AggregatePoint
	
	if err := db.Raw(rawSQL, time.Date(startTime.Year(), startTime.Month(), startTime.Day(), 0, 0, 0, 0, startTime.Location()),
		time.Date(endTime.Year(), endTime.Month(), endTime.Day(), 0, 0, 0, 0, endTime.Location())).Scan(&dailyResults).Error; err != nil {
		// Fallback: query all and aggregate in memory
		return queryMinuteAsFallback(db, site, startTime, endTime)
	}
	
	for _, dr := range dailyResults {
		results = append(results, AggregatePoint{
			Timestamp: dr.DayBucket,
			Total:     dr.Total,
		})
	}
	return results
}

func queryMinuteAsFallback(db *gorm.DB, site string, startTime, endTime time.Time) []AggregatePoint {
	var results []AggregatePoint
	
	switch site {
	case "cn":
		var aggregates []models.TotalOnlineAggregateCN
		if err := db.Where("timestamp >= ? AND timestamp <= ?", startTime, endTime).
			Order("timestamp ASC").
			Find(&aggregates).Error; err != nil {
			return results
		}
		for _, agg := range aggregates {
			results = append(results, AggregatePoint{
				Timestamp: agg.Timestamp,
				Total:     agg.Total,
			})
		}
	case "com":
		var aggregates []models.TotalOnlineAggregateCOM
		if err := db.Where("timestamp >= ? AND timestamp <= ?", startTime, endTime).
			Order("timestamp ASC").
			Find(&aggregates).Error; err != nil {
			return results
		}
		for _, agg := range aggregates {
			results = append(results, AggregatePoint{
				Timestamp: agg.Timestamp,
				Total:     agg.Total,
			})
		}
	default:
		var aggregates []models.TotalOnlineAggregateUnified
		if err := db.Where("timestamp >= ? AND timestamp <= ?", startTime, endTime).
			Order("timestamp ASC").
			Find(&aggregates).Error; err != nil {
			return results
		}
		for _, agg := range aggregates {
			results = append(results, AggregatePoint{
				Timestamp: agg.Timestamp,
				Total:     agg.Total,
			})
		}
	}
	return results
}
