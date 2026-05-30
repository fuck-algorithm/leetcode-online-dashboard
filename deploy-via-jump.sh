#!/bin/bash
# ============================================
# LeetCode Dashboard - Deploy via Jump Server
# 通过中转服务器部署到目标服务器
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 服务器配置
TARGET_HOST="148.135.100.102"
TARGET_PORT="22"
TARGET_USER="root"
JUMP_HOST="43.228.79.80"
JUMP_PORT="26451"
JUMP_USER="root"

# 部署配置
REMOTE_DIR="/opt/leetcode-dashboard"
PROJECT_NAME="leetcode-dashboard"

# 打印信息
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# 提示输入密码
prompt_password() {
    if [ -z "$TARGET_PASS" ]; then
        echo -n "请输入目标服务器密码: "
        read -s TARGET_PASS
        echo ""
    fi
    if [ -z "$JUMP_PASS" ]; then
        echo -n "请输入中转服务器密码 (如果与目标相同请直接回车): "
        read -s JUMP_PASS
        echo ""
        if [ -z "$JUMP_PASS" ]; then
            JUMP_PASS="$TARGET_PASS"
        fi
    fi
}

# 检查环境
check_env() {
    log_step "检查部署环境..."
    
    # 检查 sshpass
    if ! command -v sshpass &> /dev/null; then
        log_error "sshpass not found. Please install: brew install sshpass"
        exit 1
    fi
    
    log_success "环境检查通过"
}

# 构建镜像
build_images() {
    log_step "构建 Docker 镜像..."
    
    cd "$(dirname "$0")"
    
    log_info "构建后端镜像..."
    docker build -t leetcode-dashboard-backend:latest -f backend/Dockerfile backend/
    
    log_info "构建爬虫镜像..."
    docker build -t leetcode-dashboard-crawler:latest -f backend/Dockerfile.crawler backend/
    
    log_info "构建前端镜像..."
    docker build -t leetcode-dashboard-frontend:latest -f frontend/Dockerfile frontend/
    
    log_success "镜像构建完成"
}

# 创建部署包
create_deploy_package() {
    log_step "创建部署包..."
    
    cd "$(dirname "$0")"
    
    # 创建临时目录
    DEPLOY_DIR=$(mktemp -d)
    
    # 复制必要文件（排除不需要的目录）
    mkdir -p "$DEPLOY_DIR/backend"
    cp -r backend/* "$DEPLOY_DIR/backend/" 2>/dev/null || true
    rm -rf "$DEPLOY_DIR/backend/data" 2>/dev/null || true
    
    mkdir -p "$DEPLOY_DIR/frontend"
    cp -r frontend/* "$DEPLOY_DIR/frontend/" 2>/dev/null || true
    rm -rf "$DEPLOY_DIR/frontend/node_modules" 2>/dev/null || true
    
    cp docker-compose.prod.yml "$DEPLOY_DIR/"
    cp .env "$DEPLOY_DIR/" 2>/dev/null || cp .env.example "$DEPLOY_DIR/.env"
    cp remote-deploy.sh "$DEPLOY_DIR/"
    
    # 创建 redis 目录和配置
    mkdir -p "$DEPLOY_DIR/redis"
    if [ -f redis/redis.conf ]; then
        cp redis/redis.conf "$DEPLOY_DIR/redis/"
    fi
    
    # 打包
    tar czf deploy-package.tar.gz -C "$DEPLOY_DIR" .
    
    # 清理临时目录
    rm -rf "$DEPLOY_DIR"
    
    log_success "部署包创建完成: deploy-package.tar.gz ($(du -h deploy-package.tar.gz | cut -f1))"
}

# 通过中转服务器上传文件到目标服务器
upload_via_jump() {
    log_step "通过中转服务器上传文件..."
    
    cd "$(dirname "$0")"
    
    # 创建目标服务器上的目录
    sshpass -p "$TARGET_PASS" ssh -o StrictHostKeyChecking=no \
        -o ProxyCommand="sshpass -p '$JUMP_PASS' ssh -o StrictHostKeyChecking=no -p $JUMP_PORT -W %h:%p $JUMP_USER@$JUMP_HOST" \
        -p "$TARGET_PORT" "$TARGET_USER@$TARGET_HOST" "mkdir -p $REMOTE_DIR"
    
    # 上传部署包
    log_info "上传部署包到目标服务器..."
    sshpass -p "$TARGET_PASS" scp -o StrictHostKeyChecking=no \
        -o ProxyCommand="sshpass -p '$JUMP_PASS' ssh -o StrictHostKeyChecking=no -p $JUMP_PORT -W %h:%p $JUMP_USER@$JUMP_HOST" \
        -P "$TARGET_PORT" deploy-package.tar.gz "$TARGET_USER@$TARGET_HOST:$REMOTE_DIR/"
    
    log_success "文件上传完成"
}

# 在目标服务器上部署
deploy_on_target() {
    log_step "在目标服务器上执行部署..."
    
    sshpass -p "$TARGET_PASS" ssh -o StrictHostKeyChecking=no \
        -o ProxyCommand="sshpass -p '$JUMP_PASS' ssh -o StrictHostKeyChecking=no -p $JUMP_PORT -W %h:%p $JUMP_USER@$JUMP_HOST" \
        -p "$TARGET_PORT" "$TARGET_USER@$TARGET_HOST" << EOF
        cd $REMOTE_DIR
        
        # 解压部署包
        tar xzf deploy-package.tar.gz
        rm deploy-package.tar.gz
        
        # 检查 Docker 环境
        if ! command -v docker &> /dev/null; then
            echo "正在安装 Docker..."
            curl -fsSL https://get.docker.com | sh
            systemctl enable docker
            systemctl start docker
        fi
        
        if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
            echo "正在安装 Docker Compose..."
            curl -SL https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
            ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
        fi
        
        # 构建镜像
        echo "构建 Docker 镜像..."
        docker build -t leetcode-dashboard-backend:latest -f backend/Dockerfile backend/
        docker build -t leetcode-dashboard-crawler:latest -f backend/Dockerfile.crawler backend/
        docker build -t leetcode-dashboard-frontend:latest -f frontend/Dockerfile frontend/
        
        # 执行远程部署脚本
        chmod +x remote-deploy.sh
        ./remote-deploy.sh
        
        echo "========================================"
        echo "  部署完成"
        echo "========================================"
        echo "  Backend: http://$TARGET_HOST:52106"
        echo "  Frontend: http://$TARGET_HOST:52107"
        echo "========================================"
EOF
    
    log_success "目标服务器部署完成"
}

# 清理本地文件
cleanup() {
    log_step "清理本地临时文件..."
    rm -f deploy-package.tar.gz 2>/dev/null || true
    log_success "清理完成"
}

# 显示帮助
show_help() {
    cat << EOF
Usage: $0 [OPTIONS] COMMAND

Commands:
    deploy      完整部署流程（上传代码并在远程服务器构建）
    upload      仅上传文件
    clean       清理临时文件

Options:
    -h, --help  显示帮助信息

Environment Variables:
    TARGET_PASS     目标服务器密码 (可选，会提示输入)
    JUMP_PASS       中转服务器密码 (可选，默认与目标相同)

Examples:
    # 完整部署（在远程服务器构建镜像）
    TARGET_PASS=yourpassword ./deploy-via-jump.sh deploy

    # 仅上传文件
    TARGET_PASS=yourpassword ./deploy-via-jump.sh upload
EOF
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "=========================================="
    echo "  LeetCode Dashboard - Deploy via Jump"
    echo "=========================================="
    echo -e "${NC}"
    
    # 显示配置
    log_info "目标服务器: $TARGET_HOST:$TARGET_PORT"
    log_info "中转服务器: $JUMP_HOST:$JUMP_PORT"
    log_info "部署目录: $REMOTE_DIR"
    echo ""
    
    # 解析参数
    COMMAND="${1:-deploy}"
    
    case $COMMAND in
        deploy|upload|clean)
            ;;
        -h|--help|help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
    
    # 获取密码（如果需要）
    if [ "$COMMAND" != "clean" ]; then
        prompt_password
    fi
    
    # 执行命令
    case $COMMAND in
        deploy)
            check_env
            create_deploy_package
            upload_via_jump
            deploy_on_target
            cleanup
            log_success "========================================"
            log_success "  部署全部完成!"
            log_success "========================================"
            echo ""
            echo "  访问地址:"
            echo "    Backend:  http://$TARGET_HOST:52106"
            echo "    Frontend: http://$TARGET_HOST:52107"
            echo ""
            ;;
        upload)
            create_deploy_package
            upload_via_jump
            ;;
        clean)
            cleanup
            ;;
    esac
}

main "$@"
