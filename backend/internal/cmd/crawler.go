package cmd

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/crawler"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/redis"
)

// NewCrawlerCommand creates the crawler command
func NewCrawlerCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "crawler",
		Short: "Start the WebSocket crawler",
		Long:  `Start the WebSocket crawler to collect online user counts from LeetCode sites.`,
		Run:   runCrawler,
	}
}

func runCrawler(cmd *cobra.Command, args []string) {
	log.Println("Starting LeetCode WSS Crawler...")

	// Load configuration
	cfg := config.Load()

	// Initialize database
	if err := database.Init(cfg.DSN(), cfg.ProblemData); err != nil {
		log.Printf("Warning: Failed to initialize database: %v", err)
		log.Println("Crawler will continue without database, using cached data only")
	}

	// Initialize Redis
	redisCfg := &redis.Config{
		Host:     getEnv("REDIS_HOST", "localhost"),
		Port:     getEnv("REDIS_PORT", "6379"),
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       0,
	}
	if err := redis.Init(redisCfg); err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}
	defer redis.Close()

	// Create crawler manager
	manager := crawler.NewManager(cfg.Problems, cfg.BatchSize)

	// Create message processor
	processor := crawler.NewMessageProcessor(manager)

	// Create batcher
	batcher := crawler.NewBatcher(manager, processor, time.Duration(cfg.IntervalSec)*time.Second)

	// Create aggregator
	aggregator := crawler.NewAggregator(manager)

	// Start batcher
	batcher.Start()

	// Start aggregation ticker
	aggTicker := time.NewTicker(5 * time.Second)
	defer aggTicker.Stop()

	go func() {
		for {
			select {
			case <-aggTicker.C:
				aggregator.CalculateTotalOnline()
			}
		}
	}()

	log.Printf("Crawler started for %d problems", len(cfg.Problems))
	log.Println("Press Ctrl+C to stop")

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down crawler...")
	batcher.Stop()
	manager.CloseAll()
	log.Println("Crawler stopped")
}
