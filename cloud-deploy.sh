#!/bin/bash
# ============================================
# LeetCode Dashboard - Cloud Deploy Script
# ============================================
# 云服务器部署专用脚本
# 支持：阿里云、腾讯云、AWS、GCP等

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
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-43.228.79.80}"
REMOTE_DIR="${REMOTE_DIR:-/opt/leetcode-dashboard}"
SSH_PORT="${SSH_PORT:-26451}"
SSH_KEY="${SSH_KEY:-~/.ssh/id_rsa}"

# 云服务商配置
CLOUD_PROVIDER="${CLOUD_PROVIDER:-}"  # aliyun, tencent, aws, gcp
REGION="${REGION:-}"
INSTANCE_ID="${INSTANCE_ID:-}"

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

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# 检查SSH连接
check_ssh() {
    log_step "Checking SSH connection to ${REMOTE_HOST}..."
    
    if [ -z "$REMOTE_HOST" ]; then
        log_error "REMOTE_HOST is not set"
        exit 1
    fi
    
    if ! ssh -i "$SSH_KEY" -p "$SSH_PORT" -o ConnectTimeout=5 -o StrictHostKeyChecking=no \
         "${REMOTE_USER}@${REMOTE_HOST}" "echo 'SSH OK'" &> /dev/null; then
        log_error "Cannot connect to ${REMOTE_HOST}:${SSH_PORT}"
        log_info "Please check:"
        log_info "  1. SSH key is correct: $SSH_KEY"
        log_info "  2. Server IP and port are correct"
        log_info "  3. Security group allows SSH access"
        exit 1
    fi
    
    log_success "SSH connection OK"
}

# 检查远程服务器环境
check_remote_env() {
    log_step "Checking remote server environment..."
    
    ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
        "${REMOTE_USER}@${REMOTE_HOST}" << 'EOF'
        # 检查Docker
        if ! command -v docker &> /dev/null; then
            echo "[ERROR] Docker not installed"
            exit 1
        fi
        
        # 检查Docker Compose
        if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
            echo "[ERROR] Docker Compose not installed"
            exit 1
        fi
        
        # 检查磁盘空间
        DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
        if [ "$DISK_USAGE" -gt 80 ]; then
            echo "[WARNING] Disk usage is ${DISK_USAGE}%"
        fi
        
        # 检查内存
        MEM_AVAILABLE=$(free | grep Mem | awk '{print $7}')
        if [ "$MEM_AVAILABLE" -lt 524288 ]; then  # 512MB in KB
            echo "[WARNING] Low memory available: ${MEM_AVAILABLE}KB"
        fi
        
        echo "[SUCCESS] Environment check passed"
EOF
}

# 安装Docker（如未安装）
install_docker() {
    log_step "Installing Docker on remote server..."
    
    ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
        "${REMOTE_USER}@${REMOTE_HOST}" << 'EOF'
        if command -v docker &> /dev/null; then
            echo "Docker already installed"
            exit 0
        fi
        
        # 安装Docker
        curl -fsSL https://get.docker.com | sh
        
        # 启动Docker服务
        systemctl enable docker
        systemctl start docker
        
        # 添加当前用户到docker组
        usermod -aG docker $USER
        
        echo "Docker installed successfully"
EOF
    
    log_success "Docker installation completed"
}

# 准备部署目录
prepare_remote_dir() {
    log_step "Preparing remote directory: ${REMOTE_DIR}..."
    
    ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
        "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}/{data,redis-data,redis}"
    
    log_success "Remote directory prepared"
}

# 上传文件
upload_files() {
    log_step "Uploading deployment files..."
    
    local files_to_upload=(
        "docker-compose.prod.yml"
        ".env"
        "redis/redis.conf"
    )
    
    for file in "${files_to_upload[@]}"; do
        if [ -f "$file" ]; then
            log_info "Uploading $file..."
            scp -i "$SSH_KEY" -P "$SSH_PORT" -o StrictHostKeyChecking=no \
                "$file" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
        else
            log_warning "File not found: $file"
        fi
    done
    
    log_success "Files uploaded"
}

# 拉取镜像
pull_images() {
    log_step "Pulling Docker images..."
    
    ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
        "${REMOTE_USER}@${REMOTE_HOST}" << EOF
        cd ${REMOTE_DIR}
        
        # 加载环境变量
        if [ -f .env ]; then
            export \$(cat .env | grep -v '^#' | xargs)
        fi
        
        # 拉取镜像
        docker-compose -f docker-compose.prod.yml pull
EOF
    
    log_success "Images pulled"
}

# 执行部署
deploy() {
    log_step "Deploying services..."
    
    ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
        "${REMOTE_USER}@${REMOTE_HOST}" << EOF
        cd ${REMOTE_DIR}
        
        # 加载环境变量
        if [ -f .env ]; then
            export \$(cat .env | grep -v '^#' | xargs)
        fi
        
        # 停止旧服务
        echo "Stopping old services..."
        docker-compose -f docker-compose.prod.yml down --remove-orphans
        
        # 清理旧镜像（可选）
        docker image prune -f
        
        # 启动新服务
        echo "Starting new services..."
        docker-compose -f docker-compose.prod.yml up -d
        
        # 等待服务启动
        sleep 10
        
        # 检查服务状态
        echo "Checking service status..."
        docker-compose -f docker-compose.prod.yml ps
EOF
    
    log_success "Deployment completed"
}

# 健康检查
health_check() {
    log_step "Performing health check..."
    
    local max_retries=5
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
            "${REMOTE_USER}@${REMOTE_HOST}" "curl -s http://localhost:52106/api/health" &> /dev/null; then
            log_success "Health check passed"
            return 0
        fi
        
        retry=$((retry + 1))
        log_info "Health check retry $retry/$max_retries..."
        sleep 5
    done
    
    log_error "Health check failed after $max_retries retries"
    return 1
}

# 显示部署信息
show_deploy_info() {
    log_step "Deployment Information"
    
    ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
        "${REMOTE_USER}@${REMOTE_HOST}" << EOF
        echo "========================================"
        echo "  Deployment Status"
        echo "========================================"
        echo ""
        cd ${REMOTE_DIR}
        docker-compose -f docker-compose.prod.yml ps
        echo ""
        echo "========================================"
        echo "  Service URLs"
        echo "========================================"
        echo "  Backend API: http://${REMOTE_HOST}:52106"
        echo "  Frontend:    http://${REMOTE_HOST}:52107"
        echo ""
        echo "  Health Check: http://${REMOTE_HOST}:52106/api/health"
        echo ""
        echo "========================================"
EOF
}

# 回滚部署
rollback() {
    log_step "Rolling back deployment..."
    
    ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
        "${REMOTE_USER}@${REMOTE_HOST}" << EOF
        cd ${REMOTE_DIR}
        
        # 停止当前服务
        docker-compose -f docker-compose.prod.yml down
        
        # 回滚到上一个版本（如果有备份）
        if [ -f docker-compose.prod.yml.bak ]; then
            cp docker-compose.prod.yml.bak docker-compose.prod.yml
        fi
        
        # 重新启动
        docker-compose -f docker-compose.prod.yml up -d
EOF
    
    log_success "Rollback completed"
}

# 备份数据
backup_data() {
    log_step "Backing up data..."
    
    local backup_dir="backup_$(date +%Y%m%d_%H%M%S)"
    
    ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
        "${REMOTE_USER}@${REMOTE_HOST}" << EOF
        mkdir -p ${REMOTE_DIR}/backups/${backup_dir}
        
        # 备份数据目录
        if [ -d ${REMOTE_DIR}/data ]; then
            tar czf ${REMOTE_DIR}/backups/${backup_dir}/data.tar.gz -C ${REMOTE_DIR} data
        fi
        
        # 备份Redis数据
        if [ -d ${REMOTE_DIR}/redis-data ]; then
            tar czf ${REMOTE_DIR}/backups/${backup_dir}/redis-data.tar.gz -C ${REMOTE_DIR} redis-data
        fi
        
        # 备份配置文件
        cp ${REMOTE_DIR}/.env ${REMOTE_DIR}/backups/${backup_dir}/ 2>/dev/null || true
        cp ${REMOTE_DIR}/docker-compose.prod.yml ${REMOTE_DIR}/backups/${backup_dir}/ 2>/dev/null || true
        
        echo "Backup created: ${REMOTE_DIR}/backups/${backup_dir}"
EOF
    
    log_success "Backup completed: ${backup_dir}"
}

# 显示帮助
show_help() {
    cat << EOF
Usage: $0 [OPTIONS] COMMAND

Commands:
    deploy          完整部署流程（检查→上传→部署→健康检查）
    check           检查远程服务器环境
    install         在远程服务器安装Docker
    upload          上传部署文件
    pull            拉取Docker镜像
    start           启动服务
    stop            停止服务
    restart         重启服务
    status          查看服务状态
    logs            查看服务日志
    backup          备份数据
    rollback        回滚部署
    update          更新部署（拉取新镜像并重启）

Options:
    -h, --host          远程服务器IP或域名
    -u, --user          SSH用户名 [默认: root]
    -p, --port          SSH端口 [默认: 22]
    -k, --key           SSH密钥路径 [默认: ~/.ssh/id_rsa]
    -d, --directory     远程部署目录 [默认: /opt/leetcode-dashboard]
    --provider          云服务商 (aliyun|tencent|aws|gcp)
    --region            云服务器区域
    --instance-id       云服务器实例ID
    --help              显示帮助信息

Environment Variables:
    REMOTE_HOST         远程服务器地址
    REMOTE_USER         SSH用户名
    REMOTE_DIR          远程部署目录
    SSH_KEY             SSH密钥路径
    CLOUD_PROVIDER      云服务商

Examples:
    # 完整部署
    $0 -h 192.168.1.100 deploy

    # 仅更新镜像
    $0 -h 192.168.1.100 update

    # 检查环境
    $0 -h 192.168.1.100 check

    # 查看日志
    $0 -h 192.168.1.100 logs

    # 备份数据
    $0 -h 192.168.1.100 backup
EOF
}

# 解析参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--host)
                REMOTE_HOST="$2"
                shift 2
                ;;
            -u|--user)
                REMOTE_USER="$2"
                shift 2
                ;;
            -p|--port)
                SSH_PORT="$2"
                shift 2
                ;;
            -k|--key)
                SSH_KEY="$2"
                shift 2
                ;;
            -d|--directory)
                REMOTE_DIR="$2"
                shift 2
                ;;
            --provider)
                CLOUD_PROVIDER="$2"
                shift 2
                ;;
            --region)
                REGION="$2"
                shift 2
                ;;
            --instance-id)
                INSTANCE_ID="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            deploy|check|install|upload|pull|start|stop|restart|status|logs|backup|rollback|update)
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
    echo -e "${CYAN}"
    echo "=========================================="
    echo "  LeetCode Dashboard - Cloud Deploy"
    echo "=========================================="
    echo -e "${NC}"
    
    parse_args "$@"
    
    if [ -z "$COMMAND" ]; then
        show_help
        exit 1
    fi
    
    # 切换到项目根目录
    cd "$(dirname "$0")"
    
    case $COMMAND in
        deploy)
            check_ssh
            check_remote_env
            prepare_remote_dir
            upload_files
            pull_images
            deploy
            health_check
            show_deploy_info
            ;;
        check)
            check_ssh
            check_remote_env
            ;;
        install)
            check_ssh
            install_docker
            ;;
        upload)
            check_ssh
            prepare_remote_dir
            upload_files
            ;;
        pull)
            check_ssh
            pull_images
            ;;
        start)
            check_ssh
            deploy
            ;;
        stop)
            check_ssh
            ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
                "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker-compose -f docker-compose.prod.yml down"
            log_success "Services stopped"
            ;;
        restart)
            check_ssh
            ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
                "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker-compose -f docker-compose.prod.yml restart"
            log_success "Services restarted"
            ;;
        status)
            check_ssh
            show_deploy_info
            ;;
        logs)
            check_ssh
            ssh -i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no \
                "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker-compose -f docker-compose.prod.yml logs -f --tail=100"
            ;;
        backup)
            check_ssh
            backup_data
            ;;
        rollback)
            check_ssh
            rollback
            ;;
        update)
            check_ssh
            pull_images
            deploy
            health_check
            show_deploy_info
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
