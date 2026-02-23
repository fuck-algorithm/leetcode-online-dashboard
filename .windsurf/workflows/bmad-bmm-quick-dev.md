---
description: 'Flexible development - execute tech-specs OR direct instructions with optional planning.'
auto_execution_mode: "iterate"
---

# quick-dev

Read the entire workflow file at {project-root}/_bmad/bmm/workflows/bmad-quick-flow/quick-dev/workflow.md

Follow all instructions in the workflow file exactly as written.

## Critical Bug Fix Knowledge

### Issue: /api/hot100 returns CN/COM = 0

**Root Cause:**
`/api/hot100` route was mapped to `GetHot100FromCache` instead of `GetHot100`.

**Files to Check/Fix:**

1. **backend/internal/handlers/handlers.go** - Verify `GetHot100` reads from Redis
2. **backend/internal/middleware/cache.go** - Add `/api/hot100` to skipPaths
3. **backend/cmd/main.go** - Ensure `hot100.GET("", handlers.GetHot100)` NOT `GetHot100FromCache`
