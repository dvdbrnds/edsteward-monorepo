## EdSteward MCP Engine Integration - January 2026

### 1. Task Requirement Type Feature
Added `requirement_type` field to `compliance_tasks` table to categorize tasks from MCP Engine:
- `requirement` = legally mandated tasks (must do)
- `best_practice` = recommended tasks (should do)

**Schema change in `shared/schema.ts`:**
```typescript
export const REQUIREMENT_TYPE = ['requirement', 'best_practice'] as const;
export type RequirementType = typeof REQUIREMENT_TYPE[number];

export const complianceTasks = pgTable("compliance_tasks", {
  taskId: text("task_id"), // Unique task identifier (e.g., GLBA-001)
  requirementType: text("requirement_type").default('requirement'),
  // ...
});
```

**SQL Migration (`migrations/add-requirement-type-field.sql`):**
```sql
ALTER TABLE compliance_tasks ADD COLUMN IF NOT EXISTS task_id VARCHAR(50);
ALTER TABLE compliance_tasks ADD COLUMN IF NOT EXISTS requirement_type VARCHAR(20) DEFAULT 'requirement';
CREATE INDEX IF NOT EXISTS compliance_tasks_requirement_type_idx ON compliance_tasks(requirement_type);
```

### 2. Compliance Scoring Formula Update
Modified scoring in `server/routes/api/dashboard-analytics.ts` to weight requirements higher:
```typescript
const baseScore = Math.round(
  (regComplianceRate * 0.4) +
  (requirementCompletionRate * 0.3) + // Requirements weighted at 30%
  (deadlineCompletionRate * 0.2) +
  (attestationRate * 0.1)
);
const bestPracticeBonus = totalBestPractices > 0
  ? (completedBestPractices / totalBestPractices) * 10 // Up to 10% bonus
  : 0;
const overallComplianceScore = Math.min(baseScore + Math.round(bestPracticeBonus), 100);
```

### 3. Filtering by is_current Flag
All regulation queries now filter by `is_current = true` to exclude deprecated regulations:
- `server/storage.ts` - `getRegulations()` method
- `server/routes/api/dashboard-analytics.ts`
- `server/routes/api/reports.ts`
- `server/mcp-integration-api.ts`

### 4. Dark Mode Toggle Fix
**Problem:** React Context wasn't reaching components due to HMR/mounting isolation issues. Console showed: `useTheme called outside ThemeProvider, using fallback`

**Solution:** Rewrote `client/src/hooks/use-theme.tsx` to use direct DOM manipulation + localStorage + CustomEvent instead of React Context:
```typescript
function applyThemeToDOM(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  if (resolved === 'dark') {
    root.classList.add('dark');
  }
}

// Apply theme immediately on script load (before React hydrates)
if (typeof window !== 'undefined') {
  const initialTheme = getStoredTheme();
  const resolved = resolveTheme(initialTheme);
  applyThemeToDOM(resolved);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  // Uses window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT)) to sync across components
}
```

### 5. PM2 Process Management Issue
**Problem:** Server wouldn't start - `EADDRINUSE: address already in use 0.0.0.0:3000`

**Root cause:** PM2 was managing an `edsteward` process and auto-restarting it.

**Solution:**
```bash
pm2 stop edsteward && pm2 delete edsteward
pkill -f "node.*EdSteward"
lsof -ti:3000 | xargs kill -9
```

### 6. Cursor IDE Browser Testing
Used `cursor-ide-browser` MCP tools for debugging:
1. `browser_navigate` - Navigate to app URL
2. `browser_lock` - Lock browser for automation
3. `browser_snapshot` - Get page structure with element refs
4. `browser_click` - Click elements by ref
5. `browser_console_messages` - Read console logs for debugging
6. `browser_unlock` - Release browser control