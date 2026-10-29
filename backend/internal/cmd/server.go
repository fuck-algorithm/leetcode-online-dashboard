package cmd

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
	"leetcode-dashboard/internal/cache"
	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/handlers"
	"leetcode-dashboard/internal/middleware"
	"leetcode-dashboard/internal/redis"
	internalWS "leetcode-dashboard/internal/websocket"
	"leetcode-dashboard/internal/worker"
)

// NewServerCommand creates the server command
func NewServerCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "server",
		Short: "Start the dashboard HTTP server",
		Long:  `Start the LeetCode Dashboard HTTP server with WebSocket and API endpoints.`,
		Run:   runServer,
	}
}

func runServer(cmd *cobra.Command, args []string) {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	if err := database.Init(cfg.DSN(), cfg.ProblemData); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize Redis
	redisCfg := &redis.Config{
		Host:      cfg.RedisHost,
		Port:      cfg.RedisPort,
		Password:  cfg.RedisPassword,
		DB:        cfg.RedisDB,
		KeyPrefix: cfg.RedisKeyPrefix,
	}
	if err := redis.Init(redisCfg); err != nil {
		log.Printf("Warning: Failed to initialize Redis: %v", err)
	} else {
		cache.GetRedisCache().EnableRedis()
		cache.GetRedisCache().SubscribeUpdates()
		log.Println("Redis enabled for cross-process data exchange")
	}
	defer redis.Close()

	// Start data retention policy worker
	retentionPolicy := database.NewDataRetentionPolicy(database.GetDB(), 0)
	retentionPolicy.Start()
	defer retentionPolicy.Stop()

	// Create WebSocket hub
	hub := internalWS.NewHub()
	go hub.Run()

	// Create and start worker
	w := worker.NewWorker(cfg.Problems, cfg.BatchSize, time.Duration(cfg.IntervalSec)*time.Second, hub)
	w.Start()

	// Setup HTTP server
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// CORS configuration
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.CacheMiddleware(5 * time.Minute))
	r.Use(middleware.RateLimitMiddleware(100, time.Minute))

	// API routes
	setupRoutes(r, hub)

	// Start server
	srv := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: r,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	log.Printf("Server started on port %s", cfg.ServerPort)

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	w.Stop()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func setupRoutes(r *gin.Engine, hub *internalWS.Hub) {
	api := r.Group("/api")
	{
		api.GET("/health", handlers.HealthCheck)

		hot100 := api.Group("/hot100")
		{
			hot100.GET("", handlers.GetHot100)
			hot100.GET("/problems", handlers.GetProblems)
			hot100.GET("/online-counts/:id", handlers.GetOnlineCounts)
			hot100.GET("/online-counts/latest", handlers.GetLatestOnlineCounts)
			hot100.GET("/statistics", handlers.GetStatistics)
			hot100.GET("/peaks", handlers.GetPeakOnlineTimes)
			hot100.GET("/export", handlers.ExportData)
			hot100.GET("/export/stats", handlers.GetExportStats)
		}

		// Backward compatibility routes
		api.GET("/problems", handlers.GetProblems)
		api.GET("/online-counts/:id", handlers.GetOnlineCounts)
		api.GET("/online-counts/latest", handlers.GetLatestOnlineCounts)
		api.GET("/statistics", handlers.GetStatistics)
		api.GET("/peaks", handlers.GetPeakOnlineTimes)
		api.GET("/export", handlers.ExportData)
		api.GET("/export/stats", handlers.GetExportStats)
		api.GET("/history", handlers.GetOnlineCountsByQuery)
		api.GET("/total-online-history", handlers.GetTotalOnlineCountHistory)
		api.GET("/total-online-aggregate", handlers.GetTotalOnlineCountAggregate)
	}

	// WebSocket endpoint
	r.GET("/ws", func(c *gin.Context) {
		internalWS.ServeWs(hub, c.Writer, c.Request)
	})
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
