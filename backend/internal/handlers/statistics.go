package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"leetcode-dashboard/internal/database"
	"leetcode-dashboard/internal/models"
)

// StatisticsResponse holds dashboard statistics
type StatisticsResponse struct {
	TotalProblems int            `json:"total_problems"`
	TotalOnline   int            `json:"total_online"`
	AverageOnline float64        `json:"average_online"`
	MaxOnline     int            `json:"max_online"`
	MinOnline     int            `json:"min_online"`
	Difficulties  map[string]int `json:"difficulties"`
	OnlineByRange map[string]int `json:"online_by_range"`
	TopProblems   []ProblemStat  `json:"top_problems"`
	LastUpdated   time.Time      `json:"last_updated"`
}

type ProblemStat struct {
	FrontendID  string `json:"frontend_id"`
	Title       string `json:"title"`
	Slug        string `json:"slug"`
	Difficulty  string `json:"difficulty"`
	OnlineCount int    `json:"online_count"`
}

// GetStatistics returns overall dashboard statistics
func GetStatistics(c *gin.Context) {
	db := database.GetDB()
	if db == nil {
		Error(c, http.StatusInternalServerError, "Database not available")
		return
	}

	// Get all problems with latest online counts
	var problems []models.Problem
	if err := db.Find(&problems).Error; err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	var totalOnline, maxOnline, minOnline int
	minOnline = -1
	difficulties := map[string]int{"Easy": 0, "Medium": 0, "Hard": 0}
	onlineRanges := map[string]int{
		"0-50":    0,
		"51-100":  0,
		"101-200": 0,
		"201-500": 0,
		"500+":    0,
	}
	var topProblems []ProblemStat

	for _, p := range problems {
		var latestCount models.OnlineCountUnified
		db.Where("frontend_id = ?", p.FrontendID).Order("timestamp DESC").First(&latestCount)

		count := latestCount.CountTotal
		totalOnline += count

		if count > maxOnline {
			maxOnline = count
		}
		if minOnline == -1 || count < minOnline {
			minOnline = count
		}

		difficulties[p.Difficulty]++

		// Range distribution
		switch {
		case count <= 50:
			onlineRanges["0-50"]++
		case count <= 100:
			onlineRanges["51-100"]++
		case count <= 200:
			onlineRanges["101-200"]++
		case count <= 500:
			onlineRanges["201-500"]++
		default:
			onlineRanges["500+"]++
		}

		topProblems = append(topProblems, ProblemStat{
			FrontendID:  p.FrontendID,
			Title:       p.Title,
			Slug:        p.Slug,
			Difficulty:  p.Difficulty,
			OnlineCount: count,
		})
	}

	// Sort top problems by online count
	for i := 0; i < len(topProblems)-1; i++ {
		for j := i + 1; j < len(topProblems); j++ {
			if topProblems[i].OnlineCount < topProblems[j].OnlineCount {
				topProblems[i], topProblems[j] = topProblems[j], topProblems[i]
			}
		}
	}

	// Get top 10
	if len(topProblems) > 10 {
		topProblems = topProblems[:10]
	}

	avgOnline := 0.0
	if len(problems) > 0 {
		avgOnline = float64(totalOnline) / float64(len(problems))
	}

	stats := StatisticsResponse{
		TotalProblems: len(problems),
		TotalOnline:   totalOnline,
		AverageOnline: avgOnline,
		MaxOnline:     maxOnline,
		MinOnline:     minOnline,
		Difficulties:  difficulties,
		OnlineByRange: onlineRanges,
		TopProblems:   topProblems,
		LastUpdated:   time.Now(),
	}

	Success(c, stats)
}
