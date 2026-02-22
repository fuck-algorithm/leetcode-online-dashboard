package cache

import (
	"leetcode-dashboard/internal/redis"
	"sync"
	"time"
)

// RedisCache Redis 缓存适配器，兼容 MemoryCache 接口
type RedisCache struct {
	// 本地缓存用于快速读取，避免每次 Redis 查询
	localCache *MemoryCache
	mu         sync.RWMutex
	enabled    bool
}

var redisInstance *RedisCache
var redisOnce sync.Once

// GetRedisCache 获取 Redis 缓存实例
func GetRedisCache() *RedisCache {
	redisOnce.Do(func() {
		redisInstance = &RedisCache{
			localCache: GetCache(),
			enabled:    false,
		}
	})
	return redisInstance
}

// EnableRedis 启用 Redis 模式
func (c *RedisCache) EnableRedis() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.enabled = true
}

// IsEnabled 检查是否启用 Redis
func (c *RedisCache) IsEnabled() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.enabled
}

// Update 更新题目在线人数（优先 Redis，本地缓存作为 fallback）
func (c *RedisCache) Update(slug string, count int, frontendID string, title string, titleCn string, difficulty string, paidOnly bool, topicTags []string) {
	// 总是更新本地缓存
	c.localCache.Update(slug, count, frontendID, titleCn, title, difficulty, paidOnly, topicTags)

	// 如果 Redis 启用，同时更新 Redis
	if c.IsEnabled() {
		status := &redis.ProblemOnlineStatus{
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
		redis.UpdateOnlineCount(slug, status)
	}
}

// Get 获取单个题目状态（优先 Redis）
func (c *RedisCache) Get(slug string) (*ProblemStatus, bool) {
	// 如果 Redis 启用，尝试从 Redis 获取
	if c.IsEnabled() {
		status, err := redis.GetOnlineCount(slug)
		if err == nil && status != nil {
			return &ProblemStatus{
				FrontendID:  status.FrontendID,
				Slug:        status.Slug,
				Title:       status.Title,
				TitleCn:     status.TitleCn,
				Difficulty:  status.Difficulty,
				PaidOnly:    status.PaidOnly,
				TopicTags:   status.TopicTags,
				OnlineCount: status.OnlineCount,
				LastUpdated: status.LastUpdated,
			}, true
		}
	}

	// 回退到本地缓存
	return c.localCache.Get(slug)
}

// GetAll 获取所有题目状态（优先 Redis）
func (c *RedisCache) GetAll() []*ProblemStatus {
	// 如果 Redis 启用，从 Redis 获取
	if c.IsEnabled() {
		statuses, err := redis.GetAllOnlineCounts()
		if err == nil && len(statuses) > 0 {
			result := make([]*ProblemStatus, 0, len(statuses))
			for _, s := range statuses {
				result = append(result, &ProblemStatus{
					FrontendID:  s.FrontendID,
					Slug:        s.Slug,
					Title:       s.Title,
					TitleCn:     s.TitleCn,
					Difficulty:  s.Difficulty,
					PaidOnly:    s.PaidOnly,
					TopicTags:   s.TopicTags,
					OnlineCount: s.OnlineCount,
					LastUpdated: s.LastUpdated,
				})
			}
			return result
		}
	}

	// 回退到本地缓存
	return c.localCache.GetAll()
}

// GetHot100 获取 Hot100 题目状态（优先 Redis）
func (c *RedisCache) GetHot100(problemSlugs []string) []*ProblemStatus {
	// 如果 Redis 启用，从 Redis 获取
	if c.IsEnabled() {
		statuses, err := redis.GetHot100OnlineCounts(problemSlugs)
		if err == nil && len(statuses) > 0 {
			result := make([]*ProblemStatus, 0, len(problemSlugs))
			for _, slug := range problemSlugs {
				found := false
				for _, s := range statuses {
					if s.Slug == slug {
						result = append(result, &ProblemStatus{
							FrontendID:  s.FrontendID,
							Slug:        s.Slug,
							Title:       s.Title,
							TitleCn:     s.TitleCn,
							Difficulty:  s.Difficulty,
							PaidOnly:    s.PaidOnly,
							TopicTags:   s.TopicTags,
							OnlineCount: s.OnlineCount,
							LastUpdated: s.LastUpdated,
						})
						found = true
						break
					}
				}
				if !found {
					// 如果在 Redis 中找不到，尝试从本地缓存获取
					if local, ok := c.localCache.Get(slug); ok {
						result = append(result, local)
					}
				}
			}
			return result
		}
	}

	// 回退到本地缓存
	return c.localCache.GetHot100(problemSlugs)
}

// GetTotalOnline 获取总在线人数（优先 Redis）
func (c *RedisCache) GetTotalOnline() int {
	// 如果 Redis 启用，从 Redis 获取
	if c.IsEnabled() {
		total, err := redis.GetTotalOnline()
		if err == nil {
			return total
		}
	}

	// 回退到本地缓存
	return c.localCache.GetTotalOnline()
}

// SyncFromRedis 从 Redis 同步数据到本地缓存
func (c *RedisCache) SyncFromRedis() {
	if !c.IsEnabled() {
		return
	}

	statuses, err := redis.GetAllOnlineCounts()
	if err != nil {
		return
	}

	for _, s := range statuses {
		c.localCache.Update(s.Slug, s.OnlineCount, s.FrontendID, s.Title, s.TitleCn, s.Difficulty, s.PaidOnly, s.TopicTags)
	}
}

// SubscribeUpdates 订阅 Redis 更新通知并同步到本地缓存
func (c *RedisCache) SubscribeUpdates() {
	if !c.IsEnabled() {
		return
	}

	redis.SubscribeOnlineUpdates(func(slug string, count int) {
		// 收到更新通知，从 Redis 获取最新数据并更新本地缓存
		status, err := redis.GetOnlineCount(slug)
		if err == nil && status != nil {
			c.localCache.Update(slug, count, status.FrontendID, status.Title, status.TitleCn, status.Difficulty, status.PaidOnly, status.TopicTags)
		}
	})
}
