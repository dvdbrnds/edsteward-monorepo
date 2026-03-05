EdSteward startup procedure for daily work sessions:

1. Kill existing processes: `lsof -ti:3000 | xargs kill -9 2>/dev/null || true`
2. Start server in background: `npx tsx server/index.ts` (background mode)
3. Wait for startup: `sleep 10`
4. Health check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` (expect 200)
5. Verify process: `ps aux | grep "npx tsx server/index.ts" | grep -v grep`

System runs stably in background with automatic database recovery. Server responds at http://localhost:3000 when healthy. Process management uses zsh-compatible commands on macOS.