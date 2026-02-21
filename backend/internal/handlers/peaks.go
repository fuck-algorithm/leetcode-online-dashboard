package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"leetcode-dashboard/internal/database"
)

// PeakDetectionResult holds peak detection results
type PeakDetectionResult struct {
	FrontendID   string    `json:"frontend_id"`
	ProblemSlug  string    `json:"problem_slug"`
	ProblemTitle string    `json:"problem_title"`
	PeakCount    int       `json:"peak_count"`
	PeakTime     time.Time `json:"peak_time"`
	AverageCount float64   `json:"average_count"`
}

// GetPeakOnlineTimes returns peak online times for problems
func GetPeakOnlineTimes(c *gin.Context) {
	db := database.GetDB()
	if db == nil {
		Error(c, http.StatusInternalServerError, "Database not available")
		return
	}

	// Query to find peak counts per problem
	var results []struct {
		FrontendID   string
		ProblemSlug  string
		ProblemTitle string
		PeakCount    int
		PeakTime     time.Time
	}

	err := db.Raw(`
		SELECT 
			p.frontend_id as frontend_id,
			p.slug as problem_slug,
			p.title as problem_title,
			MAX(oc.count) as peak_count,
			(SELECT timestamp FROM online_counts oc2 
			 WHERE oc2.frontend_id = p.frontend_id AND oc2.count = MAX(oc.count) 
			 ORDER BY timestamp DESC LIMIT 1) as peak_time
		FROM problems p
		JOIN online_counts oc ON p.frontend_id = oc.frontend_id
		WHERE oc.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
		GROUP BY p.frontend_id, p.slug, p.title
		ORDER BY peak_count DESC
		LIMIT 20
	`).Scan(&results).Error

	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Format response
	var peaks []PeakDetectionResult
	for _, r := range results {
		peaks = append(peaks, PeakDetectionResult{
			FrontendID:   r.FrontendID,
			ProblemSlug:  r.ProblemSlug,
			ProblemTitle: r.ProblemTitle,
			PeakCount:    r.PeakCount,
			PeakTime:     r.PeakTime,
		})
	}

	Success(c, gin.H{
		"peaks":      peaks,
		"time_range": "last_7_days",
		"generated":  time.Now(),
	})
}

// GetProblemPeakHistory returns peak history for a specific problem
func GetProblemPeakHistory(c *gin.Context) {
	problemID := c.Param("id")
	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not available"})
		return
	}

	// Resolve problem ID (support both numeric and slug formats)
	frontendID, err := resolveProblemID(db, problemID)
	if err != nil {
		Error(c, http.StatusNotFound, "Problem not found")
		return
	}

	// Daily peaks for the last 30 days
	var dailyPeaks []struct {
		Date      time.Time `json:"date"`
		PeakCount int       `json:"peak_count"`
		AvgCount  float64   `json:"avg_count"`
	}

	err = db.Raw(`
		SELECT 
			DATE(timestamp) as date,
			MAX(count) as peak_count,
			AVG(count) as avg_count
		FROM online_counts
		WHERE frontend_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
		GROUP BY DATE(timestamp)
		ORDER BY date DESC
	`, frontendID).Scan(&dailyPeaks).Error

	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{
		"frontend_id": frontendID,
		"daily_peaks": dailyPeaks,
		"days":        len(dailyPeaks),
	})
}

// DetectAnomalies detects unusual spikes in online counts
func DetectAnomalies(c *gin.Context) {
	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not available"})
		return
	}

	// Find problems with unusual spikes (>2 standard deviations)
	var anomalies []struct {
		FrontendID  string    `json:"frontend_id"`
		ProblemSlug string    `json:"problem_slug"`
		Current     int       `json:"current"`
		Average     float64   `json:"average"`
		StdDev      float64   `json:"std_dev"`
		Timestamp   time.Time `json:"timestamp"`
	}

	err := db.Raw(`
		WITH stats AS (
			SELECT 
				frontend_id,
				AVG(count) as avg_count,
				STDDEV(count) as std_dev
			FROM online_counts
			WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
			GROUP BY frontend_id
		),
		latest AS (
			SELECT 
				frontend_id,
				count,
				timestamp,
				ROW_NUMBER() OVER (PARTITION BY frontend_id ORDER BY timestamp DESC) as rn
			FROM online_counts
		)
		SELECT 
			l.frontend_id,
			p.slug as problem_slug,
			l.count as current,
			s.avg_count as average,
			s.std_dev,
			l.timestamp
		FROM latest l
		JOIN stats s ON l.frontend_id = s.frontend_id
		JOIN problems p ON l.frontend_id = p.frontend_id
		WHERE l.rn = 1
		AND l.count > (s.avg_count + 2 * s.std_dev)
		ORDER BY (l.count - s.avg_count) / s.std_dev DESC
	`).Scan(&anomalies).Error

	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, gin.H{
		"anomalies":   anomalies,
		"threshold":   "2_sigma",
		"detected_at": time.Now(),
	})
}
