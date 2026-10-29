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

// SiteType represents the LeetCode site type
type SiteType string

const (
	SiteCN  SiteType = "cn"
	SiteCOM SiteType = "com"
)

// OnlineCountCN represents online users for a problem from leetcode.cn
type OnlineCountCN struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	FrontendID string    `json:"frontend_id" gorm:"index:idx_cn_frontend_ts;size:50"`
	Count      int       `json:"count"`
	Timestamp  time.Time `json:"timestamp" gorm:"index:idx_cn_frontend_ts;index:idx_cn_ts"`
}

// TableName specifies the table name for OnlineCountCN
func (OnlineCountCN) TableName() string {
	return "online_counts_cn"
}

// OnlineCountCOM represents online users for a problem from leetcode.com
type OnlineCountCOM struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	FrontendID string    `json:"frontend_id" gorm:"index:idx_com_frontend_ts;size:50"`
	Count      int       `json:"count"`
	Timestamp  time.Time `json:"timestamp" gorm:"index:idx_com_frontend_ts;index:idx_com_ts"`
}

// TableName specifies the table name for OnlineCountCOM
func (OnlineCountCOM) TableName() string {
	return "online_counts_com"
}

// OnlineCountUnified represents unified online count combining cn and com data
type OnlineCountUnified struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	FrontendID string    `json:"frontend_id" gorm:"index:idx_unified_frontend_ts;size:50"`
	CountCN    int       `json:"count_cn"`
	CountCOM   int       `json:"count_com"`
	CountTotal int       `json:"count_total"` // count_cn + count_com
	Timestamp  time.Time `json:"timestamp" gorm:"index:idx_unified_frontend_ts;index:idx_unified_ts"`
}

// TableName specifies the table name for OnlineCountUnified
func (OnlineCountUnified) TableName() string {
	return "online_counts_unified"
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

// TotalOnlineAggregateCN stores pre-aggregated total online count from leetcode.cn
type TotalOnlineAggregateCN struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	Timestamp  time.Time `json:"timestamp" gorm:"uniqueIndex:idx_cn_agg_ts;index:idx_cn_agg_hour;index:idx_cn_agg_day"`
	Total      int       `json:"total"`
	HourBucket time.Time `json:"hour_bucket" gorm:"index:idx_cn_agg_hour"`
	DayBucket  time.Time `json:"day_bucket" gorm:"index:idx_cn_agg_day"`
}

// TableName specifies the table name for TotalOnlineAggregateCN
func (TotalOnlineAggregateCN) TableName() string {
	return "total_online_aggregates_cn"
}

// TotalOnlineAggregateCOM stores pre-aggregated total online count from leetcode.com
type TotalOnlineAggregateCOM struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	Timestamp  time.Time `json:"timestamp" gorm:"uniqueIndex:idx_com_agg_ts;index:idx_com_agg_hour;index:idx_com_agg_day"`
	Total      int       `json:"total"`
	HourBucket time.Time `json:"hour_bucket" gorm:"index:idx_com_agg_hour"`
	DayBucket  time.Time `json:"day_bucket" gorm:"index:idx_com_agg_day"`
}

// TableName specifies the table name for TotalOnlineAggregateCOM
func (TotalOnlineAggregateCOM) TableName() string {
	return "total_online_aggregates_com"
}

// TotalOnlineAggregateUnified stores unified pre-aggregated total online count
type TotalOnlineAggregateUnified struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	Timestamp  time.Time `json:"timestamp" gorm:"uniqueIndex:idx_unified_agg_ts;index:idx_unified_agg_hour;index:idx_unified_agg_day"`
	TotalCN    int       `json:"total_cn"`
	TotalCOM   int       `json:"total_com"`
	Total      int       `json:"total"` // total_cn + total_com
	HourBucket time.Time `json:"hour_bucket" gorm:"index:idx_unified_agg_hour"`
	DayBucket  time.Time `json:"day_bucket" gorm:"index:idx_unified_agg_day"`
}

// TableName specifies the table name for TotalOnlineAggregateUnified
func (TotalOnlineAggregateUnified) TableName() string {
	return "total_online_aggregates_unified"
}
