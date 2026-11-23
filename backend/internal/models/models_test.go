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

// 在线人数按站点分表存储（cn / com），另有 unified 汇总表。
func TestOnlineCountCreation(t *testing.T) {
	now := time.Now()
	cn := OnlineCountCN{
		FrontendID: "1",
		Count:      42,
		Timestamp:  now,
	}

	assert.Equal(t, "1", cn.FrontendID)
	assert.Equal(t, 42, cn.Count)
	assert.Equal(t, now, cn.Timestamp)
	assert.Equal(t, "online_counts_cn", cn.TableName())

	com := OnlineCountCOM{
		FrontendID: "1",
		Count:      7,
		Timestamp:  now,
	}
	assert.Equal(t, "online_counts_com", com.TableName())
}

func TestOnlineCountUnifiedCreation(t *testing.T) {
	now := time.Now()
	unified := OnlineCountUnified{
		FrontendID: "1",
		CountCN:    42,
		CountCOM:   7,
		CountTotal: 49,
		Timestamp:  now,
	}

	assert.Equal(t, 49, unified.CountTotal)
	assert.Equal(t, "online_counts_unified", unified.TableName())
}

func TestHot100Creation(t *testing.T) {
	hot100 := Hot100{
		FrontendID: "1",
		Rank:       1,
	}

	assert.Equal(t, "1", hot100.FrontendID)
	assert.Equal(t, 1, hot100.Rank)
	assert.Equal(t, "hot100", hot100.TableName())
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
