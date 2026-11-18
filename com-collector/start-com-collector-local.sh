#!/bin/bash
# 本机长跑采集器：有头浏览器(wayland) 采集 leetcode.com 在线人数 → 经隧道 16390 → 线上 Redis(leetcode-001)
# 见 CLAUDE.md / 记忆：com 采集在云服务器 IP 上会被 CF 全拦，家宽/办公室 IP 有通过率，
# 故采集器须跑在本机，Redis 由 SSH 隧道打通（compose 注释："供 SSH 隧道/本地采集器写入 COM 数据"）。
set -u
PIDFILE=/tmp/com-collector-local.pid
LOG=/tmp/com-collector-local.log

# 单实例保护。两层：
# 1) PID 文件还在且进程活着，直接退出；
# 2) PID 文件丢失/进程换过 cwd 时，按工作目录兜底识别。
# 再加 flock 兜住并发调用（定时器和手动执行可能撞在同一秒）。
exec 8>/tmp/com-collector-start.lock
flock -n 8 || { echo "another start is in progress"; exit 1; }

running_pid() {
  local pid here
  here="$(cd "$(dirname "$0")" && pwd -P)"
  pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "$pid"
    return 0
  fi
  for pid in $(pgrep -f 'node collector.js' 2>/dev/null); do
    if [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" = "$here" ]; then
      echo "$pid"
      return 0
    fi
  done
  return 1
}

if existing=$(running_pid); then
  echo "$existing" > "$PIDFILE"
  echo "collector already running pid=$existing"
  exit 1
fi

# 隧道检查（16390 → leetcode-001:6379 = leetcode-redis）
if ! redis-cli -p 16390 ping >/dev/null 2>&1; then
  echo "tunnel 16390 not reachable; rebuild with:"
  echo "  ssh -N -f -o ExitOnForwardFailure=yes -L 127.0.0.1:16390:127.0.0.1:6379 leetcode-001"
  exit 1
fi

cd "$(dirname "$0")" || exit 1
# XDG_RUNTIME_DIR 不要用 /tmp/xdg：该目录下的 wayland-99 socket 曾被系统清掉，
# 进程还活着但 Chromium 再也连不上显示屏。$XDG_RUNTIME_DIR 与 watchdog.sh 保持一致。
WK_RUNTIME="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [ ! -S "$WK_RUNTIME/wayland-99" ]; then
  echo "wayland socket $WK_RUNTIME/wayland-99 missing; run watchdog.sh to start weston"
  exit 1
fi
XDG_RUNTIME_DIR="$WK_RUNTIME" WAYLAND_DISPLAY=wayland-99 DISPLAY= \
  REDIS_HOST=127.0.0.1 REDIS_PORT=16390 \
  COM_ATTEMPT_MS=12000 COM_ATTEMPTS_PER_SLUG=6 COM_BATCH_SIZE=10 \
  COM_CYCLE_PAUSE_MS=5000 COM_RETRY_PAUSE_MS=10000 \
  setsid nohup node collector.js >> "$LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "collector started pid=$(cat "$PIDFILE"), log=$LOG"