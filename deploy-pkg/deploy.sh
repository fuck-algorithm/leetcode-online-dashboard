#!/bin/bash
# ============================================
# LeetCode Dashboard - Build & Deploy Script
# ============================================
# 新架构：支持多环境部署（开发/测试/生产）
# 功能：构建镜像、推送仓库、部署到云服务器

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_NAME="leetcode-dashboard"
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "latest")
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUILD_ID="${VERSION}-${TIMESTAMP}"

# 镜像仓库配置（可配置为阿里云、Docker Hub等）
REGISTRY_URL="${REGISTRY_URL:-}"
NAMESPACE="${NAMESPACE:-leetcode}"

# 部署环境
ENVIRONMENT="${ENVIRONMENT:-production}"
COMPOSE_FILE="docker-compose.prod.yml"

# 远程服务器配置
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/leetcode-dashboard}"
SSH_KEY="${SSH_KEY:-~/.ssh/id_rsa}"

# 打印信息
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

# 检查依赖
check_dependencies() {
    log_info "Checking dependencies..."
    
    command -v docker >/dev/null 2>&1 || { log_error "Docker is required but not installed."; exit 1; }
    command -v docker-compose >/dev/null 2>&1 || { log_error "Docker Compose is required but not installed."; exit 1; }
    
    if [ -n "$REGISTRY_URL" ]; then
        docker info | grep -q "Username" || {
            log_warning "Not logged into Docker registry. Attempting login..."
            docker login "$REGISTRY_URL" || { log_error "Docker registry login failed"; exit 1; }
        }
    fi
    
    log_success "All dependencies satisfied"
}

# 构建单个镜像
build_image() {
    local service=$1
    local dockerfile=$2
    local context=$3
    local image_name="${PROJECT_NAME}-${service}"
    
    if [ -n "$REGISTRY_URL" ]; then
        image_name="${REGISTRY_URL}/${NAMESPACE}/${image_name}"
    fi
    
    log_info "Building ${service} image..."
    log_info "  Dockerfile: ${dockerfile}"
    log_info "  Context: ${context}"
    log_info "  Tag: ${image_name}:${BUILD_ID}"
    
    docker build \
        --build-arg BUILD_ID="${BUILD_ID}" \
        --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --build-arg VERSION="${VERSION}" \
        -t "${image_name}:${BUILD_ID}" \
        -t "${image_name}:latest" \
        -f "${dockerfile}" \
        "${context}"
    
    if [ $? -eq 0 ]; then
        log_success "${service} image built successfully"
    else
        log_error "Failed to build ${service} image"
        exit 1
    fi
}

# 构建所有镜像
build_all_images() {
    log_info "Starting image build process..."
    log_info "Build ID: ${BUILD_ID}"
    log_info "Version: ${VERSION}"
    
    # 构建后端镜像
    build_image "backend" "backend/Dockerfile" "backend"
    
    # 构建爬虫镜像
    build_image "crawler" "backend/Dockerfile.crawler" "backend"
    
    # 构建前端镜像
    build_image "frontend" "frontend/Dockerfile" "frontend"
    
    log_success "All images built successfully"
}

# 推送镜像到仓库
push_images() {
    if [ -z "$REGISTRY_URL" ]; then
        log_warning "No registry URL configured, skipping push"
        return 0
    fi
    
    log_info "Pushing images to registry: ${REGISTRY_URL}"
    
    local services=("backend" "crawler" "frontend")
    for service in "${services[@]}"; do
        local image_name="${REGISTRY_URL}/${NAMESPACE}/${PROJECT_NAME}-${service}"
        
        log_info "Pushing ${service}..."
        docker push "${image_name}:${BUILD_ID}"
        docker push "${image_name}:latest"
    done
    
    log_success "All images pushed successfully"
}

# 准备部署包
prepare_deploy_package() {
    log_info "Preparing deployment package..."
    
    local deploy_dir="deploy-${BUILD_ID}"
    mkdir -p "${deploy_dir}"
    
    # 复制配置文件
    cp "${COMPOSE_FILE}" "${deploy_dir}/"
    cp -r redis "${deploy_dir}/" 2>/dev/null || true
    
    # 创建环境配置文件
    cat > "${deploy_dir}/.env" << EOF
# 部署环境配置
COMPOSE_PROJECT_NAME=${PROJECT_NAME}
BUILD_ID=${BUILD_ID}
VERSION=${VERSION}
ENVIRONMENT=${ENVIRONMENT}

# 镜像配置
BACKEND_IMAGE=${REGISTRY_URL:+${REGISTRY_URL}/${NAMESPACE}/}${PROJECT_NAME}-backend:${BUILD_ID}
CRAWLER_IMAGE=${REGISTRY_URL:+${REGISTRY_URL}/${NAMESPACE}/}${PROJECT_NAME}-crawler:${BUILD_ID}
FRONTEND_IMAGE=${REGISTRY_URL:+${REGISTRY_URL}/${NAMESPACE}/}${PROJECT_NAME}-frontend:${BUILD_ID}

# 应用配置
BACKEND_PORT=52106
FRONTEND_PORT=52107
REDIS_PORT=6379

# 数据卷路径
DATA_DIR=./data
REDIS_DATA_DIR=./redis-data

# 日志级别
LOG_LEVEL=info
EOF

    # 创建部署脚本
    cat > "${deploy_dir}/deploy.sh" << 'EOF'
#!/bin/bash
# 远程服务器部署脚本

set -e

log_info() { echo "[INFO] $1"; }
log_success() { echo "[SUCCESS] $1"; }
log_error() { echo "[ERROR] $1"; }

# 创建必要的目录
mkdir -p data redis-data

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 拉取最新镜像
log_info "Pulling latest images..."
docker-compose -f docker-compose.prod.yml pull

# 停止旧服务
log_info "Stopping old services..."
docker-compose -f docker-compose.prod.yml down --remove-orphans

# 清理旧镜像
log_info "Cleaning old images..."
docker image prune -f

# 启动新服务
log_info "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# 等待服务就绪
log_info "Waiting for services to be ready..."
sleep 10

# 健康检查
log_info "Performing health checks..."
if docker-compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
    log_success "All services are healthy"
else
    log_warning "Some services may not be healthy, please check manually"
    docker-compose -f docker-compose.prod.yml ps
fi

log_success "Deployment completed!"
EOF
    chmod +x "${deploy_dir}/deploy.sh"
    
    # 打包
    tar czf "${deploy_dir}.tar.gz" "${deploy_dir}"
    rm -rf "${deploy_dir}"
    
    log_success "Deployment package created: ${deploy_dir}.tar.gz"
    echo "${deploy_dir}.tar.gz"
}

# 部署到远程服务器
deploy_remote() {
    if [ -z "$REMOTE_HOST" ]; then
        log_error "REMOTE_HOST not set. Cannot deploy remotely."
        exit 1
    fi
    
    log_info "Deploying to remote server: ${REMOTE_HOST}"
    
    local deploy_package=$(prepare_deploy_package)
    
    # 上传部署包
    log_info "Uploading deployment package..."
    scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no \
        "${deploy_package}" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
    
    # 执行远程部署
    log_info "Executing remote deployment..."
    ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no \
        "${REMOTE_USER}@${REMOTE_HOST}" << EOSSH
        set -e
        cd "${REMOTE_DIR}"
        
        # 解压部署包
        tar xzf "${deploy_package}"
        cd "${deploy_package%.tar.gz}"
        
        # 执行部署脚本
        ./deploy.sh
        
        # 清理
        cd ..
        rm -rf "${deploy_package%.tar.gz}"
EOSSH
    
    # 清理本地部署包
    rm -f "${deploy_package}"
    
    log_success "Remote deployment completed"
}

# 本地部署
 deploy_local() {
    log_info "Deploying locally..."
    
    # 创建必要的目录
    mkdir -p data redis-data
    
    # 加载环境变量
    export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"
    export BACKEND_IMAGE="${PROJECT_NAME}-backend:${BUILD_ID}"
    export CRAWLER_IMAGE="${PROJECT_NAME}-crawler:${BUILD_ID}"
    export FRONTEND_IMAGE="${PROJECT_NAME}-frontend:${BUILD_ID}"
    
    # 停止旧服务
    docker-compose -f "${COMPOSE_FILE}" down --remove-orphans 2>/dev/null || true
    
    # 启动新服务
    docker-compose -f "${COMPOSE_FILE}" up -d
    
    # 等待服务就绪
    sleep 10
    
    # 检查状态
    if docker-compose -f "${COMPOSE_FILE}" ps | grep -q "Up"; then
        log_success "Local deployment completed!"
        docker-compose -f "${COMPOSE_FILE}" ps
    else
        log_error "Some services failed to start"
        docker-compose -f "${COMPOSE_FILE}" logs
        exit 1
    fi
}

# 清理旧镜像和容器
cleanup() {
    log_info "Cleaning up old images and containers..."
    
    # 清理悬空镜像
    docker image prune -f
    
    # 清理已停止的容器
    docker container prune -f
    
    # 可选：清理旧版本镜像（保留最近5个版本）
    local services=("backend" "crawler" "frontend")
    for service in "${services[@]}"; do
        local image_name="${PROJECT_NAME}-${service}"
        if [ -n "$REGISTRY_URL" ]; then
            image_name="${REGISTRY_URL}/${NAMESPACE}/${image_name}"
        fi
        
        # 获取镜像列表并按创建时间排序，删除旧的
        docker images "${image_name}" --format "{{.ID}} {{.Tag}}" | \
            grep -v "latest" | \
            grep -v "${BUILD_ID}" | \
            tail -n +6 | \
            awk '{print $1}' | \
            xargs -r docker rmi -f 2>/dev/null || true
    done
    
    log_success "Cleanup completed"
}

# 显示帮助信息
show_help() {
    cat << EOF
Usage: $0 [OPTIONS] [COMMAND]

Commands:
    build       构建所有Docker镜像
    push        推送镜像到远程仓库
    deploy      部署到远程服务器
    local       本地部署
    all         完整流程：构建+推送+部署
    cleanup     清理旧镜像和容器

Options:
    -e, --environment    部署环境 (development|staging|production) [默认: production]
    -r, --registry       Docker镜像仓库地址
    -n, --namespace      镜像仓库命名空间 [默认: leetcode]
    -h, --host           远程服务器地址
    -u, --user           远程服务器用户名 [默认: root]
    -d, --directory      远程部署目录 [默认: /opt/leetcode-dashboard]
    --help              显示帮助信息

Environment Variables:
    REGISTRY_URL        镜像仓库地址
    NAMESPACE           镜像仓库命名空间
    REMOTE_HOST         远程服务器地址
    REMOTE_USER         远程服务器用户名
    REMOTE_DIR          远程部署目录
    SSH_KEY             SSH密钥路径

Examples:
    # 本地构建和部署
    $0 build
    $0 local

    # 构建并推送到阿里云镜像仓库
    REGISTRY_URL=registry.cn-hangzhou.aliyuncs.com NAMESPACE=myproject $0 build push

    # 完整部署流程
    $0 -e production -r registry.cn-hangzhou.aliyuncs.com -h 192.168.1.100 all
EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -r|--registry)
                REGISTRY_URL="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -h|--host)
                REMOTE_HOST="$2"
                shift 2
                ;;
            -u|--user)
                REMOTE_USER="$2"
                shift 2
                ;;
            -d|--directory)
                REMOTE_DIR="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            build|push|deploy|local|all|cleanup)
                COMMAND="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 主函数
main() {
    log_info "LeetCode Dashboard Build & Deploy Script"
    log_info "========================================="
    
    parse_args "$@"
    
    if [ -z "$COMMAND" ]; then
        show_help
        exit 1
    fi
    
    # 切换到项目根目录
    cd "$(dirname "$0")"
    
    case $COMMAND in
        build)
            check_dependencies
            build_all_images
            ;;
        push)
            push_images
            ;;
        deploy)
            deploy_remote
            ;;
        local)
            check_dependencies
            build_all_images
            deploy_local
            ;;
        all)
            check_dependencies
            build_all_images
            push_images
            deploy_remote
            cleanup
            ;;
        cleanup)
            cleanup
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
    
    log_success "Operation completed successfully!"
}

main "$@"
