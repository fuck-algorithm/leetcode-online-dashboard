# 构建阶段
FROM golang:1.25-alpine AS builder

# 使用国内Go代理
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=off

WORKDIR /app

# 复制依赖文件
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -o dashboard-backend cmd/main.go

# 运行阶段
FROM alpine:latest

# 安装运行时依赖（dl-cdn 在部分网络下不可达，走阿里云镜像）
RUN sed -i 's|https://dl-cdn.alpinelinux.org|https://mirrors.aliyun.com|g' /etc/apk/repositories \
    && apk --no-cache add ca-certificates tzdata

ENV TZ=Asia/Shanghai

WORKDIR /root/

# 从构建阶段复制二进制文件
COPY --from=builder /app/dashboard-backend .

# 题目元数据是启动时的必需文件（config.Load 会按相对路径查找）
COPY --from=builder /app/data/hot100_with_cn.json ./data/hot100_with_cn.json

# 创建数据目录
RUN mkdir -p /data

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# 运行应用
CMD ["./dashboard-backend"]
