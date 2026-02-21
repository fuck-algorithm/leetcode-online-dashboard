package cache

import (
	"sync"
	"time"
)

// ProblemStatus 内存中的题目实时状态
type ProblemStatus struct {
	FrontendID  string    `json:"frontend_id"`
	Slug        string    `json:"slug"`
	Title       string    `json:"title"`
	TitleCn     string    `json:"title_cn"`
	Difficulty  string    `json:"difficulty"`
	PaidOnly    bool      `json:"paid_only"`
	TopicTags   []string  `json:"topic_tags"`
	OnlineCount int       `json:"online_count"`
	LastUpdated time.Time `json:"last_updated"`
}

// MemoryCache 内存缓存管理器
type MemoryCache struct {
	data map[string]*ProblemStatus // key: slug
	mu   sync.RWMutex
}

var instance *MemoryCache
var once sync.Once

// GetCache 获取单例实例
func GetCache() *MemoryCache {
	once.Do(func() {
		instance = &MemoryCache{
			data: make(map[string]*ProblemStatus),
		}
	})
	return instance
}

// Update 更新题目在线人数
func (c *MemoryCache) Update(slug string, count int, frontendID string, title string, titleCn string, difficulty string, paidOnly bool, topicTags []string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 如果已有数据且新 frontendID 为空，则保留已有的 FrontendID
	if existing, ok := c.data[slug]; ok && frontendID == "" {
		frontendID = existing.FrontendID
	}

	c.data[slug] = &ProblemStatus{
		FrontendID:  frontendID,
		Slug:        slug,
		Title:       title,
		TitleCn:     titleCn,
		Difficulty:  difficulty,
		PaidOnly:    paidOnly,
		TopicTags:   topicTags,
		OnlineCount: count,
		LastUpdated: time.Now(),
	}
}

// Get 获取单个题目状态
func (c *MemoryCache) Get(slug string) (*ProblemStatus, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	status, ok := c.data[slug]
	return status, ok
}

// GetAll 获取所有题目状态
func (c *MemoryCache) GetAll() []*ProblemStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make([]*ProblemStatus, 0, len(c.data))
	for _, v := range c.data {
		result = append(result, v)
	}
	return result
}

// GetHot100 获取Hot100题目状态（按配置顺序）
func (c *MemoryCache) GetHot100(problemSlugs []string) []*ProblemStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make([]*ProblemStatus, 0, len(problemSlugs))
	for _, slug := range problemSlugs {
		if status, ok := c.data[slug]; ok {
			result = append(result, status)
		}
	}
	return result
}

// GetTotalOnline 获取总在线人数
func (c *MemoryCache) GetTotalOnline() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	total := 0
	for _, v := range c.data {
		total += v.OnlineCount
	}
	return total
}
