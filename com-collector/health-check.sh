#!/bin/bash
# 国际站采集器的数据新鲜度守护（health-check）。
#
# 存在的理由：2026-11-13 那次断流整整埋了一个星期没人发现，因为所有监控
# 都在查「进程活着吗」——weston 进程活着、collector 进程活着，但 socket
# 没了、Chromium 起不来，数据早就停了。进程存活 != 数据在流动。
#
# 所以这里只认一个判据：**Redis 里 COM 数据的最后更新时间**。
# 拿 last_updated 字段和当前时间比，超过 STALE_MINUTES 就判定断流。
#
# 输出：一行人类可读状态 + 退出码
#   0 = 新鲜（数据在流动）
#   1 = 陈旧（超过阈值，采集已经停了）
#   2 = 无法判断（隧道/redis 不可达）
#
# 由 watchdog.sh 每分钟调用；也可单独跑来做巡检。
set -u
TUNNEL_PORT="${TUNNEL_PORT:-16390}"
STALE_MINUTES="${STALE_MINUTES:-15}"
KEY_PREFIX="leetcode-dashboard:online:com:"

# 隧道优先，拿不到就判"无法判断"，不误报成断流
if ! redis-cli -p "$TUNNEL_PORT" ping >/dev/null 2>&1; then
  echo "UNKNOWN redis tunnel $TUNNEL_PORT unreachable"
  exit 2
fi

# 扫全部 COM key，取最大的 last_updated。
# 用 --scan 而不是 keys，避免 key 多时阻塞 Redis。
newest=$(redis-cli -p "$TUNNEL_PORT" --scan --pattern "$KEY_PREFIX*" 2>/dev/null \
  | while read -r key; do
      [ -n "$key" ] || continue
      redis-cli -p "$TUNNEL_PORT" get "$key" 2>/dev/null
    done \
  | sed -n 's/.*"last_updated":"\([^"]*\)".*/\1/p' \
  | sort | tail -1)

if [ -z "${newest:-}" ]; then
  echo "STALE no COM keys with last_updated (data never collected?)"
  exit 1
fi

# ISO8601 (UTC, 带 Z) -> epoch
ts=$(date -u -d "$newest" +%s 2>/dev/null) || {
  echo "UNKNOWN cannot parse timestamp: $newest"
  exit 2
}
now=$(date -u +%s)
age_min=$(( (now - ts) / 60 ))

com_keys=$(redis-cli -p "$TUNNEL_PORT" --scan --pattern "$KEY_PREFIX*" 2>/dev/null | wc -l)

if [ "$age_min" -ge "$STALE_MINUTES" ]; then
  echo "STALE age=${age_min}m threshold=${STALE_MINUTES}m keys=${com_keys} last=${newest}"
  exit 1
fi

echo "OK age=${age_min}m keys=${com_keys} last=${newest}"
exit 0
