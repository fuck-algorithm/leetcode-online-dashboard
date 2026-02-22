package models

import (
	"time"
)

// Problem represents a LeetCode problem
type Problem struct {
	ID         uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	FrontendID string    `json:"frontend_id" gorm:"uniqueIndex:idx_frontend_id;not null;size:50"`
	Slug       string    `json:"slug" gorm:"uniqueIndex:idx_slug;not null;size:200"`
	Title      string    `json:"title" gorm:"size:500"`
	TitleCn    string    `json:"title_cn" gorm:"size:500"`
	Difficulty string    `json:"difficulty" gorm:"size:50"`
	Acceptance float64   `json:"acceptance"`
	Tags       string    `json:"tags" gorm:"type:text"` // JSON array stored as string
	TopicTags  []string  `json:"topic_tags" gorm:"-"` // 仅用于 JSON 输出，不存储到数据库
	PaidOnly   bool      `json:"paid_only"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// OnlineCount represents a snapshot of online users for a problem
type OnlineCount struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	FrontendID string    `json:"frontend_id" gorm:"index:idx_frontend_ts;size:50"`
	Count      int       `json:"count"`
	Timestamp  time.Time `json:"timestamp" gorm:"index:idx_frontend_ts"`
}

// Hot100 represents the LeetCode Hot 100 list
type Hot100 struct {
	ID         uint `json:"id" gorm:"primaryKey"`
	FrontendID string `json:"frontend_id" gorm:"uniqueIndex:idx_hot100_frontend;size:50"`
	Rank       int  `json:"rank"`
}

// TableName specifies the table name for Hot100
func (Hot100) TableName() string {
	return "hot100"
}

// ProblemWithOnlineCount combines problem info with latest online count
type ProblemWithOnlineCount struct {
	Problem
	OnlineCount int       `json:"online_count"`
	LastUpdated time.Time `json:"last_updated"`
}

// TotalOnlineAggregate stores pre-aggregated total online count per minute
// This table is populated by the worker to avoid real-time aggregation queries
type TotalOnlineAggregate struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Timestamp time.Time `json:"timestamp" gorm:"uniqueIndex:idx_timestamp;index:idx_ts_hour;index:idx_ts_day"`
	Total     int       `json:"total"`
	// Pre-computed granularities for faster queries
	HourBucket time.Time `json:"hour_bucket" gorm:"index:idx_ts_hour"`  // Truncated to hour
	DayBucket  time.Time `json:"day_bucket" gorm:"index:idx_ts_day"`    // Truncated to day
}

// TableName specifies the table name for TotalOnlineAggregate
func (TotalOnlineAggregate) TableName() string {
	return "total_online_aggregates"
}
