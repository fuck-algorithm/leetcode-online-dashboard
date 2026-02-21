---
title: 'Fix WSS Online Count and Git Workflow'
slug: 'fix-wss-online-count-git'
created: '2026-02-21T15:45:00Z'
status: 'in-progress'
stepsCompleted: [1, 2]
tech_stack: ['Go', 'Gin', 'WebSocket (gorilla/websocket)', 'React', 'TypeScript', 'SQLite']
files_to_modify: [
  'backend/internal/worker/worker.go',
  '.git (for commit/push operations)'
]
code_patterns: [
  'Go concurrency with goroutines and channels',
  'WebSocket broadcast pattern via Hub',
  'Memory cache singleton pattern',
  'Batch processing with ticker',
  'Graceful error handling with reconnection'
]
test_patterns: []
---

# Tech-Spec: Fix WSS Online Count and Git Workflow

**Created:** 2026-02-21T15:45:00Z

## Overview

### Problem Statement

1. Git workflow: Need to commit local changes (BMAD framework files, backend updates) and push to remote repository
2. WSS subscription bug: All problems show no online count data on the frontend, despite backend connecting to LeetCode WebSockets successfully

### Solution

1. Git: Add all relevant changes, commit with appropriate message, push to origin/main
2. WSS Bug: Investigate the data flow from LeetCode WebSocket → backend → frontend to identify where online count data is lost

### Scope

**In Scope:**
- Git commit and push for current workspace changes
- Diagnose WSS subscription module for online count data issue
- Fix the bug causing zero online count display
- Verify fix works correctly

**Out of Scope:**
- Adding new features beyond bug fix
- Refactoring unrelated code
- Performance optimization
- Documentation beyond tech-spec

## Context for Development

### Codebase Patterns

- **Go Concurrency**: Worker uses goroutines for parallel processing (persistenceWorker, broadcastWorker, processBatches)
- **WebSocket Architecture**: Hub pattern for broadcasting to frontend clients; LeetCodeWSClient for external connections
- **Memory Cache**: Singleton pattern with sync.RWMutex for thread-safe access
- **Batch Processing**: Ticker-based batch processing to avoid overwhelming LeetCode servers
- **Error Handling**: Reconnection logic with exponential backoff for WebSocket failures

### Files to Reference

| File | Purpose |
| ---- | ------- |
| backend/internal/worker/worker.go | Core worker managing LeetCode WebSocket subscriptions and data broadcast |
| backend/internal/cache/memory.go | In-memory cache for problem online count data |
| backend/internal/websocket/client.go | LeetCode WebSocket client connection |
| backend/internal/websocket/hub.go | WebSocket hub for broadcasting to frontend |
| frontend/src/hooks/useWebSocket.ts | Frontend WebSocket connection hook |

### Technical Decisions

**Bug Root Cause Identified:**
The `broadcastBatchUpdate()` function (line 121-157 in worker.go) correctly handles empty cache by loading from DB via `loadLatestFromDB()`. The fix has already been applied. Current issue is the backend service needs to be restarted to apply the changes.

**Data Flow:**
1. LeetCode WebSocket → handleMessage() → saveOnlineCount() → Memory Cache
2. Memory Cache → broadcastWorker() (every 5s) → Frontend via Hub
3. PersistenceWorker (every 1min) → SQLite database
4. When cache empty: loadLatestFromDB() → query SQLite → broadcast to frontend

## Implementation Plan

### Tasks

**Task 1: Git Commit and Push**
- [ ] Stage all modified files (BMAD framework, backend changes)
- [ ] Create descriptive commit message
- [ ] Push to origin/main

**Task 2: Verify Backend Fix**
- [ ] Confirm worker.go has the fix applied (lines 130-136)
- [ ] Compile backend binary
- [ ] Restart backend service
- [ ] Verify logs show successful broadcast from database

**Task 3: Test Verification**
- [ ] Open frontend and verify online count displays
- [ ] Check multiple problems show correct online counts
- [ ] Verify WebSocket connection status

### Acceptance Criteria

- [ ] **AC1**: Git commit pushed successfully to remote
- [ ] **AC2**: Backend compiles without errors
- [ ] **AC3**: Backend service starts and connects to LeetCode WebSockets
- [ ] **AC4**: Frontend receives `batch_update` messages with online count data
- [ ] **AC5**: Rankings component displays non-zero online counts for problems

## Additional Context

### Dependencies

- Git repository access
- Go compiler (1.18+)
- Backend service can be restarted
- Frontend accessible for testing

### Testing Strategy

1. **Manual Backend Test**: Check logs for successful DB load and broadcast
2. **Frontend Verification**: Verify online counts display correctly in Rankings table
3. **WebSocket Monitor**: Check browser console for WebSocket messages

### Notes

- Fix already applied in worker.go (lines 130-136): cache empty → load from DB
- Only need to verify fix works and restart service
- Backend log location: backend/backend.log
