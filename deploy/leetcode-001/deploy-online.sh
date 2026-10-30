#!/usr/bin/env bash
# ============================================================
# leetcode-001 一键部署脚本
#
# 一条命令完成：构建镜像 → 同步 compose/.env → 上传镜像 →
# 拉起服务 → 等待 healthy → 公网健康检查，部署失败会给出明确报错。
#
# 用法：
#   deploy/leetcode-001/deploy-online.sh                 # 全量：构建 + 部署 + 验证
#   deploy/leetcode-001/deploy-online.sh --skip-build    # 日常：用现有镜像重部署
#   deploy/leetcode-001/deploy-online.sh --with-base     # 首次/换机：连同 postgres/redis 基础镜像一起传
#   deploy/leetcode-001/deploy-online.sh --no-verify     # 跳过部署后健康检查（少用）
#
# 依赖：本机 docker、~/.ssh/config 中 Host leetcode-001 免密登录。
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

REMOTE="leetcode-001"
REMOTE_DIR="/opt/leetcode-dashboard"
PUBLIC_URL="https://leetcode.zhaixingren.cn"
COMPOSE_SRC="deploy/leetcode-001/docker-compose.yml"
ENV_SRC="deploy/leetcode-001/.env"
TMP_COMPOSE="deploy/leetcode-001/docker-compose.yml"

BACKEND_IMAGE="leetcode-dashboard-backend:latest"
CRAWLER_IMAGE="leetcode-dashboard-crawler:latest"
FRONTEND_IMAGE="leetcode-dashboard-frontend:latest"
BASE_IMAGES="postgres:16-alpine redis:7-alpine"

# ---- 参数解析 ----
SKIP_BUILD=0
WITH_BASE=0
NO_VERIFY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1 ;;
    --with-base)  WITH_BASE=1 ;;
    --no-verify)  NO_VERIFY=1 ;;
    -h|--help)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "未知参数: $1（-h 查看用法）" >&2; exit 1 ;;
  esac
  shift
done

# ---- 样式 ----
C_GREEN='\033[32m'; C_YELLOW='\033[33m'; C_RED='\033[31m'; C_BOLD='\033[1m'; C_NC='\033[0m'
info()  { echo -e "${C_BOLD}[$(date +%H:%M:%S)]${C_NC} $1"; }
ok()    { echo -e "  ${C_GREEN}✓${C_NC} $1"; }
warn()  { echo -e "  ${C_YELLOW}!${C_NC} $1"; }
fail()  { echo -e "  ${C_RED}✗${C_NC} $1"; FAILED=1; }

# ---- 预检 ----
info "==> 预检"
command -v docker >/dev/null || { echo "本机缺少 docker" >&2; exit 1; }
if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$REMOTE" 'true' 2>/dev/null; then
  echo "无法免密登录 ${REMOTE}（检查 ~/.ssh/config 与 ssh-agent）" >&2; exit 1
fi
[ -f "$COMPOSE_SRC" ] || { echo "缺少 $COMPOSE_SRC" >&2; exit 1; }
[ -f "$ENV_SRC" ] || { echo "缺少 $ENV_SRC" >&2; exit 1; }
OK_SERVICES=
FAILED=0

# ---- 1. 构建镜像 ----
if [ "$SKIP_BUILD" = "1" ]; then
  info "==> 跳过镜像构建（--skip-build），使用本地现有镜像"
else
  info "==> 构建后端 / 爬虫 / 前端镜像"
  docker build -f backend/Dockerfile        -t "$BACKEND_IMAGE" backend
  docker build -f backend/Dockerfile.crawler -t "$CRAWLER_IMAGE" backend
  docker build -f frontend/Dockerfile       -t "$FRONTEND_IMAGE" frontend
fi
for img in "$BACKEND_IMAGE" "$CRAWLER_IMAGE" "$FRONTEND_IMAGE"; do
  docker image inspect "$img" >/dev/null 2>&1 || { echo "缺少镜像 $img（先去掉 --skip-build 构建）" >&2; exit 1; }
done
if [ "$WITH_BASE" = "1" ]; then
  for img in $BASE_IMAGES; do
    docker image inspect "$img" >/dev/null 2>&1 || { echo "缺少基础镜像 $img（--with-base 需要本地先拉取）" >&2; exit 1; }
  done
fi

# ---- 2. 同步 compose 与 .env ----
info "==> 同步 compose 与 .env 到 ${REMOTE}:${REMOTE_DIR}/"
ssh "$REMOTE" "mkdir -p ${REMOTE_DIR}"
scp -q "$COMPOSE_SRC" "$REMOTE:${REMOTE_DIR}/docker-compose.yml"
scp -q "$ENV_SRC"     "$REMOTE:${REMOTE_DIR}/.env"
ssh "$REMOTE" "chmod 600 ${REMOTE_DIR}/.env"
ok "compose / .env 已同步"

# ---- 3. 上传镜像 ----
IMAGES="$BACKEND_IMAGE $CRAWLER_IMAGE $FRONTEND_IMAGE"
[ "$WITH_BASE" = "1" ] && IMAGES="$IMAGES $BASE_IMAGES"
info "==> 上传镜像到服务器（docker save | gzip | ssh load）"
docker save $IMAGES | gzip -1 | ssh "$REMOTE" "gunzip | docker load"
ok "镜像已导入"

# ---- 4. 拉起服务 ----
info "==> 服务器上执行 docker compose up -d"
ssh "$REMOTE" "cd ${REMOTE_DIR} && docker compose up -d --remove-orphans"
ok "compose 已拉起，等待健康检查"

# ---- 5. 等待全部容器 healthy ----
info "==> 等待容器健康（最长 150s）"
DONE=0
for i in $(seq 1 30); do
  STATUS_RAW="$(ssh "$REMOTE" "cd ${REMOTE_DIR} && docker compose ps --format '{{.Service}}|{{.State}}|{{.Health}}'")"
  BAD="$(printf '%s\n' "$STATUS_RAW" | awk -F'|' '$2 != "running" {print} $3 == "unhealthy" {print}')"
  if [ -z "$BAD" ]; then DONE=1; break; fi
  sleep 5
done
if [ "$DONE" = "1" ]; then
  echo "$STATUS_RAW" | awk -F'|' '{printf "    %-10s %-9s %s\n", $1, $2, $3}'
  ok "全部容器 running + healthy"
else
  fail "150s 内仍有容器未就绪，当前状态："
  ssh "$REMOTE" "cd ${REMOTE_DIR} && docker compose ps" || true
fi

# ---- 6. 公网健康检查 ----
if [ "$NO_VERIFY" = "1" ]; then
  info "==> 跳过健康检查（--no-verify）"
else
  info "==> 公网健康检查 ${PUBLIC_URL}"
  timeout 15 curl -s -o /dev/null -m 12 -w '%{http_code}' "$PUBLIC_URL/" | grep -q '^200$' \
    && ok "首页 200" || fail "首页访问失败"

  HEALTH="$(timeout 15 curl -s -m 12 "$PUBLIC_URL/api/health" 2>/dev/null || true)"
  [[ "$HEALTH" == *'"status":"healthy"'* ]] \
    && ok "/api/health healthy" || fail "/api/health 异常: $HEALTH"

  HOT=$(timeout 15 curl -s -m 12 "$PUBLIC_URL/api/hot100" 2>/dev/null || true)
  # grep -om1 只取匹配到的一行即退出，避免 head 关闭管道导致 grep SIGPIPE（pipefail 下会误断脚本）
  # -E 显式 ERE（本机 grep 是 ugrep 7.x，默认 BRE 下裸 + 是字面量会匹配失败）；
  # 用 awk NR==1 取首行而非 head：head 提前关闭管道会在 pipefail 下触发 SIGPIPE 误断脚本
  TS="$(printf '%s' "$HOT" | grep -oE '"last_updated":"[^"]+"' | cut -d'"' -f4 | awk 'NR==1' || true)"
  if [ -n "$TS" ]; then
    AGE=$(( $(date +%s) - $(date -d "$TS" +%s 2>/dev/null || echo 0) ))
    if [ "$AGE" -ge 0 ] && [ "$AGE" -le 300 ]; then
      ok "hot100 数据新鲜（${AGE}s 前更新）"
    else
      warn "hot100 最后更新于 $TS（${AGE}s 前），爬虫可能未写入"
    fi
  else
    fail "hot100 无数据"
  fi

  MCP_HEAD="$(timeout 15 curl -sS -m 12 -D - -o /dev/null -X POST "$PUBLIC_URL/mcp" \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"deploy-check","version":"1.0"}}}' 2>/dev/null || true)"
  [[ "$MCP_HEAD" == *'HTTP/2 200'* && "$MCP_HEAD" == *'mcp-session-id'* ]] \
    && ok "MCP 握手 200 + session-id" || fail "MCP 端点异常"

  ssh "$REMOTE" 'systemctl is-active leetcode-tunnel 2>/dev/null | grep -q active' \
    && ok "反向隧道 active" || warn "反向隧道非 active（公网可能不可达）"
fi

# ---- 7. 汇总 ----
echo
if [ "$FAILED" = "1" ]; then
  echo -e "${C_RED}部署完成，但存在失败项，请人工排查。${C_NC}"
  exit 1
elif [ "$NO_VERIFY" = "1" ]; then
  echo -e "${C_GREEN}部署完成（未验证）。${C_NC}"
else
  echo -e "${C_GREEN}部署成功，线上全部健康：${PUBLIC_URL}${C_NC}"
fi