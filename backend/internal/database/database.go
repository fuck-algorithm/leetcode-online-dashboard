package database

import (
	"encoding/json"
	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/models"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Init initializes the database connection
func Init(dsn string, problemData []config.ProblemInfo) error {
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return err
	}

	// Remote PostgreSQL (K8s NodePort) needs a bounded, long-lived pool.
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Auto migrate models - 双站点架构
	err = DB.AutoMigrate(
		&models.Problem{},
		&models.OnlineCountCN{},
		&models.OnlineCountCOM{},
		&models.OnlineCountUnified{},
		&models.Hot100{},
		&models.TotalOnlineAggregateCN{},
		&models.TotalOnlineAggregateCOM{},
		&models.TotalOnlineAggregateUnified{},
	)
	if err != nil {
		return err
	}

	// Initialize Hot100 records
	if err := initHot100(problemData); err != nil {
		log.Printf("Failed to initialize Hot100: %v", err)
	}

	log.Println("Database initialized successfully")
	return nil
}

// initHot100 initializes Hot100 records for all configured problems
func initHot100(problemData []config.ProblemInfo) error {
	for rank, p := range problemData {
		// Skip if no FrontendID (should not happen with JSON data)
		if p.ID == "" {
			log.Printf("Warning: Problem %s has no FrontendID, skipping", p.Slug)
			continue
		}

		// Find or create problem
		var problem models.Problem
		result := DB.Where("frontend_id = ?", p.ID).First(&problem)
		if result.Error != nil {
			// Convert topic_tags to JSON string for Tags field
			tagsJSON, _ := json.Marshal(p.TopicTags)
			
			// Create problem if not exists
			problem = models.Problem{
				FrontendID: p.ID,
				Slug:       p.Slug,
				Title:      p.Title,
				TitleCn:    p.TitleCn,
				Difficulty: p.Difficulty,
				Tags:       string(tagsJSON),
			}
			if err := DB.Create(&problem).Error; err != nil {
				log.Printf("Failed to create problem %s: %v", p.Slug, err)
				continue
			}
		} else {
			// Update existing problem's Tags if empty
			if problem.Tags == "" && len(p.TopicTags) > 0 {
				tagsJSON, _ := json.Marshal(p.TopicTags)
				problem.Tags = string(tagsJSON)
				DB.Save(&problem)
			}
		}

		// Create or update Hot100 entry
		var hot100 models.Hot100
		result = DB.Where("frontend_id = ?", problem.FrontendID).First(&hot100)
		if result.Error != nil {
			hot100 = models.Hot100{
				FrontendID: problem.FrontendID,
				Rank:       rank + 1,
			}
			if err := DB.Create(&hot100).Error; err != nil {
				log.Printf("Failed to create Hot100 for %s: %v", p.Slug, err)
				continue
			}
		}
	}
	log.Printf("Initialized %d Hot100 records", len(problemData))
	return nil
}

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return DB
}
