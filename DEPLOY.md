# ============================================
# LeetCode Dashboard - 部署文档
# ============================================

## 新架构特性

### 1. 多环境支持
- 开发环境 (development)
- 测试环境 (staging)  
- 生产环境 (production)

### 2. 镜像版本管理
- 基于Git版本自动 tagging
- 支持多平台构建 (amd64/arm64)
- 镜像缓存优化

### 3. 部署方式
- 本地部署
- 远程服务器部署 (SSH)
- 云服务器部署 (阿里云/腾讯云/AWS/GCP)

## 快速开始

### 本地开发部署

```bash
# 使用 start.sh 启动本地开发环境
./start.sh
```

### 生产环境部署

#### 方式1：本地构建并部署

```bash
# 1. 构建镜像
./build-images.sh

# 2. 本地部署
./deploy.sh local
```

#### 方式2：远程服务器部署

```bash
# 配置环境变量
export REMOTE_HOST=your-server-ip
export REMOTE_USER=root
export REMOTE_DIR=/opt/leetcode-dashboard

# 完整部署流程
./deploy.sh -h your-server-ip all
```

#### 方式3：云服务器部署

```bash
# 使用 cloud-deploy.sh 进行云服务器部署
./cloud-deploy.sh -h your-server-ip deploy
```

## 脚本说明

### build-images.sh - 镜像构建脚本

功能：
- 构建所有服务的Docker镜像
- 支持多平台构建
- 镜像标签管理
- 镜像安全扫描 (Trivy)

用法：
```bash
# 构建所有服务
./build-images.sh

# 构建并推送
./build-images.sh --push -r registry.cn-hangzhou.aliyuncs.com

# 只构建后端服务
./build-images.sh -s backend

# 多平台构建
PLATFORM=linux/amd64,linux/arm64 ./build-images.sh
```

### deploy.sh - 部署脚本

功能：
- 本地/远程部署
- 镜像推送
- 部署包准备
- 自动清理

用法：
```bash
# 本地部署
./deploy.sh local

# 远程部署
./deploy.sh -h 192.168.1.100 deploy

# 完整流程（构建+推送+部署）
./deploy.sh -h 192.168.1.100 -r registry.cn-hangzhou.aliyuncs.com all
```

### cloud-deploy.sh - 云服务器部署脚本

功能：
- SSH远程操作
- 环境检查
- Docker安装
- 数据备份/回滚
- 健康检查

用法：
```bash
# 完整部署
./cloud-deploy.sh -h your-server-ip deploy

# 检查环境
./cloud-deploy.sh -h your-server-ip check

# 查看日志
./cloud-deploy.sh -h your-server-ip logs

# 数据备份
./cloud-deploy.sh -h your-server-ip backup

# 回滚部署
./cloud-deploy.sh -h your-server-ip rollback
```

## Docker Compose 配置

### 服务架构

```
┌─────────────────────────────────────────┐
│           LeetCode Dashboard             │
├─────────────────────────────────────────┤
│  Frontend (Nginx)                       │
│  - Port: 52107                          │
│  - Static files serving                 │
├─────────────────────────────────────────┤
│  Backend API (Go/Gin)                   │
│  - Port: 52106                          │
│  - REST API + WebSocket                 │
├─────────────────────────────────────────┤
│  Crawler (Go)                           │
│  - WSS subscription to LeetCode           │
│  - Data persistence                     │
├─────────────────────────────────────────┤
│  Redis (Cache)                          │
│  - Port: 6379 (internal only)           │
│  - Real-time data cache                 │
└─────────────────────────────────────────┘
```

### 配置文件

- `docker-compose.yml` - 开发环境配置
- `docker-compose.prod.yml` - 生产环境配置
- `.env` - 环境变量配置 (从 .env.example 复制)

## 环境变量配置

创建 `.env` 文件：

```bash
cp .env.example .env
```

主要配置项：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| COMPOSE_PROJECT_NAME | 项目名称 | leetcode-dashboard |
| ENVIRONMENT | 部署环境 | production |
| BACKEND_IMAGE | 后端镜像 | leetcode-dashboard-backend:latest |
| CRAWLER_IMAGE | 爬虫镜像 | leetcode-dashboard-crawler:latest |
| FRONTEND_IMAGE | 前端镜像 | leetcode-dashboard-frontend:latest |
| BACKEND_PORT | 后端端口 | 52106 |
| FRONTEND_PORT | 前端端口 | 52107 |
| DATA_DIR | 数据目录 | ./data |
| LOG_LEVEL | 日志级别 | info |
| TZ | 时区 | Asia/Shanghai |

## 镜像仓库配置

### 阿里云容器镜像服务 (ACR)

```bash
# 1. 登录阿里云
docker login --username=your-username registry.cn-hangzhou.aliyuncs.com

# 2. 构建并推送
./build-images.sh --push -r registry.cn-hangzhou.aliyuncs.com -n your-namespace

# 3. 部署时指定镜像地址
export BACKEND_IMAGE=registry.cn-hangzhou.aliyuncs.com/your-namespace/leetcode-dashboard-backend:latest
export CRAWLER_IMAGE=registry.cn-hangzhou.aliyuncs.com/your-namespace/leetcode-dashboard-crawler:latest
export FRONTEND_IMAGE=registry.cn-hangzhou.aliyuncs.com/your-namespace/leetcode-dashboard-frontend:latest
```

### Docker Hub

```bash
# 1. 登录 Docker Hub
docker login

# 2. 构建并推送
REGISTRY=docker.io NAMESPACE=your-username ./build-images.sh --push
```

## 运维操作

### 查看服务状态

```bash
# 本地
docker-compose -f docker-compose.prod.yml ps

# 远程
./cloud-deploy.sh -h your-server-ip status
```

### 查看日志

```bash
# 本地
docker-compose -f docker-compose.prod.yml logs -f

# 远程
./cloud-deploy.sh -h your-server-ip logs
```

### 重启服务

```bash
# 本地
docker-compose -f docker-compose.prod.yml restart

# 远程
./cloud-deploy.sh -h your-server-ip restart
```

### 数据备份

```bash
# 远程备份
./cloud-deploy.sh -h your-server-ip backup
```

### 回滚部署

```bash
# 远程回滚
./cloud-deploy.sh -h your-server-ip rollback
```

## 故障排查

### 服务无法启动

```bash
# 检查日志
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs crawler
docker-compose -f docker-compose.prod.yml logs frontend

# 检查端口占用
lsof -i :52106
lsof -i :52107
lsof -i :6379
```

### 镜像拉取失败

```bash
# 检查镜像仓库登录状态
docker info | grep Username

# 手动拉取镜像测试
docker pull your-registry/leetcode-dashboard-backend:latest
```

### 数据丢失

```bash
# 检查数据卷挂载
docker volume ls
docker inspect leetcode-backend | grep -A 10 Mounts

# 从备份恢复（如果有）
tar xzf backup_YYYYMMDD_HHMMSS/data.tar.gz
```

## CI/CD 集成

### GitHub Actions 示例

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build images
        run: ./build-images.sh
      
      - name: Push images
        env:
          REGISTRY: ${{ secrets.REGISTRY_URL }}
        run: ./build-images.sh --push
      
      - name: Deploy to server
        env:
          REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
          REMOTE_USER: ${{ secrets.REMOTE_USER }}
          SSH_KEY: ${{ secrets.SSH_KEY }}
        run: ./deploy.sh -h $REMOTE_HOST deploy
```

## 安全建议

1. **镜像安全**
   - 定期扫描镜像漏洞
   - 使用最小化基础镜像
   - 及时更新基础镜像版本

2. **访问控制**
   - Redis 不暴露公网端口
   - 使用 SSH 密钥而非密码
   - 限制服务器安全组规则

3. **数据保护**
   - 定期备份数据
   - 敏感信息使用环境变量
   - 避免在镜像中存储密钥

## 性能优化

1. **镜像优化**
   - 使用多阶段构建
   - 合理利用构建缓存
   - 清理不必要的依赖

2. **部署优化**
   - 使用镜像仓库加速拉取
   - 配置健康检查
   - 设置资源限制

3. **运行优化**
   - 启用 Redis 持久化
   - 配置日志轮转
   - 监控资源使用

## 更新日志

### 2024-02-22
- 重构部署架构
- 新增 build-images.sh 脚本
- 新增 cloud-deploy.sh 脚本
- 优化 docker-compose.prod.yml
- 支持多环境部署
- 支持镜像版本管理
