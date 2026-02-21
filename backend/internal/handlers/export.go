package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
)

// ExportData handles data export requests
func ExportData(c *gin.Context) {
	format := c.Query("format")
	if format == "" {
		format = "json"
	}

	problemID := c.Query("problem_id")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not available"})
		return
	}

	// Build query
	query := db.Model(&models.OnlineCount{})

	// Support both numeric frontend_id and slug for problem_id
	if problemID != "" {
		frontendID, err := resolveProblemID(db, problemID)
		if err != nil {
			Error(c, http.StatusNotFound, "Problem not found")
			return
		}
		query = query.Where("frontend_id = ?", frontendID)
	}

	if startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			query = query.Where("timestamp >= ?", t)
		}
	}

	if endDate != "" {
		if t, err := time.Parse("2006-01-02", endDate); err == nil {
			query = query.Where("timestamp <= ?", t)
		}
	}

	// Fetch data
	var counts []models.OnlineCount
	if result := query.Find(&counts); result.Error != nil {
		Error(c, http.StatusInternalServerError, result.Error.Error())
		return
	}

	// Export based on format
	switch format {
	case "csv":
		exportCSV(c, counts)
	case "json":
		exportJSON(c, counts)
	default:
		Error(c, http.StatusBadRequest, "Unsupported format. Use 'json' or 'csv'")
	}
}

// exportJSON exports data as JSON (不包装为code/msg格式，直接返回数据)
func exportJSON(c *gin.Context, counts []models.OnlineCount) {
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=export_%d.json", time.Now().Unix()))
	c.JSON(http.StatusOK, gin.H{
		"exported_at": time.Now(),
		"count":       len(counts),
		"data":        counts,
	})
}

// exportCSV exports data as CSV
func exportCSV(c *gin.Context, counts []models.OnlineCount) {
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=export_%d.csv", time.Now().Unix()))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// Write header
	writer.Write([]string{"ID", "FrontendID", "Count", "Timestamp"})

	// Write data
	for _, count := range counts {
		writer.Write([]string{
			fmt.Sprintf("%d", count.ID),
			count.FrontendID,
			fmt.Sprintf("%d", count.Count),
			count.Timestamp.Format(time.RFC3339),
		})
	}
}

// GetExportStats returns export statistics
func GetExportStats(c *gin.Context) {
	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not available"})
		return
	}

	var totalRecords int64
	db.Model(&models.OnlineCount{}).Count(&totalRecords)

	var oldestRecord time.Time
	db.Model(&models.OnlineCount{}).Select("MIN(timestamp)").Scan(&oldestRecord)

	var newestRecord time.Time
	db.Model(&models.OnlineCount{}).Select("MAX(timestamp)").Scan(&newestRecord)

	Success(c, gin.H{
		"total_records":     totalRecords,
		"oldest_record":     oldestRecord,
		"newest_record":     newestRecord,
		"available_formats": []string{"json", "csv"},
	})
}
