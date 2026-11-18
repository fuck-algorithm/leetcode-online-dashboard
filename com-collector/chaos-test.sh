#!/bin/bash
# 混沌测试：注入极端故障，然后完全不干预，只观察 systemd timer 能否自己救活。
#
# 用法：bash chaos-test.sh <场景名>
#   total_wipe   - 采集器+weston+chromium+隧道 全杀（等效机器重启后的空状态）
#   socket_gone  - weston 进程保留，但删掉 wayland socket（2026-11-13 真实故障）
#   collector_dead - 只杀采集器进程
#   frozen       - SIGSTOP 冻结采集器（进程活着但数据停流）
#
# 不做任何手动恢复动作，只等 timer。
set -u
DIR=/home/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/com-collector
SCENARIO="${1:?usage: chaos-test.sh <scenario>}"
STALE_MIN="${STALE_MINUTES:-15}"
MAX_WAIT="${MAX_WAIT:-900}"

cd "$DIR" || exit 1

collector_pid() { ps -eo pid,cmd | awk '$2=="node" && $3=="collector.js"{print $1}' | head -1; }
weston_pid()    { ps -eo pid,cmd | awk '/weston --backend=headless/{print $1}' | head -1; }
chromium_pids() { ps -eo pid,cmd | awk '/^[0-9]+ \/home\/cc11001100\/.cache\/ms-playwright\/chromium/{print $1}'; }
tunnel_pid()    { ss -tlnp 2>/dev/null | grep ':16390' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2; }

say() { echo "[$(date '+%H:%M:%S')] $*"; }

say "=== 场景：$SCENARIO ==="
say "注入前：collector=$(collector_pid) weston=$(weston_pid) chromium=$(chromium_pids | wc -l) tunnel=$(tunnel_pid)"

case "$SCENARIO" in
  total_wipe)
    # 最严酷：模拟"机器刚重启/所有组件都没了"
    c=$(collector_pid); [ -n "$c" ] && kill -9 "$c" 2>/dev/null && say "kill collector $c"
    w=$(weston_pid);    [ -n "$w" ] && kill -9 "$w" 2>/dev/null && say "kill weston $w"
    for p in $(chromium_pids); do kill -9 "$p" 2>/dev/null; done
    say "kill chromium (全部)"
    t=$(tunnel_pid);    [ -n "$t" ] && kill -9 "$t" 2>/dev/null && say "kill tunnel ssh $t"
    ;;
  socket_gone)
    # 复刻 11-13：process 还在，socket 没了
    sock="/run/user/1000/wayland-99"
    if [ -S "$sock" ]; then rm -f "$sock" "$sock.lock" 2>/dev/null; say "删除 socket $sock（weston 进程保留）"; fi
    ;;
  collector_dead)
    c=$(collector_pid); [ -n "$c" ] && kill -9 "$c" 2>/dev/null && say "kill collector $c"
    ;;
  frozen)
    c=$(collector_pid); [ -n "$c" ] && kill -STOP "$c" 2>/dev/null && say "SIGSTOP 冻结 collector $c"
    ;;
  *) say "未知场景"; exit 2 ;;
esac

say "注入完成，开始等待 systemd timer 自愈（不做任何干预）"
inject_ts=$(date +%s)
start=$inject_ts
deadline=$((start + MAX_WAIT))
recovered_at=""
last_note=""

# 恢复判据必须严格：不能只看 health OK，因为那时数据时间戳可能还是注入前的旧值。
# 要求数据时间戳晚于注入时刻，才算"真的在产生新数据"。
newest_ts() {
  redis-cli -p 16390 --scan --pattern "leetcode-dashboard:online:com:*" 2>/dev/null \
    | while read -r k; do redis-cli -p 16390 get "$k" 2>/dev/null; done \
    | sed -n 's/.*"last_updated":"([^"]*)".*/\1/p' \
    | sort | tail -1
}

while [ "$(date +%s)" -lt "$deadline" ]; do
  c=$(collector_pid)
  h=$(STALE_MINUTES="$STALE_MIN" ./health-check.sh 2>&1)
  rc=$?
  # 用 python 解析，避免 sed BRE 转义踩坑（"(" 在 BRE 里不转义就是字面量）
  newest=$(redis-cli -p 16390 --scan --pattern "leetcode-dashboard:online:com:*" 2>/dev/null | head -100 \
    | while read -r k; do redis-cli -p 16390 get "$k" 2>/dev/null; done \
    | python3 -c '
import sys, json
best = ""
for line in sys.stdin:
    line = line.strip()
    if not line.startswith("{"):
        continue
    try:
        ts = json.loads(line).get("last_updated", "")
    except Exception:
        continue
    if ts > best:
        best = ts
print(best)
' 2>/dev/null)
  newest_epoch=$(date -u -d "$newest" +%s 2>/dev/null || echo 0)

  # 恢复判据：采集器进程在 + health OK + 数据时间戳晚于注入时刻
  if [ -n "$c" ] && [ "$rc" -eq 0 ] && [ "$newest_epoch" -gt "$inject_ts" ]; then
    recovered_at=$(date +%s)
    break
  fi

  note="collector=${c:-无} health=${h} newest=${newest}"
  if [ "$note" != "$last_note" ]; then
    say "$note"
    last_note="$note"
  fi
  sleep 10
done

if [ -z "$recovered_at" ]; then
  say "FAIL：${MAX_WAIT}s 内未恢复"
  say "最后状态：collector=$(collector_pid) health=$(./health-check.sh 2>&1)"
  say "看门狗日志尾部：" ; tail -8 /tmp/com-collector-watchdog.log | sed 's/^/    /'
  exit 1
fi

elapsed=$((recovered_at - start))
say "PASS：${elapsed}s 后自动恢复"
say "恢复后：collector=$(collector_pid) health=$(./health-check.sh 2>&1)"
say "看门狗日志（本次窗口）："
awk -v s="$(date -d @$start '+%F %T')" '$0 >= s' /tmp/com-collector-watchdog.log | tail -10 | sed 's/^/    /'
exit 0
