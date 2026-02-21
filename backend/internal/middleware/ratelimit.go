package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter implements token bucket rate limiting
type RateLimiter struct {
	requests map[string][]time.Time
	mu       sync.RWMutex
	limit    int
	window   time.Duration
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
}

// RateLimitMiddleware returns a Gin middleware for rate limiting
func RateLimitMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	limiter := NewRateLimiter(limit, window)
	
	// Start cleanup goroutine
	go limiter.cleanup()
	
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		
		if !limiter.allowRequest(clientIP) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded. Please try again later.",
			})
			c.Abort()
			return
		}
		
		c.Next()
	}
}

// allowRequest checks if a request is allowed
func (rl *RateLimiter) allowRequest(clientID string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	
	now := time.Now()
	cutoff := now.Add(-rl.window)
	
	// Get existing requests for this client
	requests := rl.requests[clientID]
	
	// Filter out old requests
	var validRequests []time.Time
	for _, req := range requests {
		if req.After(cutoff) {
			validRequests = append(validRequests, req)
		}
	}
	
	// Check if under limit
	if len(validRequests) >= rl.limit {
		rl.requests[clientID] = validRequests
		return false
	}
	
	// Add new request
	validRequests = append(validRequests, now)
	rl.requests[clientID] = validRequests
	
	return true
}

// cleanup removes old entries periodically
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.window)
	defer ticker.Stop()
	
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-rl.window)
		
		for clientID, requests := range rl.requests {
			var validRequests []time.Time
			for _, req := range requests {
				if req.After(cutoff) {
					validRequests = append(validRequests, req)
				}
			}
			
			if len(validRequests) == 0 {
				delete(rl.requests, clientID)
			} else {
				rl.requests[clientID] = validRequests
			}
		}
		rl.mu.Unlock()
	}
}

// GetRateLimitInfo returns current rate limit status for a client
func (rl *RateLimiter) GetRateLimitInfo(clientID string) map[string]interface{} {
	rl.mu.RLock()
	defer rl.mu.RUnlock()
	
	requests := rl.requests[clientID]
	cutoff := time.Now().Add(-rl.window)
	
	var count int
	var oldest time.Time
	
	for _, req := range requests {
		if req.After(cutoff) {
			count++
			if oldest.IsZero() || req.Before(oldest) {
				oldest = req
			}
		}
	}
	
	resetTime := oldest.Add(rl.window)
	
	return map[string]interface{}{
		"limit":     rl.limit,
		"remaining": rl.limit - count,
		"reset":     resetTime,
		"window":    rl.window.Seconds(),
	}
}
