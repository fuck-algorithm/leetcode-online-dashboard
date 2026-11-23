package redis

import (
	"errors"
	"testing"
)

func TestApplyKeyPrefix(t *testing.T) {
	tests := []struct {
		name   string
		prefix string
		want   string
	}{
		{"default", "", DefaultKeyPrefix},
		{"without colon", "myapp", "myapp:"},
		{"with colon", "myapp:", "myapp:"},
		{"nested", "team:app", "team:app:"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			applyKeyPrefix(tt.prefix)
			if keyNS.Prefix != tt.want {
				t.Fatalf("Prefix = %q, want %q", keyNS.Prefix, tt.want)
			}
			if got, want := keyNS.ProblemOnline, tt.want+"online:unified:"; got != want {
				t.Fatalf("ProblemOnline = %q, want %q", got, want)
			}
			if got, want := keyNS.UpdateChannel, tt.want+"updates"; got != want {
				t.Fatalf("UpdateChannel = %q, want %q", got, want)
			}
		})
	}

	// Restore the package default for other tests.
	applyKeyPrefix(DefaultKeyPrefix)
}

// Redis 是可选的：Init 失败时主程序会退化为内存缓存继续运行。
// 此前 client 为 nil 时调用任意导出函数都会 panic，这里做回归保护。
func TestExportFuncsSafeWhenNotInitialized(t *testing.T) {
	client = nil

	if _, err := GetOnlineCount("two-sum"); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("GetOnlineCount err = %v, want ErrNotInitialized", err)
	}
	if _, err := GetAllOnlineCounts(); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("GetAllOnlineCounts err = %v, want ErrNotInitialized", err)
	}
	if _, err := GetAllOnlineCountsBySite("cn"); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("GetAllOnlineCountsBySite err = %v, want ErrNotInitialized", err)
	}
	if _, err := GetOnlineCountBySite("two-sum", "cn"); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("GetOnlineCountBySite err = %v, want ErrNotInitialized", err)
	}
	if _, err := GetTotalOnline(); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("GetTotalOnline err = %v, want ErrNotInitialized", err)
	}
	if _, _, _, err := GetTotalOnlineBySite(); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("GetTotalOnlineBySite err = %v, want ErrNotInitialized", err)
	}
	if _, err := BatchGetOnlineCountsBySite([]string{"two-sum"}, "cn"); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("BatchGetOnlineCountsBySite err = %v, want ErrNotInitialized", err)
	}
	if err := UpdateOnlineCount("two-sum", &ProblemOnlineStatus{}); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("UpdateOnlineCount err = %v, want ErrNotInitialized", err)
	}
	if err := UpdateTotalOnline(0); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("UpdateTotalOnline err = %v, want ErrNotInitialized", err)
	}
	if err := PublishOnlineUpdate("two-sum", 0); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("PublishOnlineUpdate err = %v, want ErrNotInitialized", err)
	}

	// 订阅方没有返回值，未初始化时必须安静返回而不是 panic。
	SubscribeOnlineUpdates(func(string, int) {})
	SubscribeOnlineUpdatesWithSite(func(string, string, int) {})
}
