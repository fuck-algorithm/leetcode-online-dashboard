package handlers

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"leetcode-dashboard/internal/config"
	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
	"leetcode-dashboard/internal/redis"
)

// GetProblems returns all problems with their latest online counts
// 优先从 Redis 批量读取数据，Redis 不可用时回退到数据库
func GetProblems(c *gin.Context) {
	startTime := time.Now()
	
	cfg := config.Load()
	db := database.GetDB()

	// 批量从 Redis 读取 CN 和 COM 数据（2次调用替代200次）
	cnData, cnErr := redis.BatchGetOnlineCountsBySite(cfg.Problems, "cn")
	comData, comErr := redis.BatchGetOnlineCountsBySite(cfg.Problems, "com")
	
	log.Printf("[GetProblems] Batch fetch completed in %v, CN: %d items, COM: %d items", 
		time.Since(startTime), len(cnData), len(comData))
	
	// 如果 Redis 完全不可用，从数据库批量获取
	if (cnErr != nil || len(cnData) == 0) && (comErr != nil || len(comData) == 0) && db != nil {
		log.Printf("[GetProblems] Redis data unavailable, falling back to database")
		fetchFromDatabase(c, cfg, db)
		return
	}

	var result []map[string]interface{}

	for _, slug := range cfg.Problems {
		cnStatus := cnData[slug]
		comStatus := comData[slug]

		countCN := 0
		countCOM := 0
		frontendID := ""
		title := ""
		titleCn := ""
		difficulty := ""
		var paidOnly bool
		var topicTags []string
		var lastUpdated time.Time

		// 优先使用 CN 数据
		if cnStatus != nil {
			countCN = cnStatus.OnlineCount
			frontendID = cnStatus.FrontendID
			title = cnStatus.Title
			titleCn = cnStatus.TitleCn
			difficulty = cnStatus.Difficulty
			paidOnly = cnStatus.PaidOnly
			topicTags = cnStatus.TopicTags
			lastUpdated = cnStatus.LastUpdated
		}

		// 补充 COM 数据
		if comStatus != nil {
			countCOM = comStatus.OnlineCount
			// 如果 CN 没有提供元数据，使用 COM 的
			if frontendID == "" {
				frontendID = comStatus.FrontendID
				title = comStatus.Title
				titleCn = comStatus.TitleCn
				difficulty = comStatus.Difficulty
				paidOnly = comStatus.PaidOnly
				topicTags = comStatus.TopicTags
				lastUpdated = comStatus.LastUpdated
			}
		}

		// 如果 Redis 没有数据，从数据库兜底单个题目
		if countCN == 0 && countCOM == 0 && db != nil {
			var problem models.Problem
			if err := db.Where("slug = ?", slug).First(&problem).Error; err == nil {
				frontendID = problem.FrontendID
				title = problem.Title
				titleCn = problem.TitleCn
				difficulty = problem.Difficulty
				paidOnly = problem.PaidOnly
				if problem.Tags != "" {
					json.Unmarshal([]byte(problem.Tags), &topicTags)
				}

				var latestCount models.OnlineCountUnified
				db.Where("frontend_id = ?", problem.FrontendID).
					Order("timestamp DESC").
					First(&latestCount)
				if latestCount.CountCN > 0 || latestCount.CountCOM > 0 {
					countCN = latestCount.CountCN
					countCOM = latestCount.CountCOM
					lastUpdated = latestCount.Timestamp
				}
			}
		}

		result = append(result, map[string]interface{}{
			"frontend_id":        frontendID,
			"slug":               slug,
			"title":              title,
			"title_cn":           titleCn,
			"difficulty":         difficulty,
			"paid_only":          paidOnly,
			"topic_tags":         topicTags,
			"online_count":       countCN + countCOM,
			"online_count_cn":    countCN,
			"online_count_com":   countCOM,
			"online_count_total": countCN + countCOM,
			"last_updated":       lastUpdated,
		})
	}

	log.Printf("[GetProblems] Total time: %v, returning %d problems", time.Since(startTime), len(result))
	Success(c, result)
}

// GetHot100 returns the LeetCode Hot 100 problems with latest online counts
// 优先从 Redis 批量读取，Redis 不可用时回退到数据库
func GetHot100(c *gin.Context) {
	cfg := config.Load()
	db := database.GetDB()

	// 批量从 Redis 读取 CN 和 COM 数据（2次调用替代200次）
	cnData, _ := redis.BatchGetOnlineCountsBySite(cfg.Problems, "cn")
	comData, _ := redis.BatchGetOnlineCountsBySite(cfg.Problems, "com")

	// 如果 Redis 完全不可用，从数据库批量获取
	if len(cnData) == 0 && len(comData) == 0 && db != nil {
		fetchFromDatabase(c, cfg, db)
		return
	}

	var result []map[string]interface{}

	for _, slug := range cfg.Problems {
		cnStatus := cnData[slug]
		comStatus := comData[slug]

		countCN := 0
		countCOM := 0
		frontendID := ""
		title := ""
		titleCn := ""
		difficulty := ""
		var paidOnly bool
		var topicTags []string
		var lastUpdated time.Time

		if cnStatus != nil {
			countCN = cnStatus.OnlineCount
			frontendID = cnStatus.FrontendID
			title = cnStatus.Title
			titleCn = cnStatus.TitleCn
			difficulty = cnStatus.Difficulty
			paidOnly = cnStatus.PaidOnly
			topicTags = cnStatus.TopicTags
			lastUpdated = cnStatus.LastUpdated
		}

		if comStatus != nil {
			countCOM = comStatus.OnlineCount
			if frontendID == "" {
				frontendID = comStatus.FrontendID
				title = comStatus.Title
				titleCn = comStatus.TitleCn
				difficulty = comStatus.Difficulty
				paidOnly = comStatus.PaidOnly
				topicTags = comStatus.TopicTags
				lastUpdated = comStatus.LastUpdated
			}
		}

		// 如果 Redis 没有数据，从数据库兜底单个题目
		if countCN == 0 && countCOM == 0 && db != nil {
			var problem models.Problem
			if err := db.Where("slug = ?", slug).First(&problem).Error; err == nil {
				frontendID = problem.FrontendID
				title = problem.Title
				titleCn = problem.TitleCn
				difficulty = problem.Difficulty
				paidOnly = problem.PaidOnly
				if problem.Tags != "" {
					json.Unmarshal([]byte(problem.Tags), &topicTags)
				}

				var latestCount models.OnlineCountUnified
				db.Where("frontend_id = ?", problem.FrontendID).
					Order("timestamp DESC").
					First(&latestCount)
				if latestCount.CountCN > 0 || latestCount.CountCOM > 0 {
					countCN = latestCount.CountCN
					countCOM = latestCount.CountCOM
					lastUpdated = latestCount.Timestamp
				}
			}
		}

		result = append(result, map[string]interface{}{
			"frontend_id":        frontendID,
			"slug":               slug,
			"title":              title,
			"title_cn":           titleCn,
			"difficulty":         difficulty,
			"paid_only":          paidOnly,
			"topic_tags":         topicTags,
			"online_count":       countCN + countCOM,
			"online_count_cn":    countCN,
			"online_count_com":   countCOM,
			"online_count_total": countCN + countCOM,
			"last_updated":       lastUpdated,
		})
	}

	Success(c, result)
}

// fetchFromDatabase 从数据库获取所有题目数据（Redis 不可用时的兜底方案）
func fetchFromDatabase(c *gin.Context, cfg *config.Config, db *gorm.DB) {
	var result []map[string]interface{}

	// 批量获取所有题目信息
	var problems []models.Problem
	slugList := cfg.Problems
	if err := db.Where("slug IN ?", slugList).Find(&problems).Error; err != nil {
		log.Printf("[fetchFromDatabase] Failed to fetch problems: %v", err)
	}

	// 构建 slug -> problem 映射
	problemMap := make(map[string]models.Problem)
	for _, p := range problems {
		problemMap[p.Slug] = p
	}

	// 批量获取最新的在线人数
	frontendIDs := make([]string, 0, len(problems))
	for _, p := range problems {
		if p.FrontendID != "" {
			frontendIDs = append(frontendIDs, p.FrontendID)
		}
	}

	var onlineCounts []models.OnlineCountUnified
	if len(frontendIDs) > 0 {
		// 子查询获取每个 frontend_id 的最新记录
		subQuery := db.Table("online_counts_unified").
			Select("frontend_id, MAX(timestamp) as max_time").
			Where("frontend_id IN ?", frontendIDs).
			Group("frontend_id")
		
		db.Table("online_counts_unified AS oc").
			Joins("INNER JOIN (?) AS latest ON oc.frontend_id = latest.frontend_id AND oc.timestamp = latest.max_time", subQuery).
			Find(&onlineCounts)
	}

	// 构建 frontend_id -> count 映射
	countMap := make(map[string]models.OnlineCountUnified)
	for _, oc := range onlineCounts {
		countMap[oc.FrontendID] = oc
	}

	for _, slug := range cfg.Problems {
		countCN := 0
		countCOM := 0
		frontendID := ""
		title := ""
		titleCn := ""
		difficulty := ""
		var paidOnly bool
		var topicTags []string
		var lastUpdated time.Time

		if problem, ok := problemMap[slug]; ok {
			frontendID = problem.FrontendID
			title = problem.Title
			titleCn = problem.TitleCn
			difficulty = problem.Difficulty
			paidOnly = problem.PaidOnly
			if problem.Tags != "" {
				json.Unmarshal([]byte(problem.Tags), &topicTags)
			}

			if count, ok := countMap[frontendID]; ok {
				countCN = count.CountCN
				countCOM = count.CountCOM
				lastUpdated = count.Timestamp
			}
		}

		result = append(result, map[string]interface{}{
			"frontend_id":        frontendID,
			"slug":               slug,
			"title":              title,
			"title_cn":           titleCn,
			"difficulty":         difficulty,
			"paid_only":          paidOnly,
			"topic_tags":         topicTags,
			"online_count":       countCN + countCOM,
			"online_count_cn":    countCN,
			"online_count_com":   countCOM,
			"online_count_total": countCN + countCOM,
			"last_updated":       lastUpdated,
		})
	}

	Success(c, result)
}
