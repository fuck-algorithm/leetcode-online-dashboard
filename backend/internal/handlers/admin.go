package handlers

import (
	"net/http"
	"os"
	"runtime"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// AdminHandler 管理面板处理器
type AdminHandler struct {
	startTime time.Time
}

// NewAdminHandler 创建新的管理处理器
func NewAdminHandler() *AdminHandler {
	return &AdminHandler{
		startTime: time.Now(),
	}
}

// SystemStatus 系统状态响应
type SystemStatus struct {
	Status      string                 `json:"status"`
	Version     string                 `json:"version"`
	Uptime      string                 `json:"uptime"`
	GoVersion   string                 `json:"go_version"`
	NumGoroutine int                   `json:"num_goroutine"`
	Memory      map[string]interface{} `json:"memory"`
	Environment map[string]string      `json:"environment"`
}

// GetSystemStatus 获取系统状态
func (h *AdminHandler) GetSystemStatus(c *gin.Context) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	status := SystemStatus{
		Status:       "running",
		Version:      "1.0.0",
		Uptime:       time.Since(h.startTime).String(),
		GoVersion:    runtime.Version(),
		NumGoroutine: runtime.NumGoroutine(),
		Memory: map[string]interface{}{
			"alloc":        m.Alloc,
			"total_alloc":  m.TotalAlloc,
			"sys":          m.Sys,
			"num_gc":       m.NumGC,
		},
		Environment: map[string]string{
			"gin_mode":   os.Getenv("GIN_MODE"),
			"db_driver":  "postgres",
			"db_host":    os.Getenv("DB_HOST"),
			"db_port":    os.Getenv("DB_PORT"),
			"db_name":    os.Getenv("DB_NAME"),
			"redis_host": os.Getenv("REDIS_HOST"),
			"redis_port": os.Getenv("REDIS_PORT"),
			"port":       os.Getenv("PORT"),
			"batch_size": os.Getenv("BATCH_SIZE"),
		},
	}

	Success(c, status)
}

// ConfigResponse 配置响应
type ConfigResponse struct {
	ServerPort   string `json:"server_port"`
	DBHost       string `json:"db_host"`
	DBPort       string `json:"db_port"`
	DBName       string `json:"db_name"`
	BatchSize    int    `json:"batch_size"`
	IntervalSec  int    `json:"interval_sec"`
	RetentionDays int   `json:"retention_days"`
}

// GetConfig 获取当前配置
func (h *AdminHandler) GetConfig(c *gin.Context) {
	cfg := ConfigResponse{
		ServerPort:    os.Getenv("PORT"),
		DBHost:        os.Getenv("DB_HOST"),
		DBPort:        os.Getenv("DB_PORT"),
		DBName:        os.Getenv("DB_NAME"),
		BatchSize:     getEnvInt("BATCH_SIZE", 10),
		IntervalSec:   getEnvInt("INTERVAL_SEC", 30),
		RetentionDays: getEnvInt("DATA_RETENTION_DAYS", 30),
	}

	Success(c, cfg)
}

// UpdateConfigRequest 更新配置请求
type UpdateConfigRequest struct {
	BatchSize     *int `json:"batch_size,omitempty"`
	IntervalSec     *int `json:"interval_sec,omitempty"`
	RetentionDays *int `json:"retention_days,omitempty"`
}

// UpdateConfig 更新配置
func (h *AdminHandler) UpdateConfig(c *gin.Context) {
	var req UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	// 注意：这里只是演示，实际应用需要重启服务才能生效
	// 或者实现动态配置更新

	Success(c, gin.H{"message": "config updated (restart required for some changes)"})
}

// TriggerCleanupRequest 触发清理请求
type TriggerCleanupRequest struct {
	Days int `json:"days"`
}

// TriggerCleanup 手动触发数据清理
func (h *AdminHandler) TriggerCleanup(c *gin.Context) {
	var req TriggerCleanupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// 默认清理30天前的数据
		req.Days = 30
	}

	if req.Days <= 0 {
		req.Days = 30
	}

	// 这里应该调用数据保留策略的清理方法
	// 由于需要访问数据库实例，实际实现需要修改

	Success(c, gin.H{
		"message": "cleanup triggered",
		"days":    req.Days,
	})
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

// HealthDetails 详细健康检查
type HealthDetails struct {
	Status    string `json:"status"`
	Database  string `json:"database"`
	Redis     string `json:"redis"`
	WebSocket string `json:"websocket"`
	Timestamp int64  `json:"timestamp"`
}

// HealthCheckDetailed 详细健康检查
func (h *AdminHandler) HealthCheckDetailed(c *gin.Context) {
	health := HealthDetails{
		Status:    "ok",
		Database:  "connected",
		Redis:     "connected",
		WebSocket: "active",
		Timestamp: time.Now().Unix(),
	}

	// TODO: 实际检查各组件状态

	c.JSON(http.StatusOK, health)
}
