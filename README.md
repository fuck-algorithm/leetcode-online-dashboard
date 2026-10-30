# LeetCode Hot 100 Dashboard

A real-time dashboard showing online user counts for LeetCode Hot 100 problems.

## Architecture

- **Backend**: Go + Gin + GORM (PostgreSQL)
- **Frontend**: TypeScript + React + Ant Design + Vite
- **WebSocket**: Real-time data from LeetCode collaboration service

## WebSocket Endpoint Research

Based on analysis of LeetCode China's WebSocket endpoint:

- **URL**: `wss://collaboration-ws.leetcode.cn/problems/{problem-slug}`
- **Headers Required**:
  - `Origin: https://leetcode.cn`
  - `Upgrade: websocket`
  - `Connection: Upgrade`
  - `Sec-WebSocket-Key: {base64-key}`
  - `Sec-WebSocket-Version: 13`

- **Message Format**: JSON with online count updates
- **Example Response**: Shows real-time count like "42 人在线" (42 people online)

## Project Structure

```
.
├── backend/               # Go backend API
│   ├── cmd/
│   │   ├── main.go       # API server entry point
│   │   └── crawler/      # CN WebSocket crawler
│   ├── internal/
│   │   ├── config/       # Configuration management
│   │   ├── database/     # Database connection & migrations
│   │   ├── handlers/     # HTTP API handlers
│   │   ├── models/       # Data models
│   │   ├── websocket/    # WebSocket client for LeetCode
│   │   └── worker/       # Background worker
│   ├── go.mod
│   └── go.sum
├── frontend/              # React frontend
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── components/   # React components
│   │   ├── types/        # TypeScript types
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── index.html
├── com-collector/         # headed Chromium collector for leetcode.com
│   ├── collector.js
│   └── start-com-collector.sh
├── deploy/leetcode-001/   # single-host Docker deployment (compose + upload script)
├── leetcode-001.sh        # SSH / ops helper for the deployment server
└── README.md
```

## Getting Started

### Prerequisites

- Go 1.25+
- Node.js 18+
- npm or yarn
- PostgreSQL (K8s `database` namespace, NodePort `local-server-001:30432`)
- Redis (K8s `database` namespace, NodePort `local-server-001:30379`)

### Backend Setup

```bash
cd backend

# Install dependencies
go mod download

# Run the server
go run cmd/main.go

# The server will start on port 52106
```

Environment variables (a `.env` in the repo root is loaded automatically;
real environment variables take precedence):
- `DB_HOST` / `DB_PORT` - PostgreSQL host and port (default: `localhost:5432`)
- `DB_USER` / `DB_PASSWORD` / `DB_NAME` - PostgreSQL credentials and database
- `DB_SSLMODE` - PostgreSQL SSL mode (default: `disable`)
- `DB_TIMEZONE` - session time zone (default: `Asia/Shanghai`)
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` - Redis endpoint
- `REDIS_DB` - Redis logical database (default: `0`)
- `REDIS_KEY_PREFIX` - namespace for every Redis key and pub/sub channel (default: `leetcode-dashboard:`)
- `PORT` - HTTP server port (default: `52106`)
- `BATCH_SIZE` - WebSocket batch size (default: `10`)
- `INTERVAL_SEC` - Polling interval in seconds (default: `30`)
- `CRAWL_COM` - let the Go crawler connect to leetcode.com directly (default: `false`; see below)
- `COM_BATCH_SIZE` - browser collector pages per browser instance (default: `10`)
- `COM_ATTEMPT_MS` - time budget for one page attempt (default: `12000`)
- `COM_ATTEMPTS_PER_SLUG` - attempts per problem before giving up for this round (default: `4`)
- `COM_CYCLE_PAUSE_MS` - pause between browser batches (default: `3000`)
- `COM_ONLY_SLUGS` - comma-separated slugs to collect (default: all 100; totals still cover all problems)
- `COM_ONCE` - run a single cycle and exit (default: `false`)

For the shared K8s services use `local-server-001:30432` (PostgreSQL) and
`local-server-001:30379` (Redis); inside the cluster use
`postgres.database.svc.cluster.local:5432` and
`redis.database.svc.cluster.local:6379`.

### Redis key namespace

The dashboard shares one Redis instance with other applications, so every key
and pub/sub channel is prefixed with `REDIS_KEY_PREFIX` (default
`leetcode-dashboard:`). The layout is:

```
leetcode-dashboard:online:unified:{slug}
leetcode-dashboard:online:cn:{slug}
leetcode-dashboard:online:com:{slug}
leetcode-dashboard:total:online[:cn|:com|:unified]
leetcode-dashboard:hot100:list
leetcode-dashboard:updates        # pub/sub channel
leetcode-dashboard:api-cache:...  # sha256(path?query) → JSON response (TTL 30s)
leetcode-dashboard:ratelimit:{ip} # sliding-window ZSET per client IP
```

Set `REDIS_KEY_PREFIX` per deployment if multiple dashboards share the same
Redis instance, and `REDIS_DB` to isolate data in a separate logical database
(default `0`).

### Redis-backed caching & rate limiting

High-frequency GET endpoints (`/api/hot100`, `/api/problems`, …) are served
through a Redis response cache plus a Redis sliding-window rate limiter, so the
deployment can absorb a large read burst while the crawler refreshes data every
~30 seconds:

- **Response cache** — key `api-cache:<sha256(path?query)>`, TTL
  `API_CACHE_TTL_SECONDS` (default `30`, matching the data refresh cadence).
  A cache hit returns immediately with `X-Cache: HIT`; on a miss the handler
  re-reads from Redis/PostgreSQL and stores the body. If Redis is unavailable
  it transparently falls back to the in-process cache.
- **Rate limiting** — Lua script sliding window (ZSET) per client IP:
  `RATE_LIMIT_PER_MINUTE` (default `300`) backwards origin requests per IP per
  minute. Cache hits do **not** consume quota — only requests that actually
  reach the data source do, so read-heavy bursts are absorbed by the cache.
  Over-limit responses return `HTTP 429`
  `{"code":429,"message":"请求过于频繁，请稍后再试",…}` with
  `X-RateLimit-Limit`. Redis failures fall back to in-memory limiting.
- **Connection pool** — `REDIS_POOL_SIZE` (default `20`), keeps `pool/4`
  minimum idle connections, so concurrent bursts do not stall on connect.

Related env vars: `REDIS_POOL_SIZE`, `API_CACHE_TTL_SECONDS`,
`RATE_LIMIT_PER_MINUTE` (see `.env.example`).

### leetcode.com collector (COM site)

`wss://collaboration-ws.leetcode.com/problems/{slug}` is behind Cloudflare and
answers plain WebSocket clients with `403` + `cf-mitigated: challenge`. The Go
crawler therefore only subscribes to the CN socket by default (`CRAWL_COM=false`).

The `com-collector/` process opens the problem pages in a real headed Chromium,
watches the page's own WebSocket frames, and writes the numeric counts to the
same Redis keys the dashboard already uses. The Go worker then persists them to
`online_counts_com` / `online_counts_unified` and broadcasts them to the UI.
Cloudflare only lets a fraction of page loads through, so the collector retries
each problem and processes missing/oldest keys first.

```bash
cd com-collector
npm install          # playwright + redis
./start-com-collector.sh
```

`start-com-collector.sh` uses `xvfb-run` when `DISPLAY` is unset. Requirements:
Node.js 18+, Playwright's Chromium (`npx playwright install chromium`), and Xvfb
on headless servers. Logs go to stdout; run it under `nohup`/systemd in
production.

```bash
# background run
setsid nohup ./com-collector/start-com-collector.sh >> /tmp/com-collector.log 2>&1 &

# one-shot fill of specific problems (e.g. keys Cloudflare kept rejecting)
cd com-collector
COM_ONLY_SLUGS=reverse-linked-list,n-queens COM_ONCE=true COM_ATTEMPTS_PER_SLUG=8 \
  xvfb-run -a -s '-screen 0 1280x800x24 -extension GLX' node collector.js
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# The development server will start on port 52107
```

### Running Both Services

```bash
# Terminal 1 - Backend
cd backend
go run cmd/main.go

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Access the dashboard at http://localhost:52107

## Docker Deployment

**Public URL: <https://leetcode.zhaixingren.cn>**

The whole stack (PostgreSQL + Redis + backend + crawler + nginx frontend) runs
from one compose file; PostgreSQL and Redis data live on the host disk through
bind mounts, so container rebuilds never lose data.

The server sits behind carrier NAT (only SSH port 22 is forwarded), so public
HTTP is served from a second host: a reverse SSH tunnel from `leetcode-001` to
`aigchub-001:18090`, exposed by that machine's k3s/traefik ingress under the
`*.zhaixingren.cn` wildcard certificate. The tunnel is a systemd unit
(`leetcode-tunnel`) and reconnects automatically.

```bash
./leetcode-001.sh                  # SSH into the server (key auth, alias in ~/.ssh/config)
./leetcode-001.sh url              # public URL health check
./leetcode-001.sh status           # compose status
./leetcode-001.sh logs backend     # follow logs
./leetcode-001.sh tunnel           # http://127.0.0.1:18100 via SSH tunnel

deploy/leetcode-001/deploy-online.sh      # one-shot deploy: build → upload → up → verify public URL
deploy/leetcode-001/deploy-online.sh --skip-build  # redeploy with existing local images
```

Images are transferred with `docker save | gzip | ssh 'gunzip | docker load'`
instead of a private registry — a single host does not need one. Full details,
topology and first-deploy steps: [`deploy/leetcode-001/README.md`](deploy/leetcode-001/README.md).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/problems` | All problems with online counts |
| GET | `/api/hot100` | Hot 100 problems with online counts |
| GET | `/api/online-counts/:id` | Online count history for a problem |
| GET | `/api/online-counts/latest` | Latest online counts |
| GET | `/api/statistics` | Statistics & peak time analysis |
| GET | `/api/peaks` | Peak online time detection |
| GET | `/api/export/:format` | Data export (CSV/JSON) |
| WS | `/ws` | Real-time online count push |

Responses are wrapped as `{"code":200,"msg":"success","data":…}` on success and
`{"code":<http-status>,"error":…}` on failure.

## MCP — Model Context Protocol

The dashboard exposes 4 read-only tools through the standard MCP protocol, so AI
clients (Claude Desktop, Cursor, Cherry Studio, Cline, …) can query LeetCode Hot
100 data directly.

| Transport | Endpoint | Notes |
|-----------|----------|-------|
| Streamable HTTP (modern) | `POST /mcp` | JSON-RPC, session via `Mcp-Session-Id`, returns `mcp-session-id` |
| SSE (legacy) | `GET /mcp/sse` | event stream; message endpoint `POST /mcp/message` |
| SSE alias | `GET /sse` | older alias, same handler as `/mcp/sse` |
| Tool manifest | `GET /mcp/manifest` | human-readable JSON listing of tools |

Client configuration (Streamable HTTP):

```json
{
  "mcpServers": {
    "leetcode-dashboard": {
      "type": "streamable-http",
      "url": "https://leetcode.zhaixingren.cn/mcp"
    }
  }
}
```

Legacy SSE client configuration: `url: https://leetcode.zhaixingren.cn/mcp/sse`.

All tools are annotated `readOnlyHint=true`, `destructiveHint=false`,
`idempotentHint=true`, so clients treat them as safe query-only calls.

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_hot100_problems` | Full Hot 100 list (metadata + CN/COM/total online counts) | none |
| `get_hot100_online_count` | Latest online counts for Hot 100 | none |
| `get_problem_online_count` | Latest online count for one problem | `problem_id` (number or slug) |
| `get_problem_history` | Historical online counts for one problem | `problem_id`, `limit` (default 100) |

Tool results use the same `code/msg/data` envelope as the REST API. The full
interactive guide lives in the web UI's **MCP** page. Health check example:

```bash
curl -X POST https://leetcode.zhaixingren.cn/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'
```

## Features

### Completed (72/101 tasks)

**Core Backend:**
- WebSocket client for LeetCode endpoint
- Background worker for real-time data collection
- PostgreSQL database with GORM
- RESTful API with Gin
- Graceful shutdown
- CORS support
- Error handling & recovery
- Configuration management

**Core Frontend:**
- React + TypeScript + Vite
- Ant Design UI components
- Real-time dashboard
- Statistics cards
- Problem table with sorting & filtering
- Search functionality
- Responsive design
- Loading states & error handling

**Data & Visualization:**
- Hot 100 problem list
- Online count tracking
- Difficulty badges
- Acceptance rate display
- Problem links to LeetCode

## WebSocket Message Format

Based on research, the LeetCode WebSocket sends messages in this format:

```json
{
  "type": "collaboration_count",
  "count": 42,
  "problem": "next-permutation"
}
```

## Database Schema

- **problems**: Problem metadata (slug, title, difficulty, etc.)
- **online_counts**: Historical online user counts with timestamps
- **hot100**: LeetCode Hot 100 ranking

## Performance Considerations

- **Batch Processing**: WebSocket connections batched (10 at a time)
- **Connection Reconnection**: Automatic with exponential backoff
- **Database Queries**: Indexed for fast lookups
- **Frontend**: Auto-refresh every 30 seconds

## License

MIT License
