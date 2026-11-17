#!/bin/bash
# 国际站采集器保活：确保 weston(wayland) + SSH 隧道(16390) + collector.js 都在。
# 由 cron 每分钟调用；任何一项挂掉都会自动拉起，日志写 /tmp/com-collector-watchdog.log。
#
# 背景：collector 本身会重连 Redis，但本机到 leetcode-001 的 SSH 隧道断掉后
# 不会自行恢复，曾导致国际站数据静默中断（页面上的国际站曲线变成一条 0 线）。
set -u
PATH=/usr/local/bin:/usr/bin:/bin
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE=/tmp/com-collector-local.pid
LOG=/tmp/com-collector-watchdog.log
TUNNEL_PORT=16390
TUNNEL_REMOTE=127.0.0.1:6379
TUNNEL_HOST=leetcode-001
# weston 的 socket 必须放在不会被系统清理的目录。
# 2026-11-13 /tmp/xdg/wayland-99 被删（进程仍在、socket 已消失），
# 旧检查只 pgrep 进程号，于是看门狗一直判定"正常"，
# 而采集器每次启动 Chromium 都报 Failed to connect to Wayland display，
# 国际站数据从 2026-11-14 00:46 起静默中断。因此改用 $XDG_RUNTIME_DIR
# 并把存活判据改成 socket 文件本身。
WK_RUNTIME="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
WK_SOCKET="$WK_RUNTIME/wayland-99"

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

# 防止 cron 重叠执行
exec 9>/tmp/com-collector-watchdog.lock
flock -n 9 || exit 0

# 1. wayland 显示环境（有头 Chromium 需要）
# 判据是 socket 文件是否存在：进程活着但 socket 被删时依旧不可用。
if [ ! -S "$WK_SOCKET" ]; then
  if pgrep -f 'weston .*--socket=wayland-99' >/dev/null 2>&1; then
    # socket 丢失但进程残留，先清掉再起，否则新实例会抢不到 socket 名。
    pkill -f 'weston .*--socket=wayland-99' 2>/dev/null || true
    sleep 1
    log "killed stale weston (socket $WK_SOCKET missing)"
  fi
  mkdir -p "$WK_RUNTIME" && chmod 700 "$WK_RUNTIME"
  # 9>&-：不要把 watchdog 的 flock 文件描述符继承给常驻子进程，
  # 否则 autossh/weston 会一直持有锁，后续 cron 全部被 flock 挡住。
  XDG_RUNTIME_DIR="$WK_RUNTIME" setsid nohup weston --backend=headless-backend.so --socket=wayland-99 >>/tmp/weston.log 2>&1 9>&- &
  sleep 2
  if [ -S "$WK_SOCKET" ]; then
    log "restarted weston (socket $WK_SOCKET)"
  else
    log "ERROR: weston failed to create $WK_SOCKET (see /tmp/weston.log)"
  fi
fi

# 2. SSH 隧道：collector 通过 127.0.0.1:16390 写线上 Redis
if ! redis-cli -p "$TUNNEL_PORT" ping >/dev/null 2>&1; then
  pkill -f "autossh.*${TUNNEL_PORT}:${TUNNEL_REMOTE}" 2>/dev/null || true
  pkill -f "ssh .*${TUNNEL_PORT}:${TUNNEL_REMOTE}" 2>/dev/null || true
  sleep 1
  if command -v autossh >/dev/null 2>&1; then
    setsid nohup autossh -M 0 -N -f \
      -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ConnectTimeout=10 \
      -L "127.0.0.1:${TUNNEL_PORT}:${TUNNEL_REMOTE}" "$TUNNEL_HOST" >/dev/null 2>&1 9>&-
  else
    setsid nohup ssh -N -f \
      -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ConnectTimeout=10 \
      -L "127.0.0.1:${TUNNEL_PORT}:${TUNNEL_REMOTE}" "$TUNNEL_HOST" >/dev/null 2>&1 9>&-
  fi
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    redis-cli -p "$TUNNEL_PORT" ping >/dev/null 2>&1 && break
    sleep 1
  done
  if redis-cli -p "$TUNNEL_PORT" ping >/dev/null 2>&1; then
    log "tunnel ${TUNNEL_PORT} restored"
  else
    log "ERROR: tunnel ${TUNNEL_PORT} still down"
    exit 1
  fi
fi

# 3. 采集器进程
collector_pid() {
  local pid
  pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "$pid"
    return 0
  fi
  # PID 文件丢失时，按工作目录兜底识别，避免重复起进程
  for pid in $(pgrep -f 'node collector.js' 2>/dev/null); do
    if [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" = "$SCRIPT_DIR" ]; then
      echo "$pid" > "$PIDFILE"
      echo "$pid"
      return 0
    fi
  done
  return 1
}

if ! collector_pid >/dev/null; then
  bash "$SCRIPT_DIR/start-com-collector-local.sh" >> "$LOG" 2>&1 9>&-
  if collector_pid >/dev/null; then
    log "collector started pid=$(cat "$PIDFILE" 2>/dev/null)"
  else
    log "ERROR: collector failed to start (see /tmp/com-collector-local.log)"
  fi
fi
