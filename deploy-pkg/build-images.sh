#!/bin/bash
# ============================================
# LeetCode Dashboard - Build Images Script
# ============================================
# 功能：构建所有服务的Docker镜像
# 支持：多平台构建 (linux/amd64, linux/arm64)
# 支持：镜像标签管理、缓存优化

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
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "latest")
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 构建配置
PLATFORM="${PLATFORM:-linux/amd64}"
PUSH="${PUSH:-false}"
CACHE="${CACHE:-true}"
COMPRESS="${COMPRESS:-true}"

# 镜像仓库
REGISTRY="${REGISTRY:-}"
NAMESPACE="${NAMESPACE:-leetcode}"

# 服务列表（使用普通数组，格式：服务名:Dockerfile路径:构建上下文）
SERVICES=(
    "backend:backend/Dockerfile:backend"
    "crawler:backend/Dockerfile.crawler:backend"
    "frontend:frontend/Dockerfile:frontend"
)

# 获取服务配置
get_service_config() {
    local service=$1
    local field=$2  # 1=name, 2=dockerfile, 3=context
    for svc in "${SERVICES[@]}"; do
        local name=$(echo "$svc" | cut -d: -f1)
        if [ "$name" = "$service" ]; then
            echo "$svc" | cut -d: -f$field
            return 0
        fi
    done
    return 1
}

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

# 检查Docker环境
check_docker() {
    log_step "Checking Docker environment..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # 检查Docker是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # 检查Buildx（用于多平台构建）
    if ! docker buildx version &> /dev/null; then
        log_warning "Docker Buildx not available. Multi-platform builds disabled."
        BUILDX_AVAILABLE=false
    else
        BUILDX_AVAILABLE=true
        # 确保buildx实例存在
        docker buildx inspect --bootstrap &> /dev/null || {
            log_info "Creating buildx builder instance..."
            docker buildx create --use --name multiplatform-builder --driver docker-container || true
        }
    fi
    
    log_success "Docker environment OK"
}

# 生成镜像标签
get_image_tags() {
    local service=$1
    local image_name="${PROJECT_NAME}-${service}"
    
    if [ -n "$REGISTRY" ]; then
        image_name="${REGISTRY}/${NAMESPACE}/${image_name}"
    fi
    
    echo "${image_name}"
}

# 构建单个服务
build_service() {
    local service=$1
    local dockerfile=$(get_service_config "$service" 2)
    local context=$(get_service_config "$service" 3)
    
    log_step "Building ${service}..."
    
    local image_name=$(get_image_tags "$service")
    local tags=()
    
    # 准备标签
    tags+=("-t" "${image_name}:${VERSION}")
    tags+=("-t" "${image_name}:latest")
    tags+=("-t" "${image_name}:${COMMIT_SHA}")
    
    # 构建参数
    local build_args=(
        "--build-arg" "VERSION=${VERSION}"
        "--build-arg" "BUILD_TIME=${BUILD_TIME}"
        "--build-arg" "COMMIT_SHA=${COMMIT_SHA}"
        "--build-arg " "PROJECT_NAME=${PROJECT_NAME}"
    )
    
    # 缓存配置
    if [ "$CACHE" = "true" ]; then
        build_args+=("--cache-from" "type=local,src=/tmp/.buildx-cache-${service}")
        build_args+=("--cache-to" "type=local,dest=/tmp/.buildx-cache-${service},mode=max")
    else
        build_args+=("--no-cache")
    fi
    
    # 压缩配置
    if [ "$COMPRESS" = "true" ]; then
        build_args+=("--squash")
    fi
    
    # 构建命令
    if [ "$BUILDX_AVAILABLE" = "true" ] && [ "$PUSH" = "true" ]; then
        # 使用Buildx进行多平台构建并推送
        log_info "Building ${service} with Buildx (platform: ${PLATFORM})..."
        docker buildx build \
            --platform "${PLATFORM}" \
            "${build_args[@]}" \
            "${tags[@]}" \
            -f "${dockerfile}" \
            --push \
            "${context}"
    else
        # 普通构建
        log_info "Building ${service} (platform: ${PLATFORM})..."
        docker build \
            "${build_args[@]}" \
            "${tags[@]}" \
            -f "${dockerfile}" \
            "${context}"
        
        # 单独推送
        if [ "$PUSH" = "true" ]; then
            log_info "Pushing ${service} images..."
            docker push "${image_name}:${VERSION}"
            docker push "${image_name}:latest"
            docker push "${image_name}:${COMMIT_SHA}"
        fi
    fi
    
    if [ $? -eq 0 ]; then
        log_success "${service} built successfully"
        
        # 显示镜像信息
        local image_size=$(docker images "${image_name}:${VERSION}" --format "{{.Size}}")
        log_info "  Image: ${image_name}:${VERSION}"
        log_info "  Size: ${image_size}"
    else
        log_error "Failed to build ${service}"
        exit 1
    fi
}

# 构建所有服务
build_all() {
    log_step "Starting build process..."
    log_info "Version: ${VERSION}"
    log_info "Commit: ${COMMIT_SHA}"
    log_info "Build Time: ${BUILD_TIME}"
    log_info "Platform: ${PLATFORM}"
    log_info "Push: ${PUSH}"
    
    if [ -n "$SINGLE_SERVICE" ]; then
        # 只构建单个服务
        log_info "Building single service: ${SINGLE_SERVICE}"
        build_service "$SINGLE_SERVICE"
    else
        # 构建所有服务
        log_info "Building all services"
        for svc in "${SERVICES[@]}"; do
            local service=$(echo "$svc" | cut -d: -f1)
            build_service "$service"
            echo ""
        done
    fi
    
    log_success "Build completed successfully!"
}

# 验证镜像
verify_images() {
    log_step "Verifying built images..."
    
    for svc in "${SERVICES[@]}"; do
        local service=$(echo "$svc" | cut -d: -f1)
        local image_name=$(get_image_tags "$service")
        
        if ! docker images | grep -q "${image_name}"; then
            log_error "Image not found: ${image_name}"
            exit 1
        fi
        
        # 运行镜像安全扫描（如果安装了trivy）
        if command -v trivy &> /dev/null; then
            log_info "Scanning ${service} for vulnerabilities..."
            trivy image --severity HIGH,CRITICAL --no-progress \
                "${image_name}:${VERSION}" 2>/dev/null || true
        fi
    done
    
    log_success "All images verified"
}

# 显示镜像摘要
show_summary() {
    log_step "Build Summary"
    echo "========================================"
    
    for svc in "${SERVICES[@]}"; do
        local service=$(echo "$svc" | cut -d: -f1)
        local image_name=$(get_image_tags "$service")
        local image_id=$(docker images "${image_name}:${VERSION}" --format "{{.ID}}")
        local image_size=$(docker images "${image_name}:${VERSION}" --format "{{.Size}}")
        local created=$(docker images "${image_name}:${VERSION}" --format "{{.CreatedAt}}")
        
        echo ""
        echo "Service: ${service}"
        echo "  Image: ${image_name}:${VERSION}"
        echo "  Image ID: ${image_id}"
        echo "  Size: ${image_size}"
        echo "  Created: ${created}"
    done
    
    echo ""
    echo "========================================"
    log_success "Build completed at $(date)"
    
    # 输出下一步提示
    if [ "$PUSH" = "false" ]; then
        echo ""
        log_info "To push images to registry, run:"
        log_info "  PUSH=true $0"
    fi
}

# 清理旧镜像
cleanup_old_images() {
    log_step "Cleaning up old images..."
    
    for svc in "${SERVICES[@]}"; do
        local service=$(echo "$svc" | cut -d: -f1)
        local image_name=$(get_image_tags "$service")
        
        # 删除 dangling 镜像
        docker images -f "dangling=true" "${image_name}" -q | \
            xargs -r docker rmi -f 2>/dev/null || true
        
        # 保留最近3个版本，删除其他
        docker images "${image_name}" --format "{{.Tag}}" | \
            grep -v "latest\|${VERSION}\|${COMMIT_SHA}" | \
            sort -r | \
            tail -n +4 | \
            xargs -I {} docker rmi "${image_name}:{}" 2>/dev/null || true
    done
    
    # 清理未使用的构建缓存
    docker builder prune -f --filter "unused-for=24h" &> /dev/null || true
    
    log_success "Cleanup completed"
}

# 保存镜像到文件
save_images() {
    local output_dir="${1:-./dist}"
    mkdir -p "$output_dir"
    
    log_step "Saving images to ${output_dir}..."
    
    for svc in "${SERVICES[@]}"; do
        local service=$(echo "$svc" | cut -d: -f1)
        local image_name=$(get_image_tags "$service")
        local output_file="${output_dir}/${PROJECT_NAME}-${service}-${VERSION}.tar"
        
        log_info "Saving ${service}..."
        docker save "${image_name}:${VERSION}" -o "$output_file"
        
        # 压缩
        gzip -f "$output_file"
        log_success "${service} saved to ${output_file}.gz"
    done
}

# 加载镜像
load_images() {
    local input_dir="${1:-./dist}"
    
    log_step "Loading images from ${input_dir}..."
    
    for file in "${input_dir}"/*.tar.gz; do
        if [ -f "$file" ]; then
            log_info "Loading $(basename $file)..."
            gunzip -c "$file" | docker load
        fi
    done
    
    log_success "Images loaded"
}

# 显示帮助
show_help() {
    cat << EOF
Usage: $0 [OPTIONS] [COMMAND]

Commands:
    build       构建所有服务的镜像 [默认]
    verify      验证构建的镜像
    save        保存镜像到文件
    load        从文件加载镜像
    cleanup     清理旧镜像
    all         完整流程：构建+验证+清理

Options:
    -p, --platform      目标平台 [默认: linux/amd64]
                        可选: linux/amd64, linux/arm64, linux/amd64,linux/arm64
    --push              构建后推送镜像到仓库
    --no-cache          禁用构建缓存
    --no-compress       禁用镜像压缩
    -r, --registry      镜像仓库地址
    -n, --namespace     镜像仓库命名空间 [默认: leetcode]
    -o, --output        镜像保存目录 [默认: ./dist]
    -s, --service       只构建指定服务 (backend|crawler|frontend)
    --help              显示帮助信息

Environment Variables:
    REGISTRY            镜像仓库地址
    NAMESPACE           镜像仓库命名空间
    PLATFORM            目标平台
    PUSH                是否推送 (true/false)
    CACHE               是否使用缓存 (true/false)

Examples:
    # 构建所有服务
    $0

    # 构建并推送
    $0 --push -r registry.cn-hangzhou.aliyuncs.com

    # 多平台构建并推送
    PLATFORM=linux/amd64,linux/arm64 PUSH=true $0

    # 只构建后端服务
    $0 -s backend

    # 保存镜像到文件
    $0 save -o ./images

    # 加载镜像
    $0 load -o ./images
EOF
}

# 解析参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--platform)
                PLATFORM="$2"
                shift 2
                ;;
            --push)
                PUSH="true"
                shift
                ;;
            --no-cache)
                CACHE="false"
                shift
                ;;
            --no-compress)
                COMPRESS="false"
                shift
                ;;
            -r|--registry)
                REGISTRY="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -o|--output)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            -s|--service)
                SINGLE_SERVICE="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            build|verify|save|load|cleanup|all)
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
    echo "  LeetCode Dashboard - Image Builder"
    echo "=========================================="
    echo -e "${NC}"
    
    COMMAND="build"
    parse_args "$@"
    
    # 如果只构建单个服务，检查服务是否存在
    if [ -n "$SINGLE_SERVICE" ]; then
        local found=false
        for svc in "${SERVICES[@]}"; do
            local name=$(echo "$svc" | cut -d: -f1)
            if [ "$name" = "$SINGLE_SERVICE" ]; then
                found=true
                break
            fi
        done
        
        if [ "$found" = "false" ]; then
            log_error "Unknown service: $SINGLE_SERVICE"
            log_info "Available services: backend, crawler, frontend"
            exit 1
        fi
    fi
    
    # 切换到项目根目录
    cd "$(dirname "$0")"
    
    case $COMMAND in
        build)
            check_docker
            build_all
            verify_images
            show_summary
            ;;
        verify)
            verify_images
            ;;
        save)
            save_images "${OUTPUT_DIR:-./dist}"
            ;;
        load)
            load_images "${OUTPUT_DIR:-./dist}"
            ;;
        cleanup)
            cleanup_old_images
            ;;
        all)
            check_docker
            build_all
            verify_images
            cleanup_old_images
            show_summary
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
