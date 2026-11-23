package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"leetcode-dashboard/internal/middleware"
)

func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	return router
}

func TestHealthCheck(t *testing.T) {
	router := setupTestRouter()
	router.GET("/api/health", HealthCheck)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/health", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)

	var response Response
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, 200, response.Code)
	assert.Equal(t, "success", response.Msg)
}

// 测试环境没有 PostgreSQL 也没有 Redis。两个接口都必须优雅降级：
// 返回 200 + 题目元数据（在线人数为 0），而不是 panic 或 500。
func TestGetProblemsDegradesWithoutDependencies(t *testing.T) {
	router := setupTestRouter()
	router.GET("/api/problems", GetProblems)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/problems", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)

	var response Response
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
	assert.Equal(t, 200, response.Code)

	problems, ok := response.Data.([]interface{})
	assert.True(t, ok, "data should be an array of problems")
	assert.NotEmpty(t, problems)

	first := problems[0].(map[string]interface{})
	for _, field := range []string{"slug", "online_count", "online_count_cn", "online_count_com"} {
		assert.Contains(t, first, field)
	}
	assert.Equal(t, float64(0), first["online_count"])
}

func TestGetHot100DegradesWithoutDependencies(t *testing.T) {
	router := setupTestRouter()
	router.GET("/api/hot100", GetHot100)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/hot100", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)

	var response Response
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
	assert.Equal(t, 200, response.Code)

	problems, ok := response.Data.([]interface{})
	assert.True(t, ok, "data should be an array of problems")
	assert.NotEmpty(t, problems)
}

// gin 对未注册路由的预检请求返回 404，所以这里直接验证项目真正使用的
// CORS 中间件（middleware.CORSMiddleware）是否给预检请求加上了响应头。
func TestCORSHeaders(t *testing.T) {
	router := setupTestRouter()
	router.Use(middleware.CORSMiddleware())
	router.GET("/api/health", HealthCheck)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("OPTIONS", "/api/health", nil)
	req.Header.Set("Origin", "https://example.com")
	req.Header.Set("Access-Control-Request-Method", "GET")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
	assert.NotEmpty(t, w.Header().Get("Access-Control-Allow-Methods"))
}
