FROM nginx:alpine

# 复制前端静态文件
COPY --from=frontend /usr/share/nginx/html /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
