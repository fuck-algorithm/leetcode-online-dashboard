package crawler

import (
	"log"
	"time"

	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
	"leetcode-dashboard/internal/redis"
)

// Aggregator handles aggregation of online counts across sites
type Aggregator struct {
	manager *Manager
}

// NewAggregator creates a new aggregator
func NewAggregator(manager *Manager) *Aggregator {
	return &Aggregator{manager: manager}
}

// CalculateTotalOnline calculates total online counts for all sites
func (a *Aggregator) CalculateTotalOnline() {
	// Get CN and COM totals from Redis
	cnTotal, comTotal, unifiedTotal, err := redis.GetTotalOnlineBySite()
	if err != nil {
		log.Printf("Failed to get online counts by site: %v", err)
		return
	}

	// Update Redis aggregates
	if err := redis.UpdateTotalOnlineBySite(cnTotal, comTotal, unifiedTotal); err != nil {
		log.Printf("Failed to update total online by site: %v", err)
	}

	// Persist to PostgreSQL
	a.persistTotalOnlineToPostgres(cnTotal, comTotal, unifiedTotal)
}

// persistTotalOnlineToPostgres persists aggregate data to PostgreSQL
func (a *Aggregator) persistTotalOnlineToPostgres(cnTotal, comTotal, unifiedTotal int) {
	db := database.GetDB()
	if db == nil {
		return
	}

	now := time.Now()
	minuteBucket := now.Truncate(time.Minute)
	hourBucket := now.Truncate(time.Hour)
	dayBucket := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// Save CN aggregate
	cnAggregate := &models.TotalOnlineAggregateCN{
		Timestamp:  minuteBucket,
		Total:      cnTotal,
		HourBucket: hourBucket,
		DayBucket:  dayBucket,
	}
	db.Where("timestamp = ?", minuteBucket).FirstOrCreate(&models.TotalOnlineAggregateCN{}, cnAggregate)
	db.Model(&models.TotalOnlineAggregateCN{}).Where("timestamp = ?", minuteBucket).Update("total", cnTotal)

	// Save COM aggregate
	comAggregate := &models.TotalOnlineAggregateCOM{
		Timestamp:  minuteBucket,
		Total:      comTotal,
		HourBucket: hourBucket,
		DayBucket:  dayBucket,
	}
	db.Where("timestamp = ?", minuteBucket).FirstOrCreate(&models.TotalOnlineAggregateCOM{}, comAggregate)
	db.Model(&models.TotalOnlineAggregateCOM{}).Where("timestamp = ?", minuteBucket).Update("total", comTotal)

	// Save unified aggregate
	unifiedAggregate := &models.TotalOnlineAggregateUnified{
		Timestamp:  minuteBucket,
		TotalCN:    cnTotal,
		TotalCOM:   comTotal,
		Total:      unifiedTotal,
		HourBucket: hourBucket,
		DayBucket:  dayBucket,
	}
	db.Where("timestamp = ?", minuteBucket).FirstOrCreate(&models.TotalOnlineAggregateUnified{}, unifiedAggregate)
	db.Model(&models.TotalOnlineAggregateUnified{}).Where("timestamp = ?", minuteBucket).Updates(map[string]interface{}{
		"total_cn":  cnTotal,
		"total_com": comTotal,
		"total":     unifiedTotal,
	})

	log.Printf("Total online - CN: %d, COM: %d, Unified: %d", cnTotal, comTotal, unifiedTotal)
}

// GetSiteTotals returns the total counts for each site
func (a *Aggregator) GetSiteTotals() (cnTotal, comTotal, unifiedTotal int, err error) {
	return redis.GetTotalOnlineBySite()
}
