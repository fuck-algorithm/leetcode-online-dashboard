package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	client *redis.Client
	ctx    = context.Background()
)

// Config Redis configuration
type Config struct {
	Host     string
	Port     string
	Password string
	DB       int
}

// ProblemOnlineStatus 题目在线状态
type ProblemOnlineStatus struct {
	FrontendID  string    `json:"frontend_id"`
	Slug        string    `json:"slug"`
	Title       string    `json:"title"`
	TitleCn     string    `json:"title_cn"`
	Difficulty  string    `json:"difficulty"`
	PaidOnly    bool      `json:"paid_only"`
	TopicTags   []string  `json:"topic_tags"`
	OnlineCount int       `json:"online_count"`
	LastUpdated time.Time `json:"last_updated"`
}

// Init 初始化 Redis 连接
func Init(cfg *Config) error {
	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	client = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	// 测试连接
	if err := client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Printf("Redis connected to %s", addr)
	return nil
}

// GetClient 获取 Redis 客户端
func GetClient() *redis.Client {
	return client
}

// Close 关闭 Redis 连接
func Close() error {
	if client != nil {
		return client.Close()
	}
	return nil
}

const (
	// KeyPrefix 键前缀
	KeyPrefix = "leetcode:"
	// KeyProblemOnline 题目在线人数键
	KeyProblemOnline = KeyPrefix + "online:"
	// KeyProblemMeta 题目元数据键
	KeyProblemMeta = KeyPrefix + "meta:"
	// KeyTotalOnline 总在线人数键
	KeyTotalOnline = KeyPrefix + "total:online"
	// KeyHot100List Hot100 列表键
	KeyHot100List = KeyPrefix + "hot100:list"
)

// UpdateOnlineCount 更新题目在线人数
func UpdateOnlineCount(slug string, status *ProblemOnlineStatus) error {
	key := KeyProblemOnline + slug
	data, err := json.Marshal(status)
	if err != nil {
		return err
	}

	// 使用管道批量操作
	pipe := client.Pipeline()
	pipe.Set(ctx, key, data, 24*time.Hour) // 24小时过期
	pipe.ZAdd(ctx, KeyHot100List, redis.Z{
		Score:  float64(status.LastUpdated.Unix()),
		Member: slug,
	})

	_, err = pipe.Exec(ctx)
	return err
}

// GetOnlineCount 获取题目在线人数
func GetOnlineCount(slug string) (*ProblemOnlineStatus, error) {
	key := KeyProblemOnline + slug
	data, err := client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var status ProblemOnlineStatus
	if err := json.Unmarshal(data, &status); err != nil {
		return nil, err
	}
	return &status, nil
}

// GetAllOnlineCounts 获取所有题目在线人数
func GetAllOnlineCounts() ([]*ProblemOnlineStatus, error) {
	// 使用 SCAN 获取所有在线人数键
	var cursor uint64
	var results []*ProblemOnlineStatus

	for {
		keys, nextCursor, err := client.Scan(ctx, cursor, KeyProblemOnline+"*", 100).Result()
		if err != nil {
			return nil, err
		}

		for _, key := range keys {
			data, err := client.Get(ctx, key).Bytes()
			if err != nil {
				continue
			}
			var status ProblemOnlineStatus
			if err := json.Unmarshal(data, &status); err != nil {
				continue
			}
			results = append(results, &status)
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return results, nil
}

// GetHot100OnlineCounts 获取 Hot100 题目在线人数
func GetHot100OnlineCounts(slugs []string) ([]*ProblemOnlineStatus, error) {
	results := make([]*ProblemOnlineStatus, 0, len(slugs))

	for _, slug := range slugs {
		status, err := GetOnlineCount(slug)
		if err != nil {
			continue
		}
		if status != nil {
			results = append(results, status)
		}
	}

	return results, nil
}

// UpdateTotalOnline 更新总在线人数
func UpdateTotalOnline(total int) error {
	return client.Set(ctx, KeyTotalOnline, total, 24*time.Hour).Err()
}

// GetTotalOnline 获取总在线人数
func GetTotalOnline() (int, error) {
	val, err := client.Get(ctx, KeyTotalOnline).Int()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return val, nil
}

// PublishOnlineUpdate 发布在线人数更新（用于实时通知）
func PublishOnlineUpdate(slug string, count int) error {
	msg := map[string]interface{}{
		"slug":  slug,
		"count": count,
		"time":  time.Now().Unix(),
	}
	data, _ := json.Marshal(msg)
	return client.Publish(ctx, KeyPrefix+"updates", data).Err()
}

// SubscribeOnlineUpdates 订阅在线人数更新
func SubscribeOnlineUpdates(handler func(slug string, count int)) {
	sub := client.Subscribe(ctx, KeyPrefix+"updates")
	ch := sub.Channel()

	go func() {
		for msg := range ch {
			var data map[string]interface{}
			if err := json.Unmarshal([]byte(msg.Payload), &data); err != nil {
				continue
			}
			slug, _ := data["slug"].(string)
			count, _ := data["count"].(float64)
			if slug != "" {
				handler(slug, int(count))
			}
		}
	}()
}
