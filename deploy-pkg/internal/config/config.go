package config

import (
	"encoding/json"
	"log"
	"os"
	"strconv"
)

// ProblemInfo holds basic problem information from JSON
type ProblemInfo struct {
	ID         string   `json:"id"`
	Slug       string   `json:"slug"`
	Title      string   `json:"title"`
	TitleCn    string   `json:"title_cn"`
	Difficulty string   `json:"difficulty"`
	PaidOnly   bool     `json:"paid_only"`
	TopicTags  []string `json:"topic_tags"`
}

// Config holds all configuration
type Config struct {
	DBHost       string
	DBPort       string
	DBUser       string
	DBPassword   string
	DBName       string
	ServerPort   string
	BatchSize    int
	IntervalSec  int
	Problems     []string      // slugs only for backward compatibility
	ProblemData  []ProblemInfo // full problem data with FrontendID
}

// Load loads configuration from environment variables
func Load() *Config {
	problemData := loadProblemDataFromJSON()
	problems := make([]string, len(problemData))
	for i, p := range problemData {
		problems[i] = p.Slug
	}

	cfg := &Config{
		DBHost:      getEnv("DB_HOST", "localhost"),
		DBPort:      getEnv("DB_PORT", "3306"),
		DBUser:      getEnv("DB_USER", "root"),
		DBPassword:  getEnv("DB_PASSWORD", ""),
		DBName:      getEnv("DB_NAME", "leetcode_dashboard"),
		ServerPort:  getEnv("PORT", "52106"),
		BatchSize:   getEnvInt("BATCH_SIZE", 10),
		IntervalSec: getEnvInt("INTERVAL_SEC", 30),
		Problems:    problems,
		ProblemData: problemData,
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

// loadProblemDataFromJSON loads problem data from the hot100_with_cn.json file
// This is the single source of truth for Hot 100 problems
func loadProblemDataFromJSON() []ProblemInfo {
	// Try to find the JSON file
	possiblePaths := []string{
		"data/hot100_with_cn.json",
		"../data/hot100_with_cn.json",
		"../../data/hot100_with_cn.json",
		"backend/data/hot100_with_cn.json",
	}

	var dataPath string
	for _, path := range possiblePaths {
		if _, err := os.Stat(path); err == nil {
			dataPath = path
			break
		}
	}

	if dataPath == "" {
		log.Fatalf("Error: hot100_with_cn.json not found. Please ensure the JSON file exists in the data directory.")
	}

	data, err := os.ReadFile(dataPath)
	if err != nil {
		log.Fatalf("Error: Failed to read %s: %v", dataPath, err)
	}

	var problems []ProblemInfo
	if err := json.Unmarshal(data, &problems); err != nil {
		log.Fatalf("Error: Failed to parse %s: %v", dataPath, err)
	}

	log.Printf("Loaded %d problems from %s", len(problems), dataPath)
	return problems
}

// convertToProblemInfo converts slug list to ProblemInfo list (kept for compatibility)
func convertToProblemInfo(slugs []string) []ProblemInfo {
	result := make([]ProblemInfo, len(slugs))
	for i, slug := range slugs {
		result[i] = ProblemInfo{
			ID:   "", // Will be populated later
			Slug: slug,
		}
	}
	return result
}

// DSN returns MySQL connection string
func (c *Config) DSN() string {
	return c.DBUser + ":" + c.DBPassword + "@tcp(" + c.DBHost + ":" + c.DBPort + ")/" + c.DBName + "?charset=utf8mb4&parseTime=True&loc=Local"
}
