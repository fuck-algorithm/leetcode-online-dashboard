package main

import (
	"context"
	"encoding/json"
	"leetcode-dashboard/internal/cache"
	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/handlers"
	"leetcode-dashboard/internal/models"
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
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	if err := database.Init(cfg.DSN(), cfg.ProblemData); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Preload problem data into cache (including difficulty)
	preloadCache(cfg.ProblemData)

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

	// API routes
	api := r.Group("/api")
	{
		api.GET("/health", handlers.HealthCheck)
		
		// Hot 100 API group - all data is within Hot 100 context
		hot100 := api.Group("/hot100")
		{
			hot100.GET("", handlers.GetHot100FromCache)              // List all Hot 100
			hot100.GET("/problems", handlers.GetProblemsFromCache)   // Get problem details
			hot100.GET("/online-counts/:id", handlers.GetOnlineCounts)           // History for specific problem
			hot100.GET("/online-counts/latest", handlers.GetLatestOnlineCountsFromCache) // Latest counts
			hot100.GET("/statistics", handlers.GetStatistics)      // Statistics
			hot100.GET("/peaks", handlers.GetPeakOnlineTimes)        // Peak times
			hot100.GET("/export", handlers.ExportData)               // Export data
			hot100.GET("/export/stats", handlers.GetExportStats)     // Export stats
		}
		
		// Keep old endpoints for backward compatibility (deprecated)
		api.GET("/problems", handlers.GetProblemsFromCache)
		api.GET("/online-counts/:id", handlers.GetOnlineCounts)
		api.GET("/online-counts/latest", handlers.GetLatestOnlineCountsFromCache)
		api.GET("/statistics", handlers.GetStatistics)
		api.GET("/peaks", handlers.GetPeakOnlineTimes)
		api.GET("/export", handlers.ExportData)
		api.GET("/export/stats", handlers.GetExportStats)
	}

	// MCP server endpoints
	r.GET("/mcp", handlers.MCPManifest)
	r.POST("/mcp", handlers.MCPHandler)

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
