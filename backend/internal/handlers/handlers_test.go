package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
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

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "ok", response["status"])
}

func TestGetProblems(t *testing.T) {
	router := setupTestRouter()
	router.GET("/api/problems", GetProblems)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/problems", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Contains(t, response, "problems")
}

func TestGetHot100(t *testing.T) {
	router := setupTestRouter()
	router.GET("/api/hot100", GetHot100)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/hot100", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Contains(t, response, "problems")
	assert.Contains(t, response, "stats")
}

func TestCORSHeaders(t *testing.T) {
	router := setupTestRouter()
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Next()
	})
	router.GET("/api/health", HealthCheck)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("OPTIONS", "/api/health", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
}
