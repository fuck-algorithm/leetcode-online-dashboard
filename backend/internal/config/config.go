package config

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
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
	DBHost          string
	DBPort          string
	DBUser          string
	DBPassword      string
	DBName          string
	DBSSLMode       string
	DBTimeZone      string
	RedisHost       string
	RedisPort       string
	RedisPassword   string
	RedisDB         int
	RedisKeyPrefix  string
	RedisPoolSize   int
	ServerPort      string
	BatchSize       int
	IntervalSec     int
	CrawlCOM        bool
	APICacheTTLSec  int
	RateLimitPerMin int
	Problems        []string      // slugs only for backward compatibility
	ProblemData     []ProblemInfo // full problem data with FrontendID
}

// Load loads configuration from environment variables.
// A .env file in the working directory or one of its parents is loaded first;
// real environment variables always take precedence.
func Load() *Config {
	loadEnvFile()
	problemData := loadProblemDataFromJSON()
	problems := make([]string, len(problemData))
	for i, p := range problemData {
		problems[i] = p.Slug
	}

	cfg := &Config{
		DBHost:         getEnv("DB_HOST", "localhost"),
		DBPort:         getEnv("DB_PORT", "5432"),
		DBUser:         getEnv("DB_USER", "postgres"),
		DBPassword:     getEnv("DB_PASSWORD", ""),
		DBName:         getEnv("DB_NAME", "leetcode_dashboard"),
		DBSSLMode:      getEnv("DB_SSLMODE", "disable"),
		DBTimeZone:     getEnv("DB_TIMEZONE", "Asia/Shanghai"),
		RedisHost:      getEnv("REDIS_HOST", "localhost"),
		RedisPort:      getEnv("REDIS_PORT", "6379"),
		RedisPassword:  getEnv("REDIS_PASSWORD", ""),
		RedisDB:        getEnvInt("REDIS_DB", 0),
		RedisKeyPrefix:  getEnv("REDIS_KEY_PREFIX", ""),
		RedisPoolSize:   getEnvInt("REDIS_POOL_SIZE", 20),
		ServerPort:      getEnv("PORT", "52106"),
		BatchSize:       getEnvInt("BATCH_SIZE", 10),
		IntervalSec:     getEnvInt("INTERVAL_SEC", 30),
		CrawlCOM:        getEnvBool("CRAWL_COM", false),
		APICacheTTLSec:  getEnvInt("API_CACHE_TTL_SECONDS", 30),
		RateLimitPerMin: getEnvInt("RATE_LIMIT_PER_MINUTE", 300),
		Problems:        problems,
		ProblemData:     problemData,
	}

	return cfg
}

// loadEnvFile loads the first .env found while walking up from the working
// directory. Existing environment variables are not overridden.
func loadEnvFile() {
	for _, path := range []string{".env", "../.env", "../../.env"} {
		if _, err := os.Stat(path); err == nil {
			if err := godotenv.Load(path); err != nil {
				log.Printf("Warning: failed to load %s: %v", path, err)
			}
			return
		}
	}
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

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
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

// DSN returns the PostgreSQL connection string (libpq keyword/value format).
func (c *Config) DSN() string {
	// Escape backslashes and single quotes for libpq's quoted value syntax.
	password := strings.ReplaceAll(c.DBPassword, `\`, `\\`)
	password = strings.ReplaceAll(password, `'`, `\'`)
	return fmt.Sprintf(
		"host=%s port=%s user=%s password='%s' dbname=%s sslmode=%s TimeZone=%s",
		c.DBHost, c.DBPort, c.DBUser, password, c.DBName, c.DBSSLMode, c.DBTimeZone,
	)
}
