package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"leetcode-dashboard/internal/cache"
	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
	"leetcode-dashboard/internal/redis"
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

// readOnlyToolOptions marks a tool as a pure read-only query so AI clients
// (Claude Desktop, Cursor, …) treat it as safe to call without extra
// confirmation. mcp-go defaults to destructive=true for all tools.
func readOnlyToolOptions() []mcp.ToolOption {
	return []mcp.ToolOption{
		mcp.WithReadOnlyHintAnnotation(true),
		mcp.WithDestructiveHintAnnotation(false),
		mcp.WithIdempotentHintAnnotation(true),
	}
}

func registerTools(s *server.MCPServer) {
	// Tool: get_hot100_online_count
	hot100Tool := mcp.NewTool(
		"get_hot100_online_count",
		append([]mcp.ToolOption{
			mcp.WithDescription("获取LeetCode Hot 100题目的最新实时在线人数"),
		}, readOnlyToolOptions()...)...,
	)
	s.AddTool(hot100Tool, handleGetHot100OnlineCountMCP)

	// Tool: get_problem_history
	historyTool := mcp.NewTool(
		"get_problem_history",
		append([]mcp.ToolOption{
			mcp.WithDescription("根据题目号获取历史在线人数数据"),
			mcp.WithString("problem_id",
				mcp.Required(),
				mcp.Description("题目号，支持数字(如\"1\")或英文slug(如\"two-sum\")"),
			),
			mcp.WithNumber("limit",
				mcp.Description("返回记录数，默认100"),
				mcp.DefaultNumber(100),
			),
		}, readOnlyToolOptions()...)...,
	)
	s.AddTool(historyTool, handleGetProblemHistoryMCP)

	// Tool: get_problem_online_count
	problemCountTool := mcp.NewTool(
		"get_problem_online_count",
		append([]mcp.ToolOption{
			mcp.WithDescription("获取单个题目的最新在线人数"),
			mcp.WithString("problem_id",
				mcp.Required(),
				mcp.Description("题目号，支持数字(如\"1\")或英文slug(如\"two-sum\")"),
			),
		}, readOnlyToolOptions()...)...,
	)
	s.AddTool(problemCountTool, handleGetProblemOnlineCountMCP)

	// Tool: get_hot100_problems
	hot100ProblemsTool := mcp.NewTool(
		"get_hot100_problems",
		append([]mcp.ToolOption{
			mcp.WithDescription("获取LeetCode Hot 100题目列表（包含题目信息和在线人数）"),
		}, readOnlyToolOptions()...)...,
	)
	s.AddTool(hot100ProblemsTool, handleGetHot100ProblemsMCP)
}

// loadMCPHot100Statuses 获取 Hot100 题目状态列表，与 HTTP /api/hot100 同源：
// 批量读 Redis 双站点键（online:cn:/online:com:），Redis 无数据时回源数据库，
// 保证 MCP 工具返回真实在线人数（含 CN/COM/Total）。
func loadMCPHot100Statuses() []*cache.ProblemStatus {
	cfg := config.Load()
	db := database.GetDB()

	// 与 HTTP API 一致：批量读取 CN 和 COM 数据（2 次调用替代 N 次单键查询）
	cnData, _ := redis.BatchGetOnlineCountsBySite(cfg.Problems, "cn")
	comData, _ := redis.BatchGetOnlineCountsBySite(cfg.Problems, "com")

	// Redis 完全不可用时，回源数据库
	if len(cnData) == 0 && len(comData) == 0 && db != nil {
		return loadMCPHot100StatusesFromDB()
	}

	statuses := make([]*cache.ProblemStatus, 0, len(cfg.Problems))
	for _, slug := range cfg.Problems {
		cn := cnData[slug]
		com := comData[slug]

		countCN, countCOM := 0, 0
		lastUpdated := time.Now()
		var s *cache.ProblemStatus

		if cn != nil {
			countCN = cn.OnlineCount
			s = &cache.ProblemStatus{
				FrontendID: cn.FrontendID,
				Slug:       cn.Slug,
				Title:      cn.Title,
				TitleCn:    cn.TitleCn,
				Difficulty: cn.Difficulty,
				PaidOnly:   cn.PaidOnly,
				TopicTags:  cn.TopicTags,
			}
			lastUpdated = cn.LastUpdated
		}
		if com != nil {
			countCOM = com.OnlineCount
			if s == nil {
				s = &cache.ProblemStatus{
					FrontendID: com.FrontendID,
					Slug:       com.Slug,
					Title:      com.Title,
					TitleCn:    com.TitleCn,
					Difficulty: com.Difficulty,
					PaidOnly:   com.PaidOnly,
					TopicTags:  com.TopicTags,
				}
			}
			if com.LastUpdated.After(lastUpdated) {
				lastUpdated = com.LastUpdated
			}
		}

		// Redis 中单个题目缺失时，从数据库兜底
		if s == nil && db != nil {
			var problem models.Problem
			if err := db.Where("slug = ?", slug).First(&problem).Error; err == nil {
				s = &cache.ProblemStatus{
					FrontendID: problem.FrontendID,
					Slug:       problem.Slug,
					Title:      problem.Title,
					TitleCn:    problem.TitleCn,
					Difficulty: problem.Difficulty,
					PaidOnly:   problem.PaidOnly,
				}
				if problem.Tags != "" {
					json.Unmarshal([]byte(problem.Tags), &s.TopicTags)
				}
				var latestCount models.OnlineCountUnified
				if err := db.Where("frontend_id = ?", problem.FrontendID).
					Order("timestamp DESC").
					First(&latestCount).Error; err == nil {
					countCN = latestCount.CountCN
					countCOM = latestCount.CountCOM
					lastUpdated = latestCount.Timestamp
				}
			}
		}

		if s != nil {
			s.OnlineCount = countCN + countCOM
			s.OnlineCountCN = countCN
			s.OnlineCountCOM = countCOM
			s.LastUpdated = lastUpdated
			statuses = append(statuses, s)
		}
	}
	return statuses
}

// loadMCPHot100StatusesFromDB 数据库兜底：逐题查最新 OnlineCountUnified
func loadMCPHot100StatusesFromDB() []*cache.ProblemStatus {
	db := database.GetDB()
	var problems []models.Problem
	if result := db.Find(&problems); result.Error != nil {
		return nil
	}

	// 按 slug 建索引，保持 Hot100 顺序输出
	bySlug := make(map[string]models.Problem, len(problems))
	for _, p := range problems {
		bySlug[p.Slug] = p
	}

	cfg := config.Load()
	statuses := make([]*cache.ProblemStatus, 0, len(cfg.Problems))
	for _, slug := range cfg.Problems {
		problem, ok := bySlug[slug]
		if !ok {
			continue
		}

		topicTags := []string{}
		if problem.Tags != "" {
			json.Unmarshal([]byte(problem.Tags), &topicTags)
		}

		countCN, countCOM := 0, 0
		lastUpdated := time.Now()
		var latestCount models.OnlineCountUnified
		if err := db.Where("frontend_id = ?", problem.FrontendID).
			Order("timestamp DESC").
			First(&latestCount).Error; err == nil {
			countCN = latestCount.CountCN
			countCOM = latestCount.CountCOM
			lastUpdated = latestCount.Timestamp
		}

		statuses = append(statuses, &cache.ProblemStatus{
			FrontendID:     problem.FrontendID,
			Slug:           problem.Slug,
			Title:          problem.Title,
			TitleCn:        problem.TitleCn,
			Difficulty:     problem.Difficulty,
			PaidOnly:       problem.PaidOnly,
			TopicTags:      topicTags,
			OnlineCount:    countCN + countCOM,
			OnlineCountCN:  countCN,
			OnlineCountCOM: countCOM,
			LastUpdated:    lastUpdated,
		})
	}
	return statuses
}

// handleGetHot100OnlineCountMCP handles the get_hot100_online_count tool
func handleGetHot100OnlineCountMCP(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	statuses := loadMCPHot100Statuses()

	// Format response with all three counts
	// Load all problem tags from database to supplement missing topic_tags from cache
	db := database.GetDB()
	problemTagsMap := make(map[string]string)
	if db != nil {
		var problems []models.Problem
		if result := db.Select("slug", "tags").Find(&problems); result.Error == nil {
			for _, p := range problems {
				if p.Tags != "" {
					problemTagsMap[p.Slug] = p.Tags
				}
			}
		}
	}

	var result []map[string]interface{}
	for _, s := range statuses {
		// Get topic tags from cache or database
		topicTags := s.TopicTags
		if topicTags == nil {
			topicTags = []string{}
		}
		if len(topicTags) == 0 && s.Slug != "" {
			if tagsJSON, ok := problemTagsMap[s.Slug]; ok && tagsJSON != "" {
				json.Unmarshal([]byte(tagsJSON), &topicTags)
			}
		}
		// Ensure topicTags is never nil (return [] instead of null)
		if topicTags == nil {
			topicTags = []string{}
		}

		result = append(result, map[string]interface{}{
			"frontend_id":        s.FrontendID,
			"slug":               s.Slug,
			"title":              s.Title,
			"title_cn":           s.TitleCn,
			"difficulty":         s.Difficulty,
			"paid_only":          s.PaidOnly,
			"topic_tags":         topicTags,
			"online_count":       s.OnlineCount,
			"online_count_cn":    s.OnlineCountCN,
			"online_count_com":   s.OnlineCountCOM,
			"online_count_total": s.OnlineCountCN + s.OnlineCountCOM,
			"last_updated":       s.LastUpdated.Format(time.RFC3339),
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

	countCN := 0
	countCOM := 0
	countTotal := 0
	lastUpdated := time.Now()
	if err == nil {
		countCN = latestCount.CountCN
		countCOM = latestCount.CountCOM
		countTotal = latestCount.CountTotal
		lastUpdated = latestCount.Timestamp
	}

	// Parse tags
	topicTags := []string{}
	if problem.Tags != "" {
		json.Unmarshal([]byte(problem.Tags), &topicTags)
	}

	result := map[string]interface{}{
		"frontend_id":        problem.FrontendID,
		"slug":               problem.Slug,
		"title":              problem.Title,
		"title_cn":           problem.TitleCn,
		"difficulty":         problem.Difficulty,
		"paid_only":          problem.PaidOnly,
		"topic_tags":         topicTags,
		"online_count":       countTotal,
		"online_count_cn":    countCN,
		"online_count_com":   countCOM,
		"online_count_total": countCN + countCOM,
		"last_updated":       lastUpdated.Format(time.RFC3339),
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to marshal result: %v", err)), nil
	}

	return mcp.NewToolResultText(string(resultJSON)), nil
}

// handleGetHot100ProblemsMCP handles the get_hot100_problems tool
func handleGetHot100ProblemsMCP(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	statuses := loadMCPHot100Statuses()

	// Load all problem tags from database to supplement missing topic_tags from cache
	db := database.GetDB()
	problemTagsMap := make(map[string]string)
	if db != nil {
		var problems []models.Problem
		if result := db.Select("slug", "tags").Find(&problems); result.Error == nil {
			for _, p := range problems {
				if p.Tags != "" {
					problemTagsMap[p.Slug] = p.Tags
				}
			}
		}
	}

	// Format response with complete problem info
	var result []map[string]interface{}
	for _, s := range statuses {
		// Get topic tags from cache or database
		topicTags := s.TopicTags
		if topicTags == nil {
			topicTags = []string{}
		}
		if len(topicTags) == 0 && s.Slug != "" {
			if tagsJSON, ok := problemTagsMap[s.Slug]; ok && tagsJSON != "" {
				json.Unmarshal([]byte(tagsJSON), &topicTags)
			}
		}
		// Ensure topicTags is never nil
		if topicTags == nil {
			topicTags = []string{}
		}

		result = append(result, map[string]interface{}{
			"frontend_id":        s.FrontendID,
			"slug":               s.Slug,
			"title":              s.Title,
			"title_cn":           s.TitleCn,
			"difficulty":         s.Difficulty,
			"paid_only":          s.PaidOnly,
			"topic_tags":         topicTags,
			"online_count":       s.OnlineCount,
			"online_count_cn":    s.OnlineCountCN,
			"online_count_com":   s.OnlineCountCOM,
			"online_count_total": s.OnlineCountCN + s.OnlineCountCOM,
			"last_updated":       s.LastUpdated.Format(time.RFC3339),
		})
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("Failed to marshal result: %v", err)), nil
	}

	return mcp.NewToolResultText(string(resultJSON)), nil
}
