package database

import (
	"log"
	"os"
	"strconv"
	"time"

	"leetcode-dashboard/internal/models"
	"gorm.io/gorm"
)

// DataRetentionPolicy manages data cleanup policies
type DataRetentionPolicy struct {
	DB               *gorm.DB
	RetentionDays    int
	CleanupInterval  time.Duration
	stopChan         chan struct{}
}

// NewDataRetentionPolicy creates a new retention policy manager
func NewDataRetentionPolicy(db *gorm.DB, retentionDays int) *DataRetentionPolicy {
	if retentionDays <= 0 {
		retentionDays = getEnvInt("DATA_RETENTION_DAYS", 30)
	}
	return &DataRetentionPolicy{
		DB:              db,
		RetentionDays:   retentionDays,
		CleanupInterval: 24 * time.Hour, // Run cleanup daily
		stopChan:        make(chan struct{}),
	}
}

// Start begins the periodic cleanup routine
func (p *DataRetentionPolicy) Start() {
	go p.cleanupRoutine()
	log.Printf("Data retention policy started (retention: %d days)", p.RetentionDays)
}

// Stop stops the cleanup routine
func (p *DataRetentionPolicy) Stop() {
	close(p.stopChan)
	log.Println("Data retention policy stopped")
}

// cleanupRoutine runs cleanup periodically
func (p *DataRetentionPolicy) cleanupRoutine() {
	ticker := time.NewTicker(p.CleanupInterval)
	defer ticker.Stop()

	// Run immediately on start
	p.Cleanup()

	for {
		select {
		case <-p.stopChan:
			return
		case <-ticker.C:
			p.Cleanup()
		}
	}
}

// Cleanup removes old records based on retention policy
func (p *DataRetentionPolicy) Cleanup() {
	cutoffTime := time.Now().AddDate(0, 0, -p.RetentionDays)

	// Clean up old online counts for CN site
	result := p.DB.Where("timestamp < ?", cutoffTime).Delete(&models.OnlineCountCN{})
	if result.Error != nil {
		log.Printf("Error cleaning up old CN online counts: %v", result.Error)
	} else {
		log.Printf("Cleaned up %d old CN online count records", result.RowsAffected)
	}

	// Clean up old online counts for COM site
	result = p.DB.Where("timestamp < ?", cutoffTime).Delete(&models.OnlineCountCOM{})
	if result.Error != nil {
		log.Printf("Error cleaning up old COM online counts: %v", result.Error)
	} else {
		log.Printf("Cleaned up %d old COM online count records", result.RowsAffected)
	}

	// Clean up old unified online counts
	result = p.DB.Where("timestamp < ?", cutoffTime).Delete(&models.OnlineCountUnified{})
	if result.Error != nil {
		log.Printf("Error cleaning up old unified online counts: %v", result.Error)
	} else {
		log.Printf("Cleaned up %d old unified online count records", result.RowsAffected)
	}
}

// CleanupByFrontendID removes all data for a specific problem
func (p *DataRetentionPolicy) CleanupByFrontendID(frontendID string) error {
	// Clean up CN site data
	result := p.DB.Where("frontend_id = ?", frontendID).Delete(&models.OnlineCountCN{})
	if result.Error != nil {
		return result.Error
	}
	// Clean up COM site data
	result = p.DB.Where("frontend_id = ?", frontendID).Delete(&models.OnlineCountCOM{})
	if result.Error != nil {
		return result.Error
	}
	// Clean up unified data
	result = p.DB.Where("frontend_id = ?", frontendID).Delete(&models.OnlineCountUnified{})
	return result.Error
}

// GetStorageStats returns storage statistics
func (p *DataRetentionPolicy) GetStorageStats() map[string]interface{} {
	var cnOnlineCount, comOnlineCount, unifiedOnlineCount int64
	p.DB.Model(&models.OnlineCountCN{}).Count(&cnOnlineCount)
	p.DB.Model(&models.OnlineCountCOM{}).Count(&comOnlineCount)
	p.DB.Model(&models.OnlineCountUnified{}).Count(&unifiedOnlineCount)

	var problemCount int64
	p.DB.Model(&models.Problem{}).Count(&problemCount)

	// Get oldest and newest records from CN (should be similar for both sites)
	var oldestRecordCN, newestRecordCN models.OnlineCountCN
	var oldestTime, newestTime time.Time

	if err := p.DB.Order("timestamp ASC").First(&oldestRecordCN).Error; err == nil {
		oldestTime = oldestRecordCN.Timestamp
	}
	if err := p.DB.Order("timestamp DESC").First(&newestRecordCN).Error; err == nil {
		newestTime = newestRecordCN.Timestamp
	}

	totalRecords := cnOnlineCount + comOnlineCount + unifiedOnlineCount

	return map[string]interface{}{
		"online_count_cn_records":      cnOnlineCount,
		"online_count_com_records":       comOnlineCount,
		"online_count_unified_records": unifiedOnlineCount,
		"online_count_total_records":   totalRecords,
		"problem_records":              problemCount,
		"retention_days":             p.RetentionDays,
		"oldest_record":              oldestTime,
		"newest_record":              newestTime,
	}
}

// getEnvInt gets environment variable as integer
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

