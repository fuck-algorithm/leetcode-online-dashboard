// Package handlers LeetCode Dashboard API
//
// A real-time dashboard for LeetCode Hot 100 problems online user counts.
//
//	Schemes: http
//	Host: localhost:8080
//	BasePath: /api
//	Version: 1.0.0
//
//	Consumes:
//	- application/json
//
//	Produces:
//	- application/json
//
// swagger:meta
package handlers

// HealthCheck godoc
// @Summary Health check endpoint
// @Description Returns the health status of the API
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string
// @Router /health [get]
func HealthCheckDoc() {}

// GetProblems godoc
// @Summary Get all problems
// @Description Returns a list of all problems with their online counts
// @Tags problems
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /problems [get]
func GetProblemsDoc() {}

// GetHot100 godoc
// @Summary Get Hot 100 problems
// @Description Returns LeetCode Hot 100 problems with online counts
// @Tags problems
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /hot100 [get]
func GetHot100Doc() {}

// GetOnlineCounts godoc
// @Summary Get online count history
// @Description Returns historical online counts for a specific problem
// @Tags online-counts
// @Accept json
// @Produce json
// @Param id path int true "Problem ID"
// @Success 200 {object} map[string]interface{}
// @Router /online-counts/{id} [get]
func GetOnlineCountsDoc() {}

// GetLatestOnlineCounts godoc
// @Summary Get latest online counts
// @Description Returns the most recent online counts for all problems
// @Tags online-counts
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /online-counts/latest [get]
func GetLatestOnlineCountsDoc() {}

// Problem represents a LeetCode problem
// swagger:model
 type ProblemDoc struct {
	// Problem ID
	// example: 1
	ID uint `json:"id"`
	
	// Problem slug
	// example: "two-sum"
	Slug string `json:"slug"`
	
	// Problem title
	// example: "Two Sum"
	Title string `json:"title"`
	
	// Difficulty level
	// example: "Easy"
	Difficulty string `json:"difficulty"`
	
	// Acceptance rate
	// example: 45.5
	Acceptance float64 `json:"acceptance"`
	
	// Current online users
	// example: 100
	OnlineCount int `json:"online_count"`
 }

// OnlineCount represents an online count record
// swagger:model
 type OnlineCountDoc struct {
	// Record ID
	ID uint `json:"id"`
	
	// Problem ID
	ProblemID uint `json:"problem_id"`
	
	// Number of online users
	// example: 42
	Count int `json:"count"`
	
	// Timestamp
	// example: "2024-01-01T12:00:00Z"
	Timestamp string `json:"timestamp"`
 }
