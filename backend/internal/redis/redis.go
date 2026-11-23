package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	client *redis.Client
	ctx    = context.Background()
	keyNS  keyNamespace
)

// DefaultKeyPrefix namespaces every key/channel owned by this application.
const DefaultKeyPrefix = "leetcode-dashboard:"

// keyNamespace holds the runtime key layout derived from the configured prefix.
type keyNamespace struct {
	Prefix             string
	ProblemOnline      string // unified (cn+com) online counts
	ProblemOnlineCN    string
	ProblemOnlineCOM   string
	ProblemMeta        string
	TotalOnline        string
	TotalOnlineCN      string
	TotalOnlineCOM     string
	TotalOnlineUnified string
	Hot100List         string
	UpdateChannel      string
}

func init() {
	applyKeyPrefix(DefaultKeyPrefix)
}

// applyKeyPrefix derives all key names from a single namespace prefix. A
// trailing colon is added when missing, so REDIS_KEY_PREFIX=myapp and
// REDIS_KEY_PREFIX=myapp: are equivalent.
func applyKeyPrefix(prefix string) {
	prefix = strings.TrimSpace(prefix)
	if prefix == "" {
		prefix = DefaultKeyPrefix
	}
	if !strings.HasSuffix(prefix, ":") {
		prefix += ":"
	}
	keyNS = keyNamespace{
		Prefix:             prefix,
		ProblemOnline:      prefix + "online:unified:",
		ProblemOnlineCN:    prefix + "online:cn:",
		ProblemOnlineCOM:   prefix + "online:com:",
		ProblemMeta:        prefix + "meta:",
		TotalOnline:        prefix + "total:online",
		TotalOnlineCN:      prefix + "total:online:cn",
		TotalOnlineCOM:     prefix + "total:online:com",
		TotalOnlineUnified: prefix + "total:online:unified",
		Hot100List:         prefix + "hot100:list",
		UpdateChannel:      prefix + "updates",
	}
}

// Config Redis configuration
type Config struct {
	Host      string
	Port      string
	Password  string
	DB        int
	KeyPrefix string
	PoolSize  int
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
	applyKeyPrefix(cfg.KeyPrefix)

	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	poolSize := cfg.PoolSize
	if poolSize <= 0 {
		poolSize = 20
	}
	client = redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		PoolSize:     poolSize,
		MinIdleConns: poolSize / 4,
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	// 测试连接
	if err := client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Printf("Redis connected to %s (db=%d, key_prefix=%s)", addr, cfg.DB, keyNS.Prefix)
	return nil
}

// GetClient 获取 Redis 客户端
func GetClient() *redis.Client {
	return client
}

// ErrNotInitialized 表示 Redis 尚未初始化（Init 失败或从未调用）。
var ErrNotInitialized = errors.New("redis: client not initialized")

// ready 返回可用的客户端。Redis 是可选的：Init 失败时 main 会继续以内存缓存运行，
// 因此所有导出函数必须先判空，否则 nil client 会直接 panic。
func ready() (*redis.Client, error) {
	if client == nil {
		return nil, ErrNotInitialized
	}
	return client, nil
}

// Close 关闭 Redis 连接
func Close() error {
	if client != nil {
		return client.Close()
	}
	return nil
}

// UpdateOnlineCount 更新题目在线人数
func UpdateOnlineCount(slug string, status *ProblemOnlineStatus) error {
	c, err := ready()
	if err != nil {
		return err
	}
	key := keyNS.ProblemOnline + slug
	data, err := json.Marshal(status)
	if err != nil {
		return err
	}

	// 使用管道批量操作
	pipe := c.Pipeline()
	pipe.Set(ctx, key, data, 24*time.Hour) // 24小时过期
	pipe.ZAdd(ctx, keyNS.Hot100List, redis.Z{
		Score:  float64(status.LastUpdated.Unix()),
		Member: slug,
	})

	_, err = pipe.Exec(ctx)
	return err
}

// GetOnlineCount 获取题目在线人数
func GetOnlineCount(slug string) (*ProblemOnlineStatus, error) {
	c, err := ready()
	if err != nil {
		return nil, err
	}
	key := keyNS.ProblemOnline + slug
	data, err := c.Get(ctx, key).Bytes()
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
	c, err := ready()
	if err != nil {
		return nil, err
	}

	// 使用 SCAN 获取所有在线人数键
	var cursor uint64
	var results []*ProblemOnlineStatus

	for {
		keys, nextCursor, err := c.Scan(ctx, cursor, keyNS.ProblemOnline+"*", 100).Result()
		if err != nil {
			return nil, err
		}

		for _, key := range keys {
			data, err := c.Get(ctx, key).Bytes()
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
	c, err := ready()
	if err != nil {
		return err
	}
	return c.Set(ctx, keyNS.TotalOnline, total, 24*time.Hour).Err()
}

// GetTotalOnline 获取总在线人数
func GetTotalOnline() (int, error) {
	c, err := ready()
	if err != nil {
		return 0, err
	}
	val, err := c.Get(ctx, keyNS.TotalOnline).Int()
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
	c, err := ready()
	if err != nil {
		return err
	}
	msg := map[string]interface{}{
		"slug":  slug,
		"count": count,
		"time":  time.Now().Unix(),
	}
	data, _ := json.Marshal(msg)
	return c.Publish(ctx, keyNS.UpdateChannel, data).Err()
}

// SubscribeOnlineUpdates 订阅在线人数更新
func SubscribeOnlineUpdates(handler func(slug string, count int)) {
	c, err := ready()
	if err != nil {
		log.Printf("Warning: cannot subscribe to online updates: %v", err)
		return
	}
	sub := c.Subscribe(ctx, keyNS.UpdateChannel)
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
	c, err := ready()
	if err != nil {
		return err
	}

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
		key = keyNS.ProblemOnlineCN + slug
	case "com", "COM":
		key = keyNS.ProblemOnlineCOM + slug
	default:
		key = keyNS.ProblemOnline + slug
	}

	data, err := json.Marshal(status)
	if err != nil {
		return err
	}

	// 使用管道批量操作
	pipe := c.Pipeline()
	pipe.Set(ctx, key, data, 24*time.Hour) // 24小时过期
	pipe.ZAdd(ctx, keyNS.Hot100List, redis.Z{
		Score:  float64(status.LastUpdated.Unix()),
		Member: slug,
	})

	_, err = pipe.Exec(ctx)
	return err
}

// GetOnlineCountBySite 获取指定站点的题目在线人数
func GetOnlineCountBySite(slug string, site string) (*ProblemOnlineStatus, error) {
	c, err := ready()
	if err != nil {
		return nil, err
	}

	var key string
	switch site {
	case "cn", "CN":
		key = keyNS.ProblemOnlineCN + slug
	case "com", "COM":
		key = keyNS.ProblemOnlineCOM + slug
	default:
		key = keyNS.ProblemOnline + slug
	}

	log.Printf("[GetOnlineCountBySite] Trying to get key: %s", key)

	data, err := c.Get(ctx, key).Bytes()
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
	c, err := ready()
	if err != nil {
		return nil, err
	}

	var pattern string
	switch site {
	case "cn", "CN":
		pattern = keyNS.ProblemOnlineCN + "*"
	case "com", "COM":
		pattern = keyNS.ProblemOnlineCOM + "*"
	default:
		pattern = keyNS.ProblemOnline + "*"
	}

	var cursor uint64
	var results []*ProblemOnlineStatus

	for {
		keys, nextCursor, err := c.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return nil, err
		}

		for _, key := range keys {
			data, err := c.Get(ctx, key).Bytes()
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
	// 按题目 key 实时求和，而不是读 total:* 自己：
	// total:* 是这里写出去的，读它会导致总数永远停留在上一次的结果（首次为 0）。
	cnTotal, err := sumOnlineKeys(keyNS.ProblemOnlineCN)
	if err != nil {
		return 0, 0, 0, err
	}
	comTotal, err := sumOnlineKeys(keyNS.ProblemOnlineCOM)
	if err != nil {
		return 0, 0, 0, err
	}
	return cnTotal, comTotal, cnTotal + comTotal, nil
}

// sumOnlineKeys 统计某一站点所有 online:{site}:{slug} key 的在线人数之和。
// 只有 100 个 key，每 5 秒一轮可以接受。
func sumOnlineKeys(prefix string) (int, error) {
	c, err := ready()
	if err != nil {
		return 0, err
	}

	var cursor uint64
	total := 0
	for {
		keys, next, err := c.Scan(ctx, cursor, prefix+"*", 500).Result()
		if err != nil {
			return 0, err
		}
		if len(keys) > 0 {
			pipe := c.Pipeline()
			cmds := make([]*redis.StringCmd, len(keys))
			for i, key := range keys {
				cmds[i] = pipe.Get(ctx, key)
			}
			if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
				return 0, err
			}
			for _, cmd := range cmds {
				raw, err := cmd.Result()
				if err != nil {
					continue
				}
				var status ProblemOnlineStatus
				if err := json.Unmarshal([]byte(raw), &status); err != nil {
					continue
				}
				total += status.OnlineCount
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return total, nil
}

// UpdateTotalOnlineBySite 更新双站点的总在线人数
func UpdateTotalOnlineBySite(cnTotal, comTotal, unifiedTotal int) error {
	c, err := ready()
	if err != nil {
		return err
	}
	pipe := c.Pipeline()
	pipe.Set(ctx, keyNS.TotalOnlineCN, cnTotal, 24*time.Hour)
	pipe.Set(ctx, keyNS.TotalOnlineCOM, comTotal, 24*time.Hour)
	pipe.Set(ctx, keyNS.TotalOnlineUnified, unifiedTotal, 24*time.Hour)
	_, err = pipe.Exec(ctx)
	return err
}

// PublishOnlineUpdateWithSite 发布带站点信息的在线人数更新
func PublishOnlineUpdateWithSite(slug string, site interface{}, count int) error {
	c, err := ready()
	if err != nil {
		return err
	}

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
	return c.Publish(ctx, keyNS.UpdateChannel, data).Err()
}

// SubscribeOnlineUpdatesWithSite 订阅带站点信息的在线人数更新
func SubscribeOnlineUpdatesWithSite(handler func(slug string, site string, count int)) {
	c, err := ready()
	if err != nil {
		log.Printf("Warning: cannot subscribe to online updates: %v", err)
		return
	}
	sub := c.Subscribe(ctx, keyNS.UpdateChannel)
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
	c, err := ready()
	if err != nil {
		return nil, err
	}

	// 构建所有 key
	keys := make([]string, len(slugs))
	var keyPrefix string
	switch site {
	case "cn", "CN":
		keyPrefix = keyNS.ProblemOnlineCN
	case "com", "COM":
		keyPrefix = keyNS.ProblemOnlineCOM
	default:
		keyPrefix = keyNS.ProblemOnline
	}

	for i, slug := range slugs {
		keys[i] = keyPrefix + slug
	}

	// 使用 Pipeline 批量获取
	pipe := c.Pipeline()
	cmds := make([]*redis.StringCmd, len(slugs))
	for i, key := range keys {
		cmds[i] = pipe.Get(ctx, key)
	}

	// 执行 Pipeline
	_, err = pipe.Exec(ctx)
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
