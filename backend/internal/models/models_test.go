package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestProblemCreation(t *testing.T) {
	problem := Problem{
		Slug:       "two-sum",
		Title:      "Two Sum",
		TitleCn:    "两数之和",
		Difficulty: "Easy",
		Acceptance: 45.5,
		Tags:       "array,hash-table",
	}

	assert.Equal(t, "two-sum", problem.Slug)
	assert.Equal(t, "Two Sum", problem.Title)
	assert.Equal(t, "两数之和", problem.TitleCn)
	assert.Equal(t, "Easy", problem.Difficulty)
}

func TestOnlineCountCreation(t *testing.T) {
	now := time.Now()
	count := OnlineCount{
		FrontendID: "1",
		Count:      42,
		Timestamp:  now,
	}

	assert.Equal(t, "1", count.FrontendID)
	assert.Equal(t, 42, count.Count)
	assert.Equal(t, now, count.Timestamp)
}

func TestHot100Creation(t *testing.T) {
	hot100 := Hot100{
		FrontendID: "1",
		Rank:       1,
	}

	assert.Equal(t, "1", hot100.FrontendID)
	assert.Equal(t, 1, hot100.Rank)
}

func TestProblemWithOnlineCount(t *testing.T) {
	problem := ProblemWithOnlineCount{
		Problem: Problem{
			ID:         1,
			Slug:       "two-sum",
			Title:      "Two Sum",
			Difficulty: "Easy",
			Acceptance: 45.5,
		},
		OnlineCount: 42,
		LastUpdated: time.Now(),
	}

	assert.NotZero(t, problem.ID)
	assert.Equal(t, 42, problem.OnlineCount)
}
