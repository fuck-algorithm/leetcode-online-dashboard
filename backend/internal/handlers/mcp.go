package handlers

import (
	"encoding/json"
	"leetcode-dashboard/internal/cache"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// MCPRequest represents an MCP tool call request
type MCPRequest struct {
	Name       string                 `json:"name"`
	Parameters map[string]interface{} `json:"parameters"`
}

// MCPResponse represents an MCP tool call response
type MCPResponse struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"`
}

// MCPHandler handles MCP tool requests
func MCPHandler(c *gin.Context) {
	var req MCPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, MCPResponse{
			Code: 400,
			Msg:  "Invalid request: " + err.Error(),
			Data: nil,
		})
		return
	}

	log.Printf("[MCP] Tool call: %s", req.Name)

	switch req.Name {
	case "get_hot100_online_count":
		handleGetHot100OnlineCount(c)
	case "get_problem_history":
		handleGetProblemHistory(c, req.Parameters)
	case "get_problem_online_count":
		handleGetProblemOnlineCount(c, req.Parameters)
	default:
		c.JSON(http.StatusNotFound, MCPResponse{
			Code: 404,
			Msg:  "Unknown tool: " + req.Name,
			Data: nil,
		})
	}
}

// MCPManifest returns the MCP server manifest
func MCPManifest(c *gin.Context) {
	manifest := map[string]interface{}{
		"name":        "leetcode-dashboard",
		"version":     "1.0.0",
		"description": "LeetCode Hot 100 real-time online count data via MCP",
		"tools": []map[string]interface{}{
			{
				"name":        "get_hot100_online_count",
				"description": "获取LeetCode Hot 100题目的最新实时在线人数",
				"parameters": map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
					"required":   []string{},
				},
			},
			{
				"name":        "get_problem_history",
				"description": "根据题目号获取历史在线人数数据",
				"parameters": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"problem_id": map[string]interface{}{
							"type":        "string",
							"description": "题目号，支持数字(如\"1\")或英文slug(如\"two-sum\")",
						},
						"limit": map[string]interface{}{
							"type":        "number",
							"description": "返回记录数，默认100",
							"default":     100,
						},
					},
					"required": []string{"problem_id"},
				},
			},
			{
				"name":        "get_problem_online_count",
				"description": "获取单个题目的最新在线人数",
				"parameters": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"problem_id": map[string]interface{}{
							"type":        "string",
							"description": "题目号，支持数字(如\"1\")或英文slug(如\"two-sum\")",
						},
					},
					"required": []string{"problem_id"},
				},
			},
			{
				"name":        "get_hot100_problems",
				"description": "获取LeetCode Hot 100题目列表（包含题目信息和在线人数）",
				"parameters": map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
					"required":   []string{},
				},
			},
		},
	}

	c.JSON(http.StatusOK, manifest)
}

// handleGetHot100OnlineCount returns Hot 100 problems with online counts
func handleGetHot100OnlineCount(c *gin.Context) {
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

	c.JSON(http.StatusOK, MCPResponse{
		Code: 200,
		Msg:  "success",
		Data: result,
	})
}

// handleGetProblemHistory returns historical online count data for a problem
func handleGetProblemHistory(c *gin.Context, params map[string]interface{}) {
	problemID, ok := params["problem_id"].(string)
	if !ok || problemID == "" {
		c.JSON(http.StatusBadRequest, MCPResponse{
			Code: 400,
			Msg:  "Missing required parameter: problem_id",
			Data: nil,
		})
		return
	}

	// Get limit (default 100)
	limit := 100
	if limitParam, ok := params["limit"]; ok {
		switch v := limitParam.(type) {
		case float64:
			limit = int(v)
		case int:
			limit = v
		case string:
			if parsed, err := strconv.Atoi(v); err == nil {
				limit = parsed
			}
		}
	}

	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, MCPResponse{
			Code: 500,
			Msg:  "Database not available",
			Data: nil,
		})
		return
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
		c.JSON(http.StatusNotFound, MCPResponse{
			Code: 404,
			Msg:  "Problem not found: " + problemID,
			Data: nil,
		})
		return
	}

	// Get unified online count history
	var counts []models.OnlineCountUnified
	if result := db.Where("frontend_id = ?", problem.FrontendID).
		Order("timestamp DESC").
		Limit(limit).
		Find(&counts); result.Error != nil {
		c.JSON(http.StatusInternalServerError, MCPResponse{
			Code: 500,
			Msg:  "Failed to fetch history: " + result.Error.Error(),
			Data: nil,
		})
		return
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

	c.JSON(http.StatusOK, MCPResponse{
		Code: 200,
		Msg:  "success",
		Data: result,
	})
}

// handleGetProblemOnlineCount returns the latest online count for a single problem
func handleGetProblemOnlineCount(c *gin.Context, params map[string]interface{}) {
	problemID, ok := params["problem_id"].(string)
	if !ok || problemID == "" {
		c.JSON(http.StatusBadRequest, MCPResponse{
			Code: 400,
			Msg:  "Missing required parameter: problem_id",
			Data: nil,
		})
		return
	}

	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, MCPResponse{
			Code: 500,
			Msg:  "Database not available",
			Data: nil,
		})
		return
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
		c.JSON(http.StatusNotFound, MCPResponse{
			Code: 404,
			Msg:  "Problem not found: " + problemID,
			Data: nil,
		})
		return
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

	c.JSON(http.StatusOK, MCPResponse{
		Code: 200,
		Msg:  "success",
		Data: map[string]interface{}{
			"frontend_id":  problem.FrontendID,
			"slug":         problem.Slug,
			"title":        problem.Title,
			"title_cn":     problem.TitleCn,
			"difficulty":   problem.Difficulty,
			"paid_only":    problem.PaidOnly,
			"topic_tags":   topicTags,
			"online_count": count,
			"last_updated": lastUpdated.Format(time.RFC3339),
		},
	})
}
