#!/bin/bash

# LeetCode Dashboard Startup Script
# Starts crawler (WSS subscription), backend API, and frontend services in background

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load database/Redis endpoints (K8s PostgreSQL + Redis) and other settings.
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$PROJECT_ROOT/.env"
    set +a
fi

# Configuration
CRAWLER_LOG="$PROJECT_ROOT/backend/crawler.log"
BACKEND_LOG="$PROJECT_ROOT/backend/backend.log"
FRONTEND_LOG="$PROJECT_ROOT/frontend/frontend.log"
BACKEND_PORT=52106
FRONTEND_PORT=52107

# Function to kill process by port
kill_by_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "Killing processes on port $port: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Function to kill process by name pattern
kill_by_pattern() {
    local pattern=$1
    local pids=$(pgrep -f "$pattern" 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "Killing processes matching '$pattern': $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

echo "=========================================="
echo "LeetCode Dashboard - Starting Services"
echo "=========================================="

# Step 1: Kill existing processes
echo ""
echo "[1/4] Stopping existing services..."
kill_by_port $BACKEND_PORT
kill_by_port $FRONTEND_PORT
kill_by_pattern "leetcode-dashboard"
kill_by_pattern "leetcode-crawler"
kill_by_pattern "pm2" && pm2 delete leetcode-dashboard-frontend 2>/dev/null || true
sleep 2

# Step 2: Build services
echo ""
echo "[2/4] Building services..."
cd "$PROJECT_ROOT/backend"
if [ ! -f go.mod ]; then
    echo "Error: go.mod not found in backend directory"
    exit 1
fi
go mod download 2>/dev/null || true

# Build crawler
go build -o leetcode-crawler cmd/crawler/main.go
if [ $? -ne 0 ]; then
    echo "Error: Crawler build failed"
    exit 1
fi
echo "Crawler built successfully"

# Build backend
go build -o leetcode-dashboard cmd/main.go
if [ $? -ne 0 ]; then
    echo "Error: Backend build failed"
    exit 1
fi
echo "Backend built successfully"

# Step 3: Start crawler (WSS subscription service)
echo ""
echo "[3/4] Starting crawler (WSS subscription to LeetCode)..."
cd "$PROJECT_ROOT/backend"
nohup ./leetcode-crawler > "$CRAWLER_LOG" 2>&1 &
CRAWLER_PID=$!
echo "Crawler started with PID: $CRAWLER_PID"

# Wait for crawler to initialize
sleep 2

# Check if crawler is running
if ! kill -0 $CRAWLER_PID 2>/dev/null; then
    echo "Error: Crawler failed to start. Check $CRAWLER_LOG"
    exit 1
fi
echo "Crawler is ready (subscribing to LeetCode online counts)!"

# Step 4: Start backend API and frontend
echo ""
echo "[4/4] Starting backend API and frontend..."

# Install frontend dependencies
cd "$PROJECT_ROOT/frontend"
npm install 2>/dev/null || true

# Start backend
cd "$PROJECT_ROOT/backend"
nohup ./leetcode-dashboard > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID on port $BACKEND_PORT"

# Wait for backend to initialize
sleep 2

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Error: Backend failed to start. Check $BACKEND_LOG"
    exit 1
fi

# Start frontend using PM2 for process management
echo "Building frontend and starting with PM2..."
cd "$PROJECT_ROOT/frontend"

# Build for production
npm run build 2>&1 | tail -5

# Check if dist folder exists and serve it with PM2
if [ -d "dist" ]; then
    # Stop existing PM2 process if exists
    pm2 delete leetcode-dashboard-frontend 2>/dev/null || true
    
    # Start with PM2 using config file
    pm2 start pm2.config.cjs
    
    echo "Frontend started with PM2 (process name: leetcode-dashboard-frontend)"
    FRONTEND_MODE="production+pm2"
else
    echo "Warning: dist folder not found, falling back to Vite dev mode"
    nohup npx vite --host --port $FRONTEND_PORT > "$FRONTEND_LOG" 2>&1 < /dev/null &
    disown 2>/dev/null || true
    FRONTEND_PID=$!
    echo "Frontend (dev) started with PID: $FRONTEND_PID on port $FRONTEND_PORT"
    FRONTEND_MODE="dev"
fi

# Wait for frontend to initialize
sleep 3

# Check if frontend is running (PM2 or direct)
if [ -d "dist" ]; then
    # Check PM2 status
    if ! pm2 describe leetcode-dashboard-frontend >/dev/null 2>&1; then
        echo "Error: Frontend PM2 process failed to start. Check pm2 logs"
        exit 1
    fi
else
    # Check direct process
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "Error: Frontend failed to start. Check $FRONTEND_LOG"
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "Services Started Successfully!"
echo "=========================================="
echo "Crawler:  WSS subscription to LeetCode (100 problems online count)"
echo "Backend:  http://localhost:$BACKEND_PORT (API + WebSocket)"
echo "Frontend: http://localhost:$FRONTEND_PORT (mode: $FRONTEND_MODE)"
echo ""
echo "Logs:"
echo "  Crawler:  $CRAWLER_LOG"
echo "  Backend:  $BACKEND_LOG"
echo "  Frontend: $FRONTEND_LOG"
echo ""
echo "To stop services, run:"
echo "  pgrep -f leetcode-crawler | xargs kill -9"
echo "  lsof -ti:$BACKEND_PORT | xargs kill -9"
echo "  pm2 delete leetcode-dashboard-frontend"
echo ""
echo "To check PM2 status:"
echo "  pm2 status"
echo "  pm2 logs leetcode-dashboard-frontend"
echo ""
echo "Script completed. All services running in background."
echo ""

# Script exits here, services continue running in background
exit 0
