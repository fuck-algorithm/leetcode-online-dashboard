package database

import (
	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/models"
	"log"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Init initializes the database connection
func Init(dsn string, problemData []config.ProblemInfo) error {
	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return err
	}

	// Auto migrate models
	err = DB.AutoMigrate(
		&models.Problem{},
		&models.OnlineCount{},
		&models.Hot100{},
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
			// Create problem if not exists
			problem = models.Problem{
				FrontendID: p.ID,
				Slug:       p.Slug,
				Title:      p.Title,
				TitleCn:    p.TitleCn,
				Difficulty: p.Difficulty,
			}
			if err := DB.Create(&problem).Error; err != nil {
				log.Printf("Failed to create problem %s: %v", p.Slug, err)
				continue
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
