#!/usr/bin/env bash
# 构建镜像 → 单条 SSH 管道上传 → 在 leetcode-001 上滚动重启
#
# 不依赖私有镜像仓库：docker save | gzip 通过 SSH 传到服务器，
# 服务器端 docker load 后由 compose 使用。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> 构建后端 / 爬虫 / 前端镜像"
docker build -f backend/Dockerfile -t leetcode-dashboard-backend:latest backend
docker build -f backend/Dockerfile.crawler -t leetcode-dashboard-crawler:latest backend
docker build -f frontend/Dockerfile -t leetcode-dashboard-frontend:latest frontend

echo "==> 上传镜像（约 120MB，走 SSH 压缩传输）"
docker save \
  leetcode-dashboard-backend:latest \
  leetcode-dashboard-crawler:latest \
  leetcode-dashboard-frontend:latest \
  | gzip -1 \
  | ssh leetcode-001 'gunzip | docker load'

echo "==> 重启 compose 服务"
ssh leetcode-001 'cd /opt/leetcode-dashboard && docker compose up -d --remove-orphans && docker compose ps'
