# leetcode-001 单机 Docker 部署

服务器：`103.236.93.62:26934`（root），Ubuntu 22.04，2 vCPU / 3.8 GiB / 30 GiB。
主机名已改为 `leetcode-001`；本机 `/etc/hosts` 有 `103.236.93.62 leetcode-001`，
`~/.ssh/config` 的 `HostName leetcode-001` 走主机名解析，免密钥登录。

**公网入口：<https://leetcode.zhaixingren.cn>**

```bash
leetcode-001                    # 登录（~/.local/bin/leetcode-001 → 仓库根目录脚本）
leetcode-001 status             # compose 状态
leetcode-001 logs backend       # 日志
leetcode-001 deploy             # 重新 up -d
leetcode-001 url                # 打印公网地址并做健康检查
leetcode-001 tunnel             # 本地 18100 → 远端 frontend:8080
```

> 这是 NAT 共享公网 IP 的机器：服务商只把 `26934` 转发到本机 22 端口，
> 其余公网端口（80/8090…）属于同 IP 的其他租户。因此公网入口不在这台机器上，
> 而是借 `aigchub-001`（8.130.35.126，k3s + traefik）做反向隧道。
> 本机调试仍可用 `./leetcode-001.sh tunnel` → <http://127.0.0.1:18100>。

## 拓扑

```
浏览器
  │  https://leetcode.zhaixingren.cn   （*.zhaixingren.cn 泛解析 → 8.130.35.126）
  ▼
aigchub-001: traefik(80/443, TLS 通配证书 zhaixingren-cn-tls)
  │  ingress: leetcode-ingress → Service leetcode-web-edge(80)
  ▼
aigchub-001: 172.22.246.76:18090   ← sshd 反向转发端口
  ▲  ssh -R（leetcode-001 主动发起，systemd: leetcode-tunnel.service）
  │
leetcode-001: 127.0.0.1:8080 frontend(nginx:80)
      ├─ /ws        实时推送
      ├─ /mcp /sse  MCP
      ├─ /api       REST
      └─ 静态文件
backend / crawler → postgres:5432、redis:6379（仅 compose 内网）
```

公网链路（全部在仓库外，改动前先看这里）：

| 位置 | 内容 |
|---|---|
| DNS | `*.zhaixingren.cn` A → `8.130.35.126`（已有泛解析，无需新增记录） |
| aigchub-001 | `/root/k8s/leetcode.yaml`：Service + Endpoints(172.22.246.76:18090) + Ingress + 80→443 跳转 |
| aigchub-001 | TLS secret `zhaixingren-cn-tls`（`*.zhaixingren.cn`，acme.sh 续期） |
| leetcode-001 | `systemctl status leetcode-tunnel`（ssh -R 18090→8080，Restart=always、开机自启） |

隧道断了只需 `systemctl restart leetcode-tunnel`；公网 502 时先查这条链路。

- 目录：`/opt/leetcode-dashboard/docker-compose.yml`、`.env`（600 权限，含随机数据库口令）。
- **数据卷（物理磁盘 bind mount）**：
  - PostgreSQL `/opt/leetcode-dashboard/data/postgres`
  - Redis AOF `/opt/leetcode-dashboard/data/redis`
  - 删除/重建容器不会丢数据；`docker compose down -v` 也不会动这两个目录。
- 端口：`FRONTEND_PORT=8080`（宿主机）→ 容器 80。
- 国际站采集器（`com-collector/`）未部署：本机访问不到 leetcode.com，且需要带 Chromium 的镜像；
  `CRAWL_COM=false`，国际站计数为 0，国内站正常采集。

## 镜像是怎么上去的（不建私服）

单机场景没必要搭 registry：

1. 本地 `docker build` 三个业务镜像；
2. `docker save ... | gzip | ssh leetcode-001 'gunzip | docker load'`；
3. 服务器上 `docker compose up -d`。

服务器访问不了 Docker Hub / GitHub，但基础镜像已随第一次部署一起导入
（`postgres:16-alpine`、`redis:7-alpine`），后续更新只传业务镜像即可：

```bash
deploy/leetcode-001/build-and-upload.sh
```

以后如果有多台机器 / CI 频繁发布，再考虑私有 registry（本机已有 `192.168.1.83:5000`，
但它不在公网，服务器拉不到）。

## 首次部署 / 重建步骤

```bash
# 1. 本地构建 + 上传（含基础镜像，仅首次）
docker save leetcode-dashboard-backend:latest leetcode-dashboard-crawler:latest \
  leetcode-dashboard-frontend:latest postgres:16-alpine redis:7-alpine \
  | gzip -1 | ssh leetcode-001 'gunzip | docker load'

# 2. 同步 compose 与口令
scp deploy/leetcode-001/docker-compose.yml deploy/leetcode-001/.env \
  leetcode-001:/opt/leetcode-dashboard/

# 3. 启动
ssh leetcode-001 'cd /opt/leetcode-dashboard && docker compose up -d'
```

验证：

```bash
curl -s https://leetcode.zhaixingren.cn/api/health   # 公网
curl -s 127.0.0.1:18100/api/health                   # 本地隧道
ssh leetcode-001 'docker exec leetcode-postgres psql -U leetcode_dashboard -d leetcode_dashboard -c "\dt"'
```

MCP 冒烟测试（Streamable HTTP 握手，应返回 200 + `mcp-session-id`）：

```bash
curl -sS -D - -o /dev/null -X POST https://leetcode.zhaixingren.cn/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}' \
  | grep -i mcp-session

curl -s https://leetcode.zhaixingren.cn/mcp/manifest | python3 -m json.tool   # 工具清单
```

## Redis 高并发

高频 GET 接口（`/api/hot100`、`/api/problems`…）走 Redis 响应缓存 + Redis
滑动窗口限流，crawler 每 ~30s 刷新一轮数据，缓存 TTL 与之一致：

- `API_CACHE_TTL_SECONDS=30`（默认）——命中 `X-Cache: HIT`，miss 才回源；
  Redis 不可用时自动降级到进程内缓存。
- `RATE_LIMIT_PER_MINUTE=300`（默认）——每 IP 每分钟回源请求数；缓存命中
  不消耗配额（高并发读靠缓存扛，不占限流），超限返回
  `429 {"code":429,"message":"请求过于频繁，请稍后再试"}` + `X-RateLimit-Limit`。
  限流用 Lua 滑动窗口（ZSET），Redis 故障降级为内存限流。
- `REDIS_POOL_SIZE=20`——连接池常驻 `pool/4` 空闲连接，突发不卡建立连接。

对应环境变量已在 `docker-compose.yml` 的 `x-backend-env` 配置。压测参考：
`ab -n 500 -c 50 -H 'Cache-Control: no-cache' .../api/hot100`——冷启动少量 429
属预期（触发回源限流），随后全部 `X-Cache: HIT`，吞吐数千 req/s。

## 运维

```bash
./leetcode-001.sh url                 # 公网入口健康检查
./leetcode-001.sh status              # 服务状态
./leetcode-001.sh logs backend        # 日志
./leetcode-001.sh deploy              # 重新 up -d
ssh leetcode-001 systemctl status leetcode-tunnel        # 反向隧道
ssh leetcode-001 'docker exec leetcode-postgres pg_dump -U leetcode_dashboard leetcode_dashboard' | gzip > backup.sql.gz
```

`build-and-upload.sh` 只更新业务镜像；改完 compose 里前端健康检查等配置后需要
`docker compose up -d --force-recreate <服务>`。

## 已知限制

- 公网入口依赖 `aigchub-001`：反向隧道或该机 traefik 故障时站点不可达（隧道已设开机自启与自动重连）。
- 服务端访问不了 GitHub / Docker Hub / leetcode.com，只有国内站点可达。
- `PasswordAuthentication` 仍开启，建议后续确认密钥稳定后关闭。
