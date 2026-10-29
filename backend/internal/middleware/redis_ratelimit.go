package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// redisRateLimitScript implements a sliding-window rate limiter atomically in
// Redis: a sorted set holds the request timestamps of one client within the
// window, expired members are removed, and a new member is added only while
// the count stays below the limit.
var redisRateLimitScript = redis.NewScript(`
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  return 0
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return 1
`)

// RedisRateLimitMiddleware limits a client to `limit` requests per `window`,
// backed by Redis so the limit is shared across server instances. When Redis
// is unavailable it falls back to a per-process limiter.
func RedisRateLimitMiddleware(client *redis.Client, limit int, window time.Duration) gin.HandlerFunc {
	fallback := RateLimitMiddleware(limit, window)
	ctx := context.Background()
	windowMs := window.Milliseconds()

	return func(c *gin.Context) {
		// Unique member per request: same IP+path within one millisecond must
		// not collapse into one ZSET member, which would under-count.
		var rb [16]byte
		rand.Read(rb[:])
		member := c.ClientIP() + ":" + c.Request.URL.Path + ":" + c.Request.Method + ":" + hex.EncodeToString(rb[:])
		key := "leetcode-dashboard:ratelimit:" + c.ClientIP()
		allowed, err := redisRateLimitScript.Run(ctx, client, []string{key},
			time.Now().UnixMilli(), windowMs, limit, member).Int()
		if err != nil || allowed == 0 {
			if err != nil {
				// Redis down: degrade to the in-memory limiter.
				fallback(c)
				return
			}
			c.Header("X-RateLimit-Limit", itoa(limit))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "Rate limit exceeded. Please try again later.",
				"code":    429,
				"limit":   limit,
				"window":  window.Seconds(),
				"message": "请求过于频繁，请稍后再试",
			})
			c.Abort()
			return
		}
		c.Header("X-RateLimit-Limit", itoa(limit))
		c.Next()
	}
}

func itoa(v int) string {
	if v == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for v > 0 {
		i--
		buf[i] = byte('0' + v%10)
		v /= 10
	}
	return string(buf[i:])
}