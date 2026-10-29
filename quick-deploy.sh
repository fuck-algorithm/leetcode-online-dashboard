#!/bin/bash
set -e
H=YOUR_SERVER_IP
P=22
K=~/.ssh/id_ed25519
U=root
D=/opt/leetcode-dashboard

echo "[1/5] Uploading backend..."
tar czf /tmp/backend.tar.gz --exclude='*.db' --exclude='tmp' backend/
scp -i $K -P $P -o StrictHostKeyChecking=no /tmp/backend.tar.gz $U@$H:$D/
ssh -i $K -p $P -o StrictHostKeyChecking=no $U@$H "cd $D && tar xzf backend.tar.gz && rm backend.tar.gz"

echo "[2/5] Uploading frontend (no node_modules)..."
tar czf /tmp/frontend.tar.gz --exclude='node_modules' --exclude='dist' frontend/
scp -i $K -P $P -o StrictHostKeyChecking=no /tmp/frontend.tar.gz $U@$H:$D/
ssh -i $K -p $P -o StrictHostKeyChecking=no $U@$H "cd $D && tar xzf frontend.tar.gz && rm frontend.tar.gz"

echo "[3/5] Creating docker-compose..."
ssh -i $K -p $P -o StrictHostKeyChecking=no $U@$H "cat > $D/docker-compose.host.yml << 'YML'
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: leetcode-redis
    network_mode: host
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru --bind 127.0.0.1
    volumes:
      - ./redis-data:/data
  backend:
    build: {context: ./backend, dockerfile: Dockerfile}
    image: leetcode-dashboard-backend:latest
    container_name: leetcode-backend
    network_mode: host
    environment:
      - PORT=52106
      - DB_HOST=127.0.0.1
      - DB_PORT=30432
      - DB_USER=leetcode_dashboard
      - DB_PASSWORD=change-me
      - DB_NAME=leetcode_dashboard
      - DB_SSLMODE=disable
      - DB_TIMEZONE=Asia/Shanghai
      - REDIS_HOST=127.0.0.1
      - REDIS_PORT=30379
    volumes:
      - ./data:/data
  crawler:
    build: {context: ./backend, dockerfile: Dockerfile.crawler}
    image: leetcode-dashboard-crawler:latest
    container_name: leetcode-crawler
    network_mode: host
    environment:
      - DB_HOST=127.0.0.1
      - DB_PORT=30432
      - DB_USER=leetcode_dashboard
      - DB_PASSWORD=change-me
      - DB_NAME=leetcode_dashboard
      - DB_SSLMODE=disable
      - DB_TIMEZONE=Asia/Shanghai
      - REDIS_HOST=127.0.0.1
      - REDIS_PORT=30379
    volumes:
      - ./data:/data
  frontend:
    build: {context: ./frontend, dockerfile: Dockerfile}
    image: leetcode-dashboard-frontend:latest
    container_name: leetcode-frontend
    network_mode: host
YML"

echo "[4/5] Building and deploying..."
ssh -i $K -p $P -o StrictHostKeyChecking=no $U@$H "
cd $D
mkdir -p data redis-data
docker-compose -f docker-compose.host.yml down 2>/dev/null || docker stop leetcode-backend leetcode-frontend leetcode-crawler leetcode-redis 2>/dev/null || true
docker build -t leetcode-dashboard-backend:latest -f backend/Dockerfile backend/ 2>&1 | tail -1
docker build -t leetcode-dashboard-crawler:latest -f backend/Dockerfile.crawler backend/ 2>&1 | tail -1
docker build -t leetcode-dashboard-frontend:latest -f frontend/Dockerfile frontend/ 2>&1 | tail -1
docker-compose -f docker-compose.host.yml up -d
"

echo "[5/5] Checking status..."
sleep 5
ssh -i $K -p $P -o StrictHostKeyChecking=no $U@$H "docker ps | grep leetcode"

echo ""
echo "==========================================="
echo "  Deployed! http://YOUR_SERVER_IP:52107"
echo "==========================================="
