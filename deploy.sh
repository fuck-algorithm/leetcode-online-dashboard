#!/bin/bash
# ============================================
# LeetCode Dashboard - Deploy Script
# ============================================
# 功能：上传代码到服务器并在服务器上构建部署
# 特性：
#   - 上传源代码到服务器
#   - 在服务器本地构建Docker镜像
#   - 3个独立服务镜像（backend/crawler/frontend）
#   - 使用Docker Compose + host网络模式启动
#   - 自动安装Docker Compose

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
PROJECT_NAME="leetcode-dashboard"
REMOTE_HOST="${REMOTE_HOST:-43.228.79.80}"
REMOTE_PORT="${REMOTE_PORT:-26451}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/leetcode-dashboard}"
SSH_KEY="${SSH_KEY:-~/.ssh/id_ed25519}"

# 打印信息
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# 检查SSH连接
check_ssh() {
    log_step "Checking SSH connection to ${REMOTE_HOST}:${REMOTE_PORT}..."
    if ! ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$REMOTE_USER@$REMOTE_HOST" "echo 'SSH_OK'" &>/dev/null; then
        log_error "Cannot connect to server"
        exit 1
    fi
    log_success "SSH connection OK"
}

# 在服务器上安装Docker Compose
install_docker_compose() {
    log_step "Checking Docker Compose on server..."
    
    ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
        if command -v docker-compose &>/dev/null || docker compose version &>/dev/null 2>/dev/null; then
            echo "DOCKER_COMPOSE_OK"
            exit 0
        fi
        
        echo "Installing Docker Compose..."
        curl -SL https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
        echo "DOCKER_COMPOSE_INSTALLED"
EOF
    
    log_success "Docker Compose ready"
}

# 上传源代码到服务器
upload_code() {
    log_step "Uploading source code to server..."
    
    # 创建远程目录
    ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_DIR"
    
    # 上传后端代码
    log_info "Uploading backend code..."
    scp -i "$SSH_KEY" -P "$REMOTE_PORT" -o StrictHostKeyChecking=no -r backend/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
    
    # 上传前端代码
    log_info "Uploading frontend code..."
    scp -i "$SSH_KEY" -P "$REMOTE_PORT" -o StrictHostKeyChecking=no -r frontend/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
    
    log_success "Code uploaded"
}

# 上传部署配置文件
upload_config() {
    log_step "Uploading deployment configs..."
    
    # 创建docker-compose.host.yml
    cat > /tmp/docker-compose.host.yml << 'EOF'
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: leetcode-redis
    network_mode: host
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - ./redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

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
      - REDIS_DB=0
      - BATCH_SIZE=10
      - INTERVAL_SEC=30
      - GIN_MODE=release
    volumes:
      - ./data:/data
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:52106/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

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
      - REDIS_DB=0
      - BATCH_SIZE=10
      - INTERVAL_SEC=30
      - LOG_LEVEL=info
    volumes:
      - ./data:/data
    depends_on:
      redis:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    image: leetcode-dashboard-frontend:latest
    container_name: leetcode-frontend
    network_mode: host
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:52107/"]
      interval: 30s
      timeout: 3s
      retries: 3

volumes:
  redis-data:
  data:
EOF
    
    # 上传配置文件
    scp -i "$SSH_KEY" -P "$REMOTE_PORT" -o StrictHostKeyChecking=no /tmp/docker-compose.host.yml "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
    rm -f /tmp/docker-compose.host.yml
    
    log_success "Configs uploaded"
}

# 在服务器上构建镜像
build_on_server() {
    log_step "Building Docker images on server..."
    
    ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << EOF
        cd $REMOTE_DIR
        
        echo "Building backend image..."
        docker build -t leetcode-dashboard-backend:latest -f backend/Dockerfile backend/
        
        echo "Building crawler image..."
        docker build -t leetcode-dashboard-crawler:latest -f backend/Dockerfile.crawler backend/
        
        echo "Building frontend image..."
        docker build -t leetcode-dashboard-frontend:latest -f frontend/Dockerfile frontend/
        
        echo "Images built:"
        docker images | grep leetcode-dashboard
EOF
    
    log_success "Images built on server"
}

# 部署服务
deploy_services() {
    log_step "Deploying services..."
    
    ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << EOF
        cd $REMOTE_DIR
        
        # 创建数据目录
        mkdir -p data redis-data
        
        # 停止旧服务
        echo "Stopping old services..."
        docker-compose -f docker-compose.host.yml down --remove-orphans 2>/dev/null || true
        
        # 启动新服务
        echo "Starting services with host network..."
        docker-compose -f docker-compose.host.yml up -d
        
        # 等待启动
        sleep 10
        
        # 检查状态
        echo "Service status:"
        docker-compose -f docker-compose.host.yml ps
EOF
    
    log_success "Services deployed"
}

# 健康检查
health_check() {
    log_step "Health check..."
    
    local max_retries=5
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "curl -s http://127.0.0.1:52106/api/health" &>/dev/null; then
            log_success "Health check passed!"
            echo ""
            echo "========================================"
            echo "  LeetCode Dashboard Deployed!"
            echo "========================================"
            echo "  Backend API: http://${REMOTE_HOST}:52106"
            echo "  Frontend:    http://${REMOTE_HOST}:52107"
            echo "  Health:      http://${REMOTE_HOST}:52106/api/health"
            echo "========================================"
            echo ""
            echo "  Network Mode: host"
            echo "  Redis: 127.0.0.1:6379 (localhost only)"
            echo ""
            return 0
        fi
        
        retry=$((retry + 1))
        log_info "Health check retry $retry/$max_retries..."
        sleep 5
    done
    
    log_error "Health check failed!"
    return 1
}

# 显示帮助
show_help() {
    cat << EOF
Usage: $0 [COMMAND]

Commands:
    deploy          完整部署流程（上传代码→构建→部署）
    upload          仅上传代码和配置
    build           在服务器上构建镜像
    start           启动服务
    stop            停止服务
    restart         重启服务
    status          查看服务状态
    logs            查看日志

Environment:
    REMOTE_HOST     服务器地址 [默认: 43.228.79.80]
    REMOTE_PORT     SSH端口 [默认: 26451]
    REMOTE_USER     SSH用户名 [默认: root]
    REMOTE_DIR      远程目录 [默认: /opt/leetcode-dashboard]
    SSH_KEY         SSH密钥路径

Examples:
    ./deploy.sh deploy    # 完整部署
    ./deploy.sh status    # 查看状态
    ./deploy.sh logs      # 查看日志
EOF
}

# 主函数
main() {
    echo "========================================"
    echo "  LeetCode Dashboard Deploy"
    echo "========================================"
    
    case "${1:-deploy}" in
        deploy)
            check_ssh
            install_docker_compose
            upload_code
            upload_config
            build_on_server
            deploy_services
            health_check
            ;;
        upload)
            check_ssh
            upload_code
            upload_config
            ;;
        build)
            check_ssh
            build_on_server
            ;;
        start)
            check_ssh
            deploy_services
            ;;
        stop)
            ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker-compose -f docker-compose.host.yml down"
            ;;
        restart)
            ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker-compose -f docker-compose.host.yml restart"
            ;;
        status)
            check_ssh
            ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker-compose -f docker-compose.host.yml ps"
            ;;
        logs)
            ssh -i "$SSH_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker-compose -f docker-compose.host.yml logs -f"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
