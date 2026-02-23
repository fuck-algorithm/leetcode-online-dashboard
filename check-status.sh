#!/bin/bash
# 快速检查部署状态
ssh -i ~/.ssh/id_ed25519 -p 22 root@YOUR_SERVER_IP "
echo '=== 部署状态检查 ==='
date
echo ''
echo '容器状态:'
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'leetcode|redis'
echo ''
echo '健康检查:'
curl -s http://localhost:52106/api/health 2>&1 || echo '后端未就绪'
echo ''
echo 'Redis安全配置:'
grep -E '^bind|^protected-mode' /opt/leetcode-dashboard/redis/redis.conf 2>/dev/null || echo 'Redis配置未找到'
"
