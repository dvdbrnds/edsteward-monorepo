EdSteward startup process for new day:

1. **Kill existing processes**: `lsof -ti:3000 | xargs kill -9 2>/dev/null || true`
2. **Start development server**: `npm run dev` (runs in background)
3. **Verify startup**: Server responds with HTTP 200 on localhost:3000
4. **Process verification**: Check `ps aux | grep "npm run dev\|tsx server"` for active processes

Key process details:
- Main server: `tsx server/index.ts` 
- Frontend: Vite development server
- Database: Neon PostgreSQL connection
- WebSocket: MCP Engine integration with reduced toast notifications

System includes recent improvements:
- Smart compliance notification system (90-60-30-7-1 day timeline)
- Notification history management with sorting/filtering
- WebSocket toast frequency reduced (only on reconnections, not initial connections)
- Admin-only notification creation and management