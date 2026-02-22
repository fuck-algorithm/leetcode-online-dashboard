package main

import (
	"context"
	"encoding/json"
	"leetcode-dashboard/internal/cache"
	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/handlers"
	"leetcode-dashboard/internal/middleware"
	"leetcode-dashboard/internal/models"
	"leetcode-dashboard/internal/redis"
	internalWS "leetcode-dashboard/internal/websocket"
	"leetcode-dashboard/internal/worker"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/mark3labs/mcp-go/server"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	if err := database.Init(cfg.DSN(), cfg.ProblemData); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize Redis for cross-process data exchange
	redisCfg := &redis.Config{
		Host:     getEnv("REDIS_HOST", "localhost"),
		Port:     getEnv("REDIS_PORT", "6379"),
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       0,
	}
	if err := redis.Init(redisCfg); err != nil {
		log.Printf("Warning: Failed to initialize Redis: %v", err)
		log.Println("Continuing without Redis, using memory cache only")
	} else {
		// Enable Redis cache adapter for cross-process data exchange
		cache.GetRedisCache().EnableRedis()
		cache.GetRedisCache().SubscribeUpdates()
		log.Println("Redis enabled for cross-process data exchange")
	}
	defer redis.Close()

	// Start data retention policy worker
	retentionPolicy := database.NewDataRetentionPolicy(database.GetDB(), 0)
	retentionPolicy.Start()
	defer retentionPolicy.Stop()

	// Create WebSocket hub for frontend clients
	hub := internalWS.NewHub()
	go hub.Run()

	// Create and start worker with hub
	w := worker.NewWorker(cfg.Problems, cfg.BatchSize, time.Duration(cfg.IntervalSec)*time.Second, hub)
	w.Start()

	// Setup HTTP server
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// CORS configuration
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"*"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(config))
	
	// Apply API response caching (5 minute TTL)
	r.Use(middleware.CacheMiddleware(5 * time.Minute))
	
	// Apply rate limiting middleware (100 requests per minute)
	r.Use(middleware.RateLimitMiddleware(100, time.Minute))

	// API routes
	api := r.Group("/api")
	{
		api.GET("/health", handlers.HealthCheck)
		
		// Hot 100 API group - all data is within Hot 100 context
		hot100 := api.Group("/hot100")
		{
			hot100.GET("", handlers.GetHot100)              // List all Hot 100
			hot100.GET("/problems", handlers.GetProblems)   // Get problem details
			hot100.GET("/online-counts/:id", handlers.GetOnlineCounts)           // History for specific problem
			hot100.GET("/online-counts/latest", handlers.GetLatestOnlineCounts) // Latest counts
			hot100.GET("/statistics", handlers.GetStatistics)      // Statistics
			hot100.GET("/peaks", handlers.GetPeakOnlineTimes)        // Peak times
			hot100.GET("/export", handlers.ExportData)               // Export data
			hot100.GET("/export/stats", handlers.GetExportStats)     // Export stats
		}
		
		// Keep old endpoints for backward compatibility (deprecated)
		api.GET("/problems", handlers.GetProblems)
		api.GET("/online-counts/:id", handlers.GetOnlineCounts)
		api.GET("/online-counts/latest", handlers.GetLatestOnlineCounts)
		api.GET("/statistics", handlers.GetStatistics)
		api.GET("/peaks", handlers.GetPeakOnlineTimes)
		api.GET("/export", handlers.ExportData)
		api.GET("/export/stats", handlers.GetExportStats)
		api.GET("/history", handlers.GetOnlineCountsByQuery) // History page endpoint
		api.GET("/total-online-history", handlers.GetTotalOnlineCountHistory) // Total online count history for charts
		api.GET("/total-online-aggregate", handlers.GetTotalOnlineCountAggregate) // Aggregate data with custom time range and granularity
		
		// Add data retention stats endpoint
		adminHandler := handlers.NewAdminHandler()
		admin := api.Group("/admin")
		{
			admin.GET("/status", adminHandler.GetSystemStatus)
			admin.GET("/config", adminHandler.GetConfig)
			admin.PUT("/config", adminHandler.UpdateConfig)
			admin.POST("/cleanup", adminHandler.TriggerCleanup)
			admin.GET("/health", adminHandler.HealthCheckDetailed)
			admin.GET("/storage", func(c *gin.Context) {
				stats := retentionPolicy.GetStorageStats()
				c.JSON(http.StatusOK, stats)
			})
		}
	}

	// MCP SSE server endpoints
	mcpServer := handlers.NewMCPServer()
	sseServer := server.NewSSEServer(mcpServer,
		server.WithStaticBasePath("/mcp"),
		server.WithKeepAliveInterval(30*time.Second),
	)
	
	// SSE endpoint for MCP client connections
	r.GET("/mcp/sse", func(c *gin.Context) {
		sseServer.ServeHTTP(c.Writer, c.Request)
	})
	
	// Message endpoint for MCP client-to-server communication
	r.POST("/mcp/message", func(c *gin.Context) {
		sseServer.ServeHTTP(c.Writer, c.Request)
	})
	
	// Legacy REST-based MCP endpoints (deprecated, kept for backward compatibility)
	r.GET("/mcp", handlers.MCPManifest)
	r.POST("/mcp/tool", handlers.MCPHandler)

	// WebSocket endpoint for real-time updates (frontend clients)
	r.GET("/ws", func(c *gin.Context) {
		internalWS.ServeWs(hub, c.Writer, c.Request)
	})

	// Start server
	srv := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: r,
	}

	// Graceful shutdown
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	log.Printf("Server started on port %s", cfg.ServerPort)
	log.Printf("WebSocket endpoint: ws://localhost:%s/ws", cfg.ServerPort)

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Stop worker
	w.Stop()

	// Shutdown server with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

// preloadCache loads Hot 100 problem data from database into memory cache
func preloadCache(problemData []config.ProblemInfo) {
	db := database.GetDB()
	if db == nil {
		log.Println("Database not initialized, skipping cache preload")
		return
	}

	// Get all slugs from problemData
	slugs := make([]string, len(problemData))
	for i, p := range problemData {
		slugs[i] = p.Slug
	}

	// Only preload Hot 100 problems
	var problems []models.Problem
	if result := db.Where("slug IN ?", slugs).Find(&problems); result.Error != nil {
		log.Printf("Failed to load problems from database: %v", result.Error)
		return
	}

	log.Printf("Loaded %d problems from database for cache preload", len(problems))

	for _, problem := range problems {
		// Parse Tags JSON string to []string
		var topicTags []string
		if problem.Tags != "" {
			json.Unmarshal([]byte(problem.Tags), &topicTags)
		}
		log.Printf("Preloading cache: slug=%s, frontend_id=%s, paid_only=%v, tags=%v",
			problem.Slug, problem.FrontendID, problem.PaidOnly, topicTags)
		cache.GetCache().Update(problem.Slug, 0, problem.FrontendID, problem.Title, problem.TitleCn, problem.Difficulty, problem.PaidOnly, topicTags)
	}

	log.Printf("Preloaded %d Hot 100 problems into cache", len(problems))
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
