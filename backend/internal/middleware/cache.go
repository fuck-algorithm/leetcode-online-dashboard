package middleware

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// CacheEntry 缓存条目
type CacheEntry struct {
	Data      []byte
	Timestamp time.Time
	Status    int
}

// APICache API响应缓存
type APICache struct {
	entries map[string]*CacheEntry
	mu      sync.RWMutex
	ttl     time.Duration
}

// NewAPICache 创建新的API缓存
func NewAPICache(ttl time.Duration) *APICache {
	cache := &APICache{
		entries: make(map[string]*CacheEntry),
		ttl:     ttl,
	}
	// 启动清理协程
	go cache.cleanup()
	return cache
}

// Get 获取缓存
func (c *APICache) Get(key string) (*CacheEntry, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.entries[key]
	if !ok {
		return nil, false
	}

	// 检查是否过期
	if time.Since(entry.Timestamp) > c.ttl {
		return nil, false
	}

	return entry, true
}

// Set 设置缓存
func (c *APICache) Set(key string, data []byte, status int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries[key] = &CacheEntry{
		Data:      data,
		Timestamp: time.Now(),
		Status:    status,
	}
}

// GenerateKey 生成缓存键
func (cache *APICache) GenerateKey(ctx *gin.Context) string {
	// 基于请求路径和查询参数生成键
	data := ctx.Request.URL.Path + ctx.Request.URL.RawQuery
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("%x", hash)
}

// cleanup 定期清理过期缓存
func (c *APICache) cleanup() {
	ticker := time.NewTicker(c.ttl)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		for key, entry := range c.entries {
			if time.Since(entry.Timestamp) > c.ttl {
				delete(c.entries, key)
			}
		}
		c.mu.Unlock()
	}
}

// CacheMiddleware 返回Gin缓存中间件
func CacheMiddleware(ttl time.Duration) gin.HandlerFunc {
	cache := NewAPICache(ttl)

	return func(c *gin.Context) {
		// 只缓存GET请求
		if c.Request.Method != http.MethodGet {
			c.Next()
			return
		}

		// 跳过某些路径（如/admin, /health等）
		path := c.Request.URL.Path
		if shouldSkipCache(path) {
			c.Next()
			return
		}

		// 生成缓存键
		cacheKey := cache.GenerateKey(c)

		// 尝试获取缓存
		if entry, ok := cache.Get(cacheKey); ok {
			c.Writer.Header().Set("X-Cache", "HIT")
			c.Data(entry.Status, "application/json", entry.Data)
			c.Abort()
			return
		}

		// 记录响应
		writer := &responseRecorder{
			ResponseWriter: c.Writer,
			body:           make([]byte, 0),
			status:         http.StatusOK,
		}
		c.Writer = writer

		c.Next()

		// 只缓存成功的响应
		if writer.status >= 200 && writer.status < 300 {
			cache.Set(cacheKey, writer.body, writer.status)
		}

		c.Writer.Header().Set("X-Cache", "MISS")
	}
}

// shouldSkipCache 检查是否跳过缓存。
// 高频数据接口（/api/hot100、/api/problems、/api/statistics 等）都应走
// Redis 缓存以承受较大并发；只跳过健康检查、管理/导出与流式端点。
func shouldSkipCache(path string) bool {
	skipPaths := []string{
		"/api/health",
		"/api/admin",
		"/api/export",
		"/ws",
		"/mcp",
		"/sse",
		"/message",
	}

	for _, skip := range skipPaths {
		if path == skip || len(path) > len(skip) && path[:len(skip)] == skip {
			return true
		}
	}
	return false
}

// responseRecorder 记录响应
type responseRecorder struct {
	gin.ResponseWriter
	body   []byte
	status int
}

func (r *responseRecorder) Write(data []byte) (int, error) {
	r.body = append(r.body, data...)
	return r.ResponseWriter.Write(data)
}

func (r *responseRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *responseRecorder) WriteString(s string) (int, error) {
	r.body = append(r.body, s...)
	return r.ResponseWriter.WriteString(s)
}

// WriteJSON 写入JSON并缓存
func (r *responseRecorder) WriteJSON(v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	r.body = append(r.body, data...)
	return nil
}
