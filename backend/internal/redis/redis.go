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

// ProblemOnlineStatus 题目在线状态 - 支持双站点
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
	Site        string    `json:"site"` // "cn" or "com"
}

// ProblemMetaInfo holds problem metadata for updates
type ProblemMetaInfo struct {
	FrontendID string
	Title      string
	TitleCn    string
	Difficulty string
	PaidOnly   bool
	TopicTags  []string
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
	// KeyProblemOnline 题目在线人数键 (统合数据)
	KeyProblemOnline = KeyPrefix + "online:"
	// KeyProblemOnlineCN 题目在线人数键 (CN站点)
	KeyProblemOnlineCN = KeyPrefix + "online:cn:"
	// KeyProblemOnlineCOM 题目在线人数键 (COM站点)
	KeyProblemOnlineCOM = KeyPrefix + "online:com:"
	// KeyProblemMeta 题目元数据键
	KeyProblemMeta = KeyPrefix + "meta:"
	// KeyTotalOnline 总在线人数键 (统合)
	KeyTotalOnline = KeyPrefix + "total:online"
	// KeyTotalOnlineCN 总在线人数键 (CN站点)
	KeyTotalOnlineCN = KeyPrefix + "total:online:cn"
	// KeyTotalOnlineCOM 总在线人数键 (COM站点)
	KeyTotalOnlineCOM = KeyPrefix + "total:online:com"
	// KeyTotalOnlineUnified 总在线人数键 (CN+COM汇总)
	KeyTotalOnlineUnified = KeyPrefix + "total:online:unified"
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

// ==================== 双站点支持函数 ====================

// UpdateOnlineCountWithSite 更新指定站点的题目在线人数
func UpdateOnlineCountWithSite(slug string, site interface{}, status *ProblemOnlineStatus) error {
	siteStr := ""
	switch s := site.(type) {
	case string:
		siteStr = s
	case interface{ String() string }:
		siteStr = s.String()
	default:
		siteStr = fmt.Sprintf("%v", site)
	}

	// 站点特定的key
	var key string
	switch siteStr {
	case "cn", "CN":
		key = KeyProblemOnlineCN + slug
	case "com", "COM":
		key = KeyProblemOnlineCOM + slug
	default:
		key = KeyProblemOnline + slug
	}

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

// GetOnlineCountBySite 获取指定站点的题目在线人数
func GetOnlineCountBySite(slug string, site string) (*ProblemOnlineStatus, error) {
	var key string
	switch site {
	case "cn", "CN":
		key = KeyProblemOnlineCN + slug
	case "com", "COM":
		key = KeyProblemOnlineCOM + slug
	default:
		key = KeyProblemOnline + slug
	}

	log.Printf("[GetOnlineCountBySite] Trying to get key: %s", key)
	
	data, err := client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		log.Printf("[GetOnlineCountBySite] Key not found: %s", key)
		return nil, nil
	}
	if err != nil {
		log.Printf("[GetOnlineCountBySite] Error reading key %s: %v", key, err)
		return nil, err
	}

	var status ProblemOnlineStatus
	if err := json.Unmarshal(data, &status); err != nil {
		log.Printf("[GetOnlineCountBySite] Error unmarshaling key %s: %v", key, err)
		return nil, err
	}
	
	log.Printf("[GetOnlineCountBySite] Success: %s has count=%d", key, status.OnlineCount)
	return &status, nil
}

// GetAllOnlineCountsBySite 获取指定站点的所有题目在线人数
func GetAllOnlineCountsBySite(site string) ([]*ProblemOnlineStatus, error) {
	var pattern string
	switch site {
	case "cn", "CN":
		pattern = KeyProblemOnlineCN + "*"
	case "com", "COM":
		pattern = KeyProblemOnlineCOM + "*"
	default:
		pattern = KeyProblemOnline + "*"
	}

	var cursor uint64
	var results []*ProblemOnlineStatus

	for {
		keys, nextCursor, err := client.Scan(ctx, cursor, pattern, 100).Result()
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

// GetTotalOnlineBySite 获取双站点的总在线人数
// 返回: CN总在线人数, COM总在线人数, 统合总在线人数, 错误
func GetTotalOnlineBySite() (int, int, int, error) {
	// 获取CN站点总数
	cnTotal, _ := client.Get(ctx, KeyTotalOnlineCN).Int()
	// 获取COM站点总数
	comTotal, _ := client.Get(ctx, KeyTotalOnlineCOM).Int()

	// 计算统合总数
	unifiedTotal := cnTotal + comTotal

	return cnTotal, comTotal, unifiedTotal, nil
}

// UpdateTotalOnlineBySite 更新双站点的总在线人数
func UpdateTotalOnlineBySite(cnTotal, comTotal, unifiedTotal int) error {
	pipe := client.Pipeline()
	pipe.Set(ctx, KeyTotalOnlineCN, cnTotal, 24*time.Hour)
	pipe.Set(ctx, KeyTotalOnlineCOM, comTotal, 24*time.Hour)
	pipe.Set(ctx, KeyTotalOnlineUnified, unifiedTotal, 24*time.Hour)
	_, err := pipe.Exec(ctx)
	return err
}

// PublishOnlineUpdateWithSite 发布带站点信息的在线人数更新
func PublishOnlineUpdateWithSite(slug string, site interface{}, count int) error {
	siteStr := ""
	switch s := site.(type) {
	case string:
		siteStr = s
	case interface{ String() string }:
		siteStr = s.String()
	default:
		siteStr = fmt.Sprintf("%v", site)
	}

	msg := map[string]interface{}{
		"slug":  slug,
		"site":  siteStr,
		"count": count,
		"time":  time.Now().Unix(),
	}
	data, _ := json.Marshal(msg)
	return client.Publish(ctx, KeyPrefix+"updates", data).Err()
}

// SubscribeOnlineUpdatesWithSite 订阅带站点信息的在线人数更新
func SubscribeOnlineUpdatesWithSite(handler func(slug string, site string, count int)) {
	sub := client.Subscribe(ctx, KeyPrefix+"updates")
	ch := sub.Channel()

	go func() {
		for msg := range ch {
			var data map[string]interface{}
			if err := json.Unmarshal([]byte(msg.Payload), &data); err != nil {
				continue
			}
			slug, _ := data["slug"].(string)
			site, _ := data["site"].(string)
			count, _ := data["count"].(float64)
			if slug != "" {
				handler(slug, site, int(count))
			}
		}
	}()
}

// BatchGetOnlineCountsBySite 批量获取指定站点的多个题目在线人数
// 使用 Pipeline 一次性获取所有数据，避免 N+1 查询问题
func BatchGetOnlineCountsBySite(slugs []string, site string) (map[string]*ProblemOnlineStatus, error) {
	if len(slugs) == 0 {
		return make(map[string]*ProblemOnlineStatus), nil
	}

	// 构建所有 key
	keys := make([]string, len(slugs))
	var keyPrefix string
	switch site {
	case "cn", "CN":
		keyPrefix = KeyProblemOnlineCN
	case "com", "COM":
		keyPrefix = KeyProblemOnlineCOM
	default:
		keyPrefix = KeyProblemOnline
	}

	for i, slug := range slugs {
		keys[i] = keyPrefix + slug
	}

	// 使用 Pipeline 批量获取
	pipe := client.Pipeline()
	cmds := make([]*redis.StringCmd, len(slugs))
	for i, key := range keys {
		cmds[i] = pipe.Get(ctx, key)
	}

	// 执行 Pipeline
	_, err := pipe.Exec(ctx)
	if err != nil && err != redis.Nil {
		return nil, err
	}

	// 解析结果
	results := make(map[string]*ProblemOnlineStatus)
	for i, cmd := range cmds {
		data, err := cmd.Bytes()
		if err == redis.Nil {
			continue // key 不存在，跳过
		}
		if err != nil {
			continue // 其他错误，跳过
		}

		var status ProblemOnlineStatus
		if err := json.Unmarshal(data, &status); err != nil {
			continue
		}
		results[slugs[i]] = &status
	}

	return results, nil
}
