package database

import (
	"log"
	"time"

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

	// Clean up old online counts
	result := p.DB.Where("timestamp < ?", cutoffTime).Delete(&OnlineCount{})
	if result.Error != nil {
		log.Printf("Error cleaning up old online counts: %v", result.Error)
	} else {
		log.Printf("Cleaned up %d old online count records", result.RowsAffected)
	}

	// Clean up old statistics (if implemented)
	// result = p.DB.Where("date < ?", cutoffTime).Delete(&DailyStats{})
}

// CleanupByProblem removes all data for a specific problem
func (p *DataRetentionPolicy) CleanupByProblem(problemID uint) error {
	result := p.DB.Where("problem_id = ?", problemID).Delete(&OnlineCount{})
	return result.Error
}

// GetStorageStats returns storage statistics
func (p *DataRetentionPolicy) GetStorageStats() map[string]interface{} {
	var onlineCount int64
	p.DB.Model(&OnlineCount{}).Count(&onlineCount)

	var problemCount int64
	p.DB.Model(&Problem{}).Count(&problemCount)

	return map[string]interface{}{
		"online_count_records": onlineCount,
		"problem_records":      problemCount,
		"retention_days":       p.RetentionDays,
	}
}

// OnlineCount represents the online count model for retention
// This is duplicated here to avoid import cycle
type OnlineCount struct {
	ID        uint      `gorm:"primarykey"`
	ProblemID uint      `gorm:"index"`
	Count     int
	Timestamp time.Time `gorm:"index"`
}

// TableName specifies the table name
func (OnlineCount) TableName() string {
	return "online_counts"
}

// Problem represents the problem model
type Problem struct {
	ID uint `gorm:"primarykey"`
}

// TableName specifies the table name
func (Problem) TableName() string {
	return "problems"
}
