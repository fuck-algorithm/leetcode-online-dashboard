package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RedisCacheMiddleware caches successful GET responses in Redis. The local
// cache remains the fallback when Redis is unavailable.
func RedisCacheMiddleware(client *redis.Client, ttl time.Duration) gin.HandlerFunc {
	local := NewAPICache(ttl)
	ctx := context.Background()

	return func(c *gin.Context) {
		if c.Request.Method != http.MethodGet || shouldSkipCache(c.Request.URL.Path) {
			c.Next()
			return
		}

		key := redisResponseKey(c)
		if raw, err := client.Get(ctx, key).Bytes(); err == nil {
			c.Header("X-Cache", "HIT")
			c.Data(http.StatusOK, "application/json", raw)
			c.Abort()
			return
		}
		if entry, ok := local.Get(key); ok {
			c.Header("X-Cache", "LOCAL-HIT")
			c.Data(entry.Status, "application/json", entry.Data)
			c.Abort()
			return
		}

		writer := &responseRecorder{ResponseWriter: c.Writer, body: make([]byte, 0), status: http.StatusOK}
		c.Writer = writer
		c.Next()
		if writer.status >= 200 && writer.status < 300 && len(writer.body) > 0 {
			if err := client.Set(ctx, key, writer.body, ttl).Err(); err != nil {
				local.Set(key, writer.body, writer.status)
			}
		}
		c.Header("X-Cache", "MISS")
	}
}

func redisResponseKey(c *gin.Context) string {
	sum := sha256.Sum256([]byte(c.Request.URL.Path + "?" + c.Request.URL.RawQuery))
	return "leetcode-dashboard:api-cache:" + hex.EncodeToString(sum[:])
}
