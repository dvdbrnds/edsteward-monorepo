## EdSteward MCP Engine Sync Session - January 22-23, 2026

### 1. Dark Mode Toggle Fix
**Problem:** React Context wasn't reaching components, showing `useTheme called outside ThemeProvider, using fallback`

**Solution:** Rewrote `client/src/hooks/use-theme.tsx` to use direct DOM manipulation + localStorage + CustomEvent instead of React Context:
```typescript
function applyThemeToDOM(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  if (resolved === 'dark') {
    root.classList.add('dark');
  }
}

// Apply immediately on script load
if (typeof window !== 'undefined') {
  applyThemeToDOM(resolveTheme(getStoredTheme()));
}
```

### 2. MCP Engine Sync - mcpRegKey Field Fix
**Problem:** Endpoint was creating duplicate regulations instead of updating existing ones because it read `data.regKey` but MCP Engine sends `mcpRegKey`.

**Fix in `server/mcp-integration-api.ts`:**
```typescript
// Support both 'mcpRegKey' (MCP Engine sends this) and 'regKey' (legacy)
const regKey = data.mcpRegKey || data.regKey;
```

### 3. PM2 Process Management
**Common issue:** `EADDRINUSE: address already in use 0.0.0.0:3000`

**Proper restart sequence:**
```bash
pm2 stop edsteward && sleep 1 && lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1 && pm2 start edsteward --update-env
```

### 4. MCP Engine Sync API
**Endpoint:** `POST /api/mcp/regulations/sync`

**Auth:** Basic Auth `ZHZkYnJuZHM6Z2FiYWRo` (dvdbrnds:gabadh)

**Fields EdSteward reads:**
- `mcpRegKey` - for matching/upsert
- `name`, `statute`, `category`, `topic` - required
- `complianceTasks[]` with:
  - `taskId` - unique identifier
  - `title`, `description`
  - `priority` - high/medium/low
  - `requirementType` - "requirement" or "best_practice"
  - `tempId`/`parentTempId` - for hierarchy

### 5. View Changes Navigation Fix
**Problem:** Button opened new tab with `window.open(..., '_blank')`

**Fix in `client/src/pages/updates-list-page.tsx`:**
```typescript
import { useLocation } from 'wouter';
// ...
const [, setLocation] = useLocation();
// ...
onClick={() => setLocation(`/regulations/updates/${update.id}`)}
```

### 6. Cursor IDE Browser Testing
Useful MCP tools for debugging:
- `browser_navigate` - go to URL
- `browser_lock` / `browser_unlock` - control automation
- `browser_snapshot` - get page structure
- `browser_click` - click elements by ref
- `browser_console_messages` - read console logs