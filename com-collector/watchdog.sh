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

# 采集日志轮转。/tmp 曾堆到 240M+，而 /tmp 写满会连带把 weston 的 socket
# 及其它临时文件挤掉，等于自己制造断流。超过 20MB 就保留尾部 5MB。
rotate_log() {
  local f="$1" max=$((20 * 1024 * 1024)) keep=$((5 * 1024 * 1024))
  [ -f "$f" ] || return 0
  local sz
  sz=$(stat -c%s "$f" 2>/dev/null || echo 0)
  if [ "$sz" -gt "$max" ]; then
    tail -c "$keep" "$f" > "$f.tmp" 2>/dev/null && mv "$f.tmp" "$f" 2>/dev/null
    log "rotated $(basename "$f") from $((sz / 1024 / 1024))MB"
  fi
}

# 防止 cron 重叠执行
exec 9>/tmp/com-collector-watchdog.lock
flock -n 9 || exit 0

# 采集日志轮转（放在最前面，任何分支都不会因为日志过大而写爆 /tmp）
rotate_log /tmp/com-collector-local.log
rotate_log /tmp/weston.log

# 1. wayland 显示环境（有头 Chromium 需要）
#
# 判据不能只是"socket 文件存在"。2026-11-18 混沌测试实测踩到：
# weston 被 kill -9 后，socket 文件残留在磁盘上（stale inode），
# 新 weston 因 socket 名被占而启动失败，但 [ -S ] 看到旧文件仍判"正常"，
# 结果 Chromium 永远报 Failed to connect to Wayland display —— 这正是
# 2026-11-13 断流的形态。所以必须同时满足：
#   a) socket 文件存在，且 b) 有活着的 weston 进程持有它。
# 两者不满足时，清进程 + 删残留 socket，再重建。

weston_pid() { pgrep -f 'weston --backend=headless-backend.so --socket=wayland-99' | head -1; }

ready_weston() {
  [ -S "$WK_SOCKET" ] || return 1
  local pid; pid=$(weston_pid)
  [ -n "$pid" ] || return 1
  # 进程活着还不够，还要确认 socket 仍被这个进程持有（防 stale inode）。
  [ -e "/proc/$pid/fd" ] || return 1
  ls -l /proc/$pid/fd 2>/dev/null | grep -q "wayland-99" || return 1
  return 0
}

if ! ready_weston; then
  local_pid=$(pgrep -f 'weston .*--socket=wayland-99' | head -1)
  if [ -n "${local_pid:-}" ]; then
    pkill -f 'weston .*--socket=wayland-99' 2>/dev/null || true
    sleep 1
    log "killed stale weston pid=$local_pid"
  fi
  # 关键：务必删掉残留的 socket 与 lock 文件，否则新 weston 起不来。
  if [ -e "$WK_SOCKET" ] || [ -e "$WK_SOCKET.lock" ]; then
    rm -f "$WK_SOCKET" "$WK_SOCKET.lock" 2>/dev/null
    log "removed stale wayland socket files"
  fi
  mkdir -p "$WK_RUNTIME" && chmod 700 "$WK_RUNTIME"
  # 9>&-：不要把 watchdog 的 flock 文件描述符继承给常驻子进程，
  # 否则 autossh/weston 会一直持有锁，后续 cron 全部被 flock 挡住。
  XDG_RUNTIME_DIR="$WK_RUNTIME" setsid nohup weston --backend=headless-backend.so --socket=wayland-99 >>/tmp/weston.log 2>&1 9>&- &
  # weston 起 headless 后端 + 加载 desktop-shell 需要一点时间，等 socket 真就绪。
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    ready_weston && break
  done
  if ready_weston; then
    log "restarted weston (socket $WK_SOCKET healthy)"
  else
    log "ERROR: weston did not become ready (socket=$WK_SOCKET, see /tmp/weston.log)"
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

# 清掉常驻模式留下的 Chromium 残留。collector 被强杀后，它起的 Chromium
# 父子进程会挂到 systemd 下不退出；下次拉起新 collector 时就会再起一整套，
# 堆积几轮就把内存吃穿。只匹配 playwright 专用缓存目录，不碰用户自己的浏览器。
clean_chromium() {
  if pgrep -f "ms-playwright/chromium" >/dev/null 2>&1; then
    pkill -f "ms-playwright/chromium" 2>/dev/null || true
    sleep 1
    log "cleaned orphan playwright chromium"
  fi
}

# 采集器启动时刻（unix 秒）。用于给刚启动的进程一个宽限期：
# 冷启动 + 预热首页要十几秒到半分钟，这段时间数据还没更新是正常的，
# 不设宽限期的话健康检查会把"正在启动"误判成"断流"，反复重启，
# 反而永远起不来（2026-11-18 实测踩到过）。
STARTED_AT_FILE=/tmp/com-collector-started-at

start_collector() {
  clean_chromium
  bash "$SCRIPT_DIR/start-com-collector-local.sh" >> "$LOG" 2>&1 9>&-
  if collector_pid >/dev/null; then
    date +%s > "$STARTED_AT_FILE"
    log "collector started pid=$(cat "$PIDFILE" 2>/dev/null)"
    return 0
  fi
  log "ERROR: collector failed to start (see /tmp/com-collector-local.log)"
  return 1
}

# 采集器进程已存在但启动时间未知（比如重启机器后），补记一次当前时间，
# 让宽限期从此刻算起，避免刚接手就误杀。
collector_pid >/dev/null && [ ! -f "$STARTED_AT_FILE" ] && date +%s > "$STARTED_AT_FILE"

if ! collector_pid >/dev/null; then
  start_collector
fi

# 启动宽限期（默认 5 分钟）：覆盖冷启动 + 一整圈采集的启动阶段。
STARTUP_GRACE="${STARTUP_GRACE:-300}"

# 4. 数据新鲜度：进程在 != 数据在流动。
# 2026-11-13 那次断流埋了一个星期，就是因为只查了进程。
# 这里按 Redis 里 COM 数据的最后更新时间判断，陈旧就整条链路重建：
# 显示环境没了浏览器起不来、隧道没了写不进去，都会表现为"数据不更新"，
# 但进程本身可能活得好好的，所以不能只靠进程判据。
FRESH="$SCRIPT_DIR/health-check.sh"
STALE_MINUTES="${STALE_MINUTES:-15}"

if [ -x "$FRESH" ]; then
  status=$(STALE_MINUTES="$STALE_MINUTES" "$FRESH" 2>&1)
  rc=$?

  # 刚启动的采集器还在预热，此时"数据陈旧"是正常的，跳过重建。
  started_at=$(cat "$STARTED_AT_FILE" 2>/dev/null || echo 0)
  uptime=$(( $(date +%s) - started_at ))
  if [ "$rc" -ne 0 ] && [ "$uptime" -lt "$STARTUP_GRACE" ]; then
    log "health $status (grace ${uptime}s/${STARTUP_GRACE}s, skip rebuild)"
    rc=0
    status="GRACE $status"
  fi

  if [ "$rc" -ne 0 ]; then
    case "$status" in
      UNKNOWN*)
        # 隧道不通已经在上一步处理过，这里只记日志，避免重复重启。
        log "health UNKNOWN: $status"
        ;;
      *)
        log "health $status -> rebuilding collector"
        # 先停再起，确保新进程拿到干净的浏览器与连接。
        pid=$(collector_pid 2>/dev/null || true)
        if [ -n "${pid:-}" ]; then
          kill "$pid" 2>/dev/null || true
          for _ in 1 2 3 4 5 6 7 8 9 10; do
            kill -0 "$pid" 2>/dev/null || break
            sleep 1
          done
          kill -9 "$pid" 2>/dev/null || true
          log "stopped stale collector pid=$pid"
        fi
        start_collector
        ;;
    esac
  fi

  # 每 30 分钟记一次正常心跳，便于回看"到底什么时候是好的"。
  if [ "$rc" -eq 0 ] && [ $(( $(date '+%M') % 30 )) -eq 0 ]; then
    log "health $status"
  fi
fi
