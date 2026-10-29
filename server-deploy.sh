#!/bin/bash
# ============================================
# LeetCode Dashboard - Quick Deploy Script
# ============================================
# 服务器上执行的快速部署脚本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/opt/leetcode-dashboard"
COMPOSE_FILE="docker-compose.prod.yml"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查并安装Docker Compose
check_docker_compose() {
    log_info "Checking Docker Compose..."
    
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        log_success "Docker Compose is installed"
    else
        log_warning "Docker Compose not found, installing..."
        curl -SL https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
        log_success "Docker Compose installed"
    fi
}

# 准备环境
prepare_environment() {
    log_info "Preparing environment..."
    
    cd "$PROJECT_DIR"
    
    # 创建必要目录
    mkdir -p data redis-data
    
    # 创建环境配置文件
    if [ ! -f .env ]; then
        log_info "Creating .env file..."
        cat > .env << 'EOF'
# 项目配置
COMPOSE_PROJECT_NAME=leetcode-dashboard
ENVIRONMENT=production

# 镜像配置（使用本地构建的镜像）
BACKEND_IMAGE=leetcode-dashboard-backend:latest
CRAWLER_IMAGE=leetcode-dashboard-dashboard-crawler:latest
FRONTEND_IMAGE=leetcode-dashboard-frontend:latest

# 端口配置
BACKEND_PORT=52106
FRONTEND_PORT=52107

# 数据目录
DATA_DIR=./data
REDIS_DATA_DIR=./redis-data

# 应用配置
LOG_LEVEL=info
BATCH_SIZE=10
INTERVAL_SEC=30

# 时区
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
        log_success ".env file created"
    fi
    
    # 创建安全的Redis配置
    log_info "Creating secure Redis configuration..."
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
    log_success "Redis configuration created (localhost only)"
}

# 构建镜像
build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_DIR"
    
    # 检查是否有Dockerfile
    if [ ! -f backend/Dockerfile ] || [ ! -f frontend/Dockerfile ]; then
        log_error "Dockerfile not found. Please ensure source code is uploaded."
        exit 1
    fi
    
    # 构建后端镜像
    log_info "Building backend image..."
    docker build -t leetcode-dashboard-backend:latest -f backend/Dockerfile backend/
    
    # 构建爬虫镜像
    log_info "Building crawler image..."
    docker build -t leetcode-dashboard-crawler:latest -f backend/Dockerfile.crawler backend/
    
    # 构建前端镜像
    log_info "Building frontend image..."
    docker build -t leetcode-dashboard-frontend:latest -f frontend/Dockerfile frontend/
    
    log_success "All images built successfully"
}

# 部署服务
deploy() {
    log_info "Deploying services..."
    
    cd "$PROJECT_DIR"
    
    # 停止旧服务
    log_info "Stopping old services..."
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
    
    # 启动新服务
    log_info "Starting new services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # 等待服务启动
    log_info "Waiting for services to start..."
    sleep 10
    
    # 检查服务状态
    log_info "Checking service status..."
    docker-compose -f "$COMPOSE_FILE" ps
    
    log_success "Deployment completed!"
}

# 健康检查
health_check() {
    log_info "Performing health check..."
    
    local max_retries=5
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if curl -s http://localhost:52106/api/health &> /dev/null; then
            log_success "Health check passed!"
            echo ""
            echo "========================================"
            echo "  LeetCode Dashboard Deployed!"
            echo "========================================"
            echo "  Backend API: http://YOUR_SERVER_IP:52106"
            echo "  Frontend:    http://YOUR_SERVER_IP:52107"
            echo "  Health:      http://YOUR_SERVER_IP:52106/api/health"
            echo "========================================"
            return 0
        fi
        
        retry=$((retry + 1))
        log_info "Health check retry $retry/$max_retries..."
        sleep 5
    done
    
    log_error "Health check failed!"
    docker-compose -f "$COMPOSE_FILE" logs
    return 1
}

# 显示安全信息
show_security_info() {
    echo ""
    log_info "Security Configuration:"
    echo "  - Redis:    Only accessible from localhost (127.0.0.1)"
    echo "  - PostgreSQL: K8s postgres.database (local-server-001:30432)"
    echo "  - Backend:  Exposed on port 52106"
    echo "  - Frontend: Exposed on port 52107"
    echo ""
    log_info "To check logs:"
    echo "  docker-compose -f $COMPOSE_FILE logs -f"
    echo ""
    log_info "To restart:"
    echo "  docker-compose -f $COMPOSE_FILE restart"
    echo ""
}

# 主函数
main() {
    echo "========================================"
    echo "  LeetCode Dashboard - Quick Deploy"
    echo "========================================"
    echo ""
    
    case "${1:-all}" in
        setup)
            check_docker_compose
            prepare_environment
            ;;
        build)
            build_images
            ;;
        deploy)
            deploy
            ;;
        health)
            health_check
            ;;
        all|*)
            check_docker_compose
            prepare_environment
            build_images
            deploy
            health_check
            show_security_info
            ;;
    esac
}

main "$@"
