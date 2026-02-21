package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

// LoggerConfig holds logging configuration
type LoggerConfig struct {
	Format string
	Output string
}

// StructuredLogger returns a structured logging middleware
func StructuredLogger() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		return fmt.Sprintf("%s - [%s] \"%s %s %s %d %s \"%s\" %s\"\n",
			param.ClientIP,
			param.TimeStamp.Format(time.RFC1123),
			param.Method,
			param.Path,
			param.Request.Proto,
			param.StatusCode,
			param.Latency,
			param.Request.UserAgent(),
			param.ErrorMessage,
		)
	})
}
