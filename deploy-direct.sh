#!/bin/bash
# 直接在服务器上执行的部署脚本
set -e

REMOTE_HOST="${REMOTE_HOST:-43.228.79.80}"
REMOTE_PORT="${REMOTE_PORT:-26451}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_DIR="/opt/leetcode-dashboard"
SSH_KEY="${SSH_KEY:-~/.ssh/id_ed25519}"

echo "========================================"
echo "  LeetCode Dashboard - Quick Deploy"
echo "========================================"

# 1. 检查SSH
echo "[1/6] Checking SSH..."
ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$REMOTE_USER@$REMOTE_HOST" "echo 'SSH_OK'" || exit 1
echo "✓ SSH OK"

# 2. 上传源代码（排除node_modules）
echo "[2/6] Uploading source code..."
ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_DIR"

# 上传backend（排除不必要文件）
echo "  - Uploading backend..."
rsync -avz -e "ssh -i $SSH_KEY -p $REMOTE_PORT -o StrictHostKeyChecking=no" \
  --exclude='*.db' --exclude='tmp/' --exclude='.git/' \
  backend/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/backend/"

# 上传frontend（排除node_modules）
echo "  - Uploading frontend..."
rsync -avz -e "ssh -i $SSH_KEY -p $REMOTE_PORT -o StrictHostKeyChecking=no" \
  --exclude='node_modules/' --exclude='dist/' --exclude='.git/' \
  frontend/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/frontend/"

echo "✓ Code uploaded"

# 3. 创建docker-compose.host.yml
echo "[3/6] Creating docker-compose.host.yml..."
ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "cat > $REMOTE_DIR/docker-compose.host.yml << 'COMPOSE'
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: leetcode-redis
    network_mode: host
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru --bind 127.0.0.1
    volumes:
      - ./redis-data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    image: leetcode-dashboard-backend:latest
    container_name: leetcode-backend
    network_mode: host
    restart: unless-stopped
    environment:
      - PORT=52106
      - DB_PATH=/data/leetcode.db
      - REDIS_HOST=127.0.0.1
      - REDIS_PORT=6379
      - BATCH_SIZE=10
      - INTERVAL_SEC=30
      - GIN_MODE=release
    volumes:
      - ./data:/data

  crawler:
    build:
      context: ./backend
      dockerfile: Dockerfile.crawler
    image: leetcode-dashboard-crawler:latest
    container_name: leetcode-crawler
    network_mode: host
    restart: unless-stopped
    environment:
      - DB_PATH=/data/leetcode.db
      - REDIS_HOST=127.0.0.1
      - REDIS_PORT=6379
      - BATCH_SIZE=10
      - INTERVAL_SEC=30
    volumes:
      - ./data:/data

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    image: leetcode-dashboard-frontend:latest
    container_name: leetcode-frontend
    network_mode: host
    restart: unless-stopped
COMPOSE
echo '✓ Config created'"

# 4. 安装Docker Compose
echo "[4/6] Installing Docker Compose..."
ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" '
  if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
    curl -SL https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    echo "✓ Docker Compose installed"
  else
    echo "✓ Docker Compose already exists"
  fi
'

# 5. 在服务器上构建和部署
echo "[5/6] Building and deploying..."
ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << 'DEPLOY'
  cd /opt/leetcode-dashboard
  
  # 创建数据目录
  mkdir -p data redis-data
  
  # 停止旧服务
  echo "  - Stopping old services..."
  docker-compose -f docker-compose.host.yml down 2>/dev/null || docker stop leetcode-backend leetcode-frontend leetcode-crawler leetcode-redis 2>/dev/null || true
  
  # 构建镜像
  echo "  - Building backend..."
  docker build -t leetcode-dashboard-backend:latest -f backend/Dockerfile backend/ 2>&1 | tail -3
  
  echo "  - Building crawler..."
  docker build -t leetcode-dashboard-crawler:latest -f backend/Dockerfile.crawler backend/ 2>&1 | tail -3
  
  echo "  - Building frontend..."
  docker build -t leetcode-dashboard-frontend:latest -f frontend/Dockerfile frontend/ 2>&1 | tail -3
  
  # 启动服务
  echo "  - Starting services..."
  docker-compose -f docker-compose.host.yml up -d
  
  echo "✓ Services started"
DEPLOY

# 6. 健康检查
echo "[6/6] Health check..."
sleep 10
ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "
  docker ps --format 'table {{.Names}}\t{{.Status}}' | grep leetcode
  echo ''
  curl -s http://127.0.0.1:52106/api/health && echo ' - Backend OK' || echo 'Backend not ready'
"

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo "  Backend:  http://43.228.79.80:52106"
echo "  Frontend: http://43.228.79.80:52107"
echo "  Network:  host mode"
echo "========================================"
