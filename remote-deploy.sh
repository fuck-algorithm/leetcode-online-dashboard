#!/bin/bash
# ============================================
# LeetCode Dashboard - Remote Deployment Script
# 在服务器上执行此脚本完成部署
# ============================================

set -e

PROJECT_DIR="/opt/leetcode-dashboard"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$PROJECT_DIR"

log_info "========================================"
log_info "  LeetCode Dashboard - Deployment"
log_info "========================================"
echo ""

# Step 1: Check Docker and Docker Compose
log_info "[1/7] Checking Docker environment..."
if ! command -v docker &> /dev/null; then
    log_error "Docker not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_info "Installing Docker Compose..."
    curl -SL https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
fi

log_success "Docker environment OK"
echo ""

# Step 2: Create environment file
log_info "[2/7] Creating environment file..."
if [ ! -f .env ]; then
cat > .env << 'EOF'
COMPOSE_PROJECT_NAME=leetcode-dashboard
ENVIRONMENT=production
BACKEND_IMAGE=leetcode-dashboard-backend:latest
CRAWLER_IMAGE=leetcode-dashboard-crawler:latest
FRONTEND_IMAGE=leetcode-dashboard-frontend:latest
BACKEND_PORT=52106
FRONTEND_PORT=52107
DATA_DIR=./data
REDIS_DATA_DIR=./redis-data
LOG_LEVEL=info
BATCH_SIZE=10
INTERVAL_SEC=30
TZ=Asia/Shanghai
# K8s PostgreSQL（集群外 NodePort）
DB_HOST=local-server-001
DB_PORT=30432
DB_USER=leetcode_dashboard
DB_PASSWORD=change-me
DB_NAME=leetcode_dashboard
DB_SSLMODE=disable
DB_TIMEZONE=Asia/Shanghai

# K8s Redis（集群外 NodePort）
REDIS_HOST=local-server-001
REDIS_PORT=30379
EOF
fi
log_success "Environment file created"
echo ""

# Step 3: Create secure Redis config
log_info "[3/7] Creating secure Redis configuration..."
mkdir -p redis
cat > redis/redis.conf << 'EOF'
# Redis安全配置 - 只允许本地连接
bind 127.0.0.1 ::1
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# 持久化配置
appendonly yes
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# 内存限制
maxmemory 256mb
maxmemory-policy allkeys-lru

# 日志配置
loglevel notice
logfile ""

# 安全配置 - 禁用危险命令
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
rename-command DEBUG ""

# 数据库数量
databases 1
EOF
chmod 644 redis/redis.conf
log_success "Redis configured (localhost only)"
echo ""

# Step 4: Create data directories
log_info "[4/7] Creating data directories..."
mkdir -p data redis-data
chmod 755 data redis-data
log_success "Data directories created"
echo ""

# Step 5: Build images
log_info "[5/7] Building Docker images..."

log_info "Building backend..."
docker build -t leetcode-dashboard-backend:latest -f backend/Dockerfile backend/ 2>&1 | tail -3

log_info "Building crawler..."
docker build -t leetcode-dashboard-crawler:latest -f backend/Dockerfile.crawler backend/ 2>&1 | tail -3

log_info "Building frontend..."
docker build -t leetcode-dashboard-frontend:latest -f frontend/Dockerfile frontend/ 2>&1 | tail -3

log_success "All images built"
echo ""
docker images | grep leetcode-dashboard
echo ""

# Step 6: Deploy services
log_info "[6/7] Deploying services..."
docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
docker-compose -f docker-compose.prod.yml up -d 2>&1 | tail -10
log_success "Services deployed"
echo ""

# Step 7: Health check and security verification
log_info "[7/7] Running health check..."
sleep 5

# Check services
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    log_success "All services are running"
else
    log_warning "Some services may not be fully started yet"
fi

echo ""
log_info "========================================"
log_info "  Deployment Summary"
log_info "========================================"
echo ""
docker-compose -f docker-compose.prod.yml ps
echo ""
log_success "========================================"
log_success "  LeetCode Dashboard Deployed!"
log_success "========================================"
echo "  Backend API: http://YOUR_SERVER_IP:52106"
echo "  Frontend:    http://YOUR_SERVER_IP:52107"
echo "  Health:      http://YOUR_SERVER_IP:52106/api/health"
echo ""
echo "  Security:"
echo "    - Redis: K8s redis.database (local-server-001:30379)"
echo "    - PostgreSQL: K8s postgres.database (local-server-001:30432)"
echo ""
echo "  To check logs:"
echo "    cd /opt/leetcode-dashboard && docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "  To restart:"
echo "    cd /opt/leetcode-dashboard && docker-compose -f docker-compose.prod.yml restart"
echo ""
log_success "========================================"
