package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"leetcode-dashboard/internal/cache"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// NewMCPServer creates a new MCP server with SSE transport support
func NewMCPServer() *server.MCPServer {
	s := server.NewMCPServer(
		"leetcode-dashboard",
		"1.0.0",
		server.WithToolCapabilities(true),
		server.WithResourceCapabilities(true, true),
	)

	// Register tools
	registerTools(s)

	return s
}

func registerTools(s *server.MCPServer) {
	// Tool: get_hot100_online_count
	hot100Tool := mcp.NewTool(
		"get_hot100_online_count",
		mcp.WithDescription("获取LeetCode Hot 100题目的最新实时在线人数"),
	)
	s.AddTool(hot100Tool, handleGetHot100OnlineCountMCP)

	// Tool: get_problem_history
	historyTool := mcp.NewTool(
		"get_problem_history",
		mcp.WithDescription("根据题目号获取历史在线人数数据"),
		mcp.WithString("problem_id",
			mcp.Required(),
			mcp.Description("题目号，支持数字(如\"1\")或英文slug(如\"two-sum\")"),
		),
		mcp.WithNumber("limit",
			mcp.Description("返回记录数，默认100"),
			mcp.DefaultNumber(100),
		),
	)
	s.AddTool(historyTool, handleGetProblemHistoryMCP)

	// Tool: get_problem_online_count
	problemCountTool := mcp.NewTool(
		"get_problem_online_count",
		mcp.WithDescription("获取单个题目的最新在线人数"),
		mcp.WithString("problem_id",
			mcp.Required(),
			mcp.Description("题目号，支持数字(如\"1\")或英文slug(如\"two-sum\")"),
		),
	)
	s.AddTool(problemCountTool, handleGetProblemOnlineCountMCP)
}

// handleGetHot100OnlineCountMCP handles the get_hot100_online_count tool
func handleGetHot100OnlineCountMCP(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	// Get all problems from cache
	statuses := cache.GetCache().GetAll()

	// If cache is empty, load from database
	if len(statuses) == 0 {
		db := database.GetDB()
		if db != nil {
			var problems []models.Problem
			if result := db.Find(&problems); result.Error == nil {
				for _, problem := range problems {
					// Get latest unified online count
					var latestCount models.OnlineCountUnified
					err := db.Where("frontend_id = ?", problem.FrontendID).
						Order("timestamp DESC").
						First(&latestCount).Error

					count := 0
					if err == nil {
						count = latestCount.CountTotal
					}

					// Parse tags
					var topicTags []string
					if problem.Tags != "" {
						json.Unmarshal([]byte(problem.Tags), &topicTags)
					}

					statuses = append(statuses, &cache.ProblemStatus{
						FrontendID:  problem.FrontendID,
						Slug:        problem.Slug,
						Title:       problem.Title,
						TitleCn:     problem.TitleCn,
						Difficulty:  problem.Difficulty,
						PaidOnly:    problem.PaidOnly,
						TopicTags:   topicTags,
						OnlineCount: count,
						LastUpdated: latestCount.Timestamp,
					})
				}
			}
		}
	}

	// Format response
	var result []map[string]interface{}
	for _, s := range statuses {
		result = append(result, map[string]interface{}{
			"frontend_id":  s.FrontendID,
			"slug":         s.Slug,
			"title":        s.Title,
			"title_cn":     s.TitleCn,
			"difficulty":   s.Difficulty,
			"paid_only":    s.PaidOnly,
			"topic_tags":   s.TopicTags,
			"online_count": s.OnlineCount,
			"last_updated": s.LastUpdated.Format(time.RFC3339),
		})
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to marshal result: %v", err)), nil
	}

	return mcp.NewToolResultText(string(resultJSON)), nil
}

// handleGetProblemHistoryMCP handles the get_problem_history tool
func handleGetProblemHistoryMCP(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	problemID := req.GetString("problem_id", "")
	if problemID == "" {
		return mcp.NewToolResultError("Missing required parameter: problem_id"), nil
	}

	// Get limit (default 100)
	limit := req.GetInt("limit", 100)

	db := database.GetDB()
	if db == nil {
		return mcp.NewToolResultError("Database not available"), nil
	}

	// Find problem by ID or slug
	var problem models.Problem
	var err error

	// Try to find by frontend_id first (numeric)
	if err = db.Where("frontend_id = ?", problemID).First(&problem).Error; err != nil {
		// If not found, try by slug
		err = db.Where("slug = ?", problemID).First(&problem).Error
	}

	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Problem not found: %s", problemID)), nil
	}

	// Get unified online count history
	var counts []models.OnlineCountUnified
	if result := db.Where("frontend_id = ?", problem.FrontendID).
		Order("timestamp DESC").
		Limit(limit).
		Find(&counts); result.Error != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to fetch history: %v", result.Error)), nil
	}

	// Format response
	var result []map[string]interface{}
	for _, count := range counts {
		result = append(result, map[string]interface{}{
			"id":          count.ID,
			"frontend_id": count.FrontendID,
			"count_cn":    count.CountCN,
			"count_com":   count.CountCOM,
			"count_total": count.CountTotal,
			"timestamp":   count.Timestamp.Format(time.RFC3339),
		})
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to marshal result: %v", err)), nil
	}

	return mcp.NewToolResultText(string(resultJSON)), nil
}

// handleGetProblemOnlineCountMCP handles the get_problem_online_count tool
func handleGetProblemOnlineCountMCP(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	problemID := req.GetString("problem_id", "")
	if problemID == "" {
		return mcp.NewToolResultError("Missing required parameter: problem_id"), nil
	}

	db := database.GetDB()
	if db == nil {
		return mcp.NewToolResultError("Database not available"), nil
	}

	// Find problem by ID or slug
	var problem models.Problem
	var err error

	// Try to find by frontend_id first (numeric)
	if err = db.Where("frontend_id = ?", problemID).First(&problem).Error; err != nil {
		// If not found, try by slug
		err = db.Where("slug = ?", problemID).First(&problem).Error
	}

	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Problem not found: %s", problemID)), nil
	}

	// Get latest unified online count
	var latestCount models.OnlineCountUnified
	err = db.Where("frontend_id = ?", problem.FrontendID).
		Order("timestamp DESC").
		First(&latestCount).Error

	count := 0
	lastUpdated := time.Now()
	if err == nil {
		count = latestCount.CountTotal
		lastUpdated = latestCount.Timestamp
	}

	// Parse tags
	var topicTags []string
	if problem.Tags != "" {
		json.Unmarshal([]byte(problem.Tags), &topicTags)
	}

	result := map[string]interface{}{
		"frontend_id":  problem.FrontendID,
		"slug":         problem.Slug,
		"title":        problem.Title,
		"title_cn":     problem.TitleCn,
		"difficulty":   problem.Difficulty,
		"paid_only":    problem.PaidOnly,
		"topic_tags":   topicTags,
		"online_count": count,
		"last_updated": lastUpdated.Format(time.RFC3339),
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to marshal result: %v", err)), nil
	}

	return mcp.NewToolResultText(string(resultJSON)), nil
}
