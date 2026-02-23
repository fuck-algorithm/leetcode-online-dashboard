package handlers

import (
	"time"

	"github.com/gin-gonic/gin"
)

// HealthCheck returns the health status
func HealthCheck(c *gin.Context) {
	Success(c, gin.H{
		"status":    "healthy",
		"timestamp": time.Now(),
	})
}
