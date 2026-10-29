#!/usr/bin/env bash
# leetcode-001 快捷登录 / 运维脚本
#
# 依赖 ~/.ssh/config 里的 Host leetcode-001（已配置免密登录），
# 所以本脚本不保存任何密码。
#
# 用法：
#   ./leetcode-001.sh                 进入交互式 shell
#   ./leetcode-001.sh 'docker ps'     在服务器上执行命令
#   ./leetcode-001.sh status          查看 compose 服务状态
#   ./leetcode-001.sh logs [服务名]   跟踪日志
#   ./leetcode-001.sh deploy          重新拉起 /opt/leetcode-dashboard
#   ./leetcode-001.sh tunnel [端口]   把远端 8080 映射到本地（默认 18100）
#   ./leetcode-001.sh url             打印公网地址并做健康检查
set -euo pipefail

REMOTE_DIR=/opt/leetcode-dashboard
PUBLIC_URL=https://leetcode.zhaixingren.cn

case "${1:-}" in
  url|check)
    echo "公网入口: ${PUBLIC_URL}"
    echo -n "首页:   "; curl -s -o /dev/null -m 10 -w '%{http_code}\n' "${PUBLIC_URL}/"
    echo -n "健康:   "; curl -s -m 10 "${PUBLIC_URL}/api/health"; echo
    ;;
  tunnel)
    shift
    LOCAL_PORT="${1:-18100}"
    echo "打开 http://127.0.0.1:${LOCAL_PORT} （Ctrl+C 结束）"
    exec ssh -N -o ExitOnForwardFailure=yes -L "127.0.0.1:${LOCAL_PORT}:127.0.0.1:8080" leetcode-001
    ;;
  status)
    exec ssh -t leetcode-001 "cd ${REMOTE_DIR} && docker compose ps && echo --- && docker compose images"
    ;;
  logs)
    shift
    exec ssh -t leetcode-001 "cd ${REMOTE_DIR} && docker compose logs -f --tail=100 $*"
    ;;
  deploy)
    shift
    exec ssh -t leetcode-001 "cd ${REMOTE_DIR} && docker compose up -d --remove-orphans $*"
    ;;
  *)
    exec ssh -t leetcode-001 "$@"
    ;;
esac
