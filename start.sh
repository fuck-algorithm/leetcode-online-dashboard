#!/bin/bash

# LeetCode Dashboard Startup Script
# Starts both backend and frontend services in background

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
BACKEND_PORT=52106
FRONTEND_PORT=52107
BACKEND_LOG="$PROJECT_ROOT/backend/backend.log"
FRONTEND_LOG="$PROJECT_ROOT/frontend/frontend.log"

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
echo "[1/3] Stopping existing services..."
kill_by_port $BACKEND_PORT
kill_by_port $FRONTEND_PORT
kill_by_pattern "leetcode-dashboard"
kill_by_pattern "vite"
sleep 2

# Step 2: Build backend
echo ""
echo "[2/3] Building backend..."
cd "$PROJECT_ROOT/backend"
if [ ! -f go.mod ]; then
    echo "Error: go.mod not found in backend directory"
    exit 1
fi
go mod download 2>/dev/null || true
go build -o leetcode-dashboard cmd/main.go
if [ $? -ne 0 ]; then
    echo "Error: Backend build failed"
    exit 1
fi
echo "Backend built successfully"

# Step 3: Install frontend dependencies
echo ""
echo "[3/3] Installing frontend dependencies..."
cd "$PROJECT_ROOT/frontend"
npm install 2>/dev/null || true

# Step 4: Start services in background
echo ""
echo "Starting services in background..."

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

# Start frontend
cd "$PROJECT_ROOT/frontend"
nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID on port $FRONTEND_PORT"

# Wait for frontend to initialize
sleep 2

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "Error: Frontend failed to start. Check $FRONTEND_LOG"
    exit 1
fi

echo ""
echo "=========================================="
echo "Services Started Successfully!"
echo "=========================================="
echo "Backend:  http://localhost:$BACKEND_PORT"
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo ""
echo "Backend log: $BACKEND_LOG"
echo "Frontend log: $FRONTEND_LOG"
echo ""
echo "To stop services, run:"
echo "  lsof -ti:$BACKEND_PORT | xargs kill -9"
echo "  lsof -ti:$FRONTEND_PORT | xargs kill -9"
echo ""
echo "Script completed. Services are running in background."
echo ""

# Script exits here, services continue running in background
exit 0
