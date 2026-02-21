package middleware

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

// Metrics holds performance metrics
type Metrics struct {
	RequestCount   uint64
	ErrorCount     uint64
	TotalLatency   int64
	ActiveRequests int64
}

var (
	metrics     *Metrics
	metricsOnce sync.Once
)

// GetMetrics returns the singleton metrics instance
func GetMetrics() *Metrics {
	metricsOnce.Do(func() {
		metrics = &Metrics{}
	})
	return metrics
}

// MetricsMiddleware tracks request metrics
func MetricsMiddleware() gin.HandlerFunc {
	m := GetMetrics()
	
	return func(c *gin.Context) {
		start := time.Now()
		
		// Increment active requests
		atomic.AddInt64(&m.ActiveRequests, 1)
		defer atomic.AddInt64(&m.ActiveRequests, -1)
		
		// Increment total requests
		atomic.AddUint64(&m.RequestCount, 1)
		
		// Process request
		c.Next()
		
		// Record latency
		duration := time.Since(start).Milliseconds()
		atomic.AddInt64(&m.TotalLatency, duration)
		
		// Record errors
		if c.Writer.Status() >= 400 {
			atomic.AddUint64(&m.ErrorCount, 1)
		}
	}
}

// GetStats returns current metrics
func (m *Metrics) GetStats() map[string]interface{} {
	reqCount := atomic.LoadUint64(&m.RequestCount)
	errCount := atomic.LoadUint64(&m.ErrorCount)
	totalLatency := atomic.LoadInt64(&m.TotalLatency)
	activeReqs := atomic.LoadInt64(&m.ActiveRequests)
	
	var avgLatency float64
	if reqCount > 0 {
		avgLatency = float64(totalLatency) / float64(reqCount)
	}
	
	errorRate := float64(0)
	if reqCount > 0 {
		errorRate = float64(errCount) / float64(reqCount) * 100
	}
	
	return map[string]interface{}{
		"request_count":   reqCount,
		"error_count":     errCount,
		"error_rate":      errorRate,
		"avg_latency_ms":  avgLatency,
		"active_requests": activeReqs,
	}
}

// Reset clears all metrics
func (m *Metrics) Reset() {
	atomic.StoreUint64(&m.RequestCount, 0)
	atomic.StoreUint64(&m.ErrorCount, 0)
	atomic.StoreInt64(&m.TotalLatency, 0)
	atomic.StoreInt64(&m.ActiveRequests, 0)
}
