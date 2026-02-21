# LeetCode Hot 100 Dashboard

A real-time dashboard showing online user counts for LeetCode Hot 100 problems.

## Architecture

- **Backend**: Go + Gin + SQLite
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
│   │   └── main.go       # Application entry point
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
└── README.md
```

## Getting Started

### Prerequisites

- Go 1.21+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
go mod download

# Run the server
go run cmd/main.go

# The server will start on port 8080
```

Environment variables:
- `DB_PATH` - Database file path (default: `data/dashboard.db`)
- `PORT` - Server port (default: `8080`)
- `BATCH_SIZE` - WebSocket batch size (default: `10`)
- `INTERVAL_SEC` - Polling interval in seconds (default: `30`)

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# The development server will start on port 3000
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

Access the dashboard at http://localhost:3000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/problems` | All problems with online counts |
| GET | `/api/hot100` | Hot 100 problems with online counts |
| GET | `/api/online-counts/:id` | Online count history for a problem |
| GET | `/api/online-counts/latest` | Latest online counts |

## Features

### Completed (72/101 tasks)

**Core Backend:**
- WebSocket client for LeetCode endpoint
- Background worker for real-time data collection
- SQLite database with GORM
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
