package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
)

// ExportData handles data export requests - exports unified data (CN + COM)
func ExportData(c *gin.Context) {
	format := c.Query("format")
	if format == "" {
		format = "json"
	}

	problemID := c.Query("problem_id")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	site := c.Query("site") // Optional: "cn", "com", or empty for unified

	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not available"})
		return
	}

	// Build query based on site filter
	var query interface{}
	switch site {
	case "cn":
		query = db.Model(&models.OnlineCountCN{})
	case "com":
		query = db.Model(&models.OnlineCountCOM{})
	default:
		query = db.Model(&models.OnlineCountUnified{})
	}

	// Support both numeric frontend_id and slug for problem_id
	if problemID != "" {
		frontendID, err := resolveProblemID(db, problemID)
		if err != nil {
			Error(c, http.StatusNotFound, "Problem not found")
			return
		}
		query = query.(interface{ Where(interface{}, ...interface{}) interface{} }).Where("frontend_id = ?", frontendID)
	}

	if startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			query = query.(interface{ Where(interface{}, ...interface{}) interface{} }).Where("timestamp >= ?", t)
		}
	}

	if endDate != "" {
		if t, err := time.Parse("2006-01-02", endDate); err == nil {
			query = query.(interface{ Where(interface{}, ...interface{}) interface{} }).Where("timestamp <= ?", t)
		}
	}

	// Fetch data based on site
	switch site {
	case "cn":
		var counts []models.OnlineCountCN
		if result := query.(*gorm.DB).Find(&counts); result.Error != nil {
			Error(c, http.StatusInternalServerError, result.Error.Error())
			return
		}
		exportSiteData(c, format, counts, site)
	case "com":
		var counts []models.OnlineCountCOM
		if result := query.(*gorm.DB).Find(&counts); result.Error != nil {
			Error(c, http.StatusInternalServerError, result.Error.Error())
			return
		}
		exportSiteData(c, format, counts, site)
	default:
		var counts []models.OnlineCountUnified
		if result := query.(*gorm.DB).Find(&counts); result.Error != nil {
			Error(c, http.StatusInternalServerError, result.Error.Error())
			return
		}
		exportUnifiedData(c, format, counts)
	}
}

// exportUnifiedData exports unified data as JSON or CSV
func exportUnifiedData(c *gin.Context, format string, counts []models.OnlineCountUnified) {
	switch format {
	case "csv":
		exportUnifiedCSV(c, counts)
	case "json":
		exportUnifiedJSON(c, counts)
	default:
		Error(c, http.StatusBadRequest, "Unsupported format. Use 'json' or 'csv'")
	}
}

// exportSiteData exports site-specific data as JSON or CSV
func exportSiteData(c *gin.Context, format string, counts interface{}, site string) {
	switch format {
	case "csv":
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=export_%s_%d.csv", site, time.Now().Unix()))
		writer := csv.NewWriter(c.Writer)
		defer writer.Flush()
		writer.Write([]string{"ID", "FrontendID", "Count", "Timestamp"})
		
		switch data := counts.(type) {
		case []models.OnlineCountCN:
			for _, count := range data {
				writer.Write([]string{
					fmt.Sprintf("%d", count.ID),
					count.FrontendID,
					fmt.Sprintf("%d", count.Count),
					count.Timestamp.Format(time.RFC3339),
				})
			}
		case []models.OnlineCountCOM:
			for _, count := range data {
				writer.Write([]string{
					fmt.Sprintf("%d", count.ID),
					count.FrontendID,
					fmt.Sprintf("%d", count.Count),
					count.Timestamp.Format(time.RFC3339),
				})
			}
		}
	case "json":
		c.Header("Content-Type", "application/json")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=export_%s_%d.json", site, time.Now().Unix()))
		c.JSON(http.StatusOK, gin.H{
			"exported_at": time.Now(),
			"site":        site,
			"count":       len(counts.([]models.OnlineCountCN)),
			"data":        counts,
		})
	default:
		Error(c, http.StatusBadRequest, "Unsupported format")
	}
}

// exportUnifiedJSON exports unified data as JSON
func exportUnifiedJSON(c *gin.Context, counts []models.OnlineCountUnified) {
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=export_unified_%d.json", time.Now().Unix()))
	c.JSON(http.StatusOK, gin.H{
		"exported_at": time.Now(),
		"count":       len(counts),
		"data":        counts,
	})
}

// exportUnifiedCSV exports unified data as CSV
func exportUnifiedCSV(c *gin.Context, counts []models.OnlineCountUnified) {
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=export_unified_%d.csv", time.Now().Unix()))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// Write header with CN and COM columns
	writer.Write([]string{"ID", "FrontendID", "CountCN", "CountCOM", "CountTotal", "Timestamp"})

	// Write data
	for _, count := range counts {
		writer.Write([]string{
			fmt.Sprintf("%d", count.ID),
			count.FrontendID,
			fmt.Sprintf("%d", count.CountCN),
			fmt.Sprintf("%d", count.CountCOM),
			fmt.Sprintf("%d", count.CountTotal),
			count.Timestamp.Format(time.RFC3339),
		})
	}
}

// GetExportStats returns export statistics for all sites
func GetExportStats(c *gin.Context) {
	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not available"})
		return
	}

	var cnRecords, comRecords, unifiedRecords int64
	db.Model(&models.OnlineCountCN{}).Count(&cnRecords)
	db.Model(&models.OnlineCountCOM{}).Count(&comRecords)
	db.Model(&models.OnlineCountUnified{}).Count(&unifiedRecords)

	var oldestRecord time.Time
	db.Model(&models.OnlineCountCN{}).Select("MIN(timestamp)").Scan(&oldestRecord)

	var newestRecord time.Time
	db.Model(&models.OnlineCountCN{}).Select("MAX(timestamp)").Scan(&newestRecord)

	Success(c, gin.H{
		"cn_records":        cnRecords,
		"com_records":       comRecords,
		"unified_records":   unifiedRecords,
		"total_records":     cnRecords + comRecords + unifiedRecords,
		"oldest_record":     oldestRecord,
		"newest_record":     newestRecord,
		"available_formats": []string{"json", "csv"},
		"available_sites":   []string{"cn", "com", "unified"},
	})
}
