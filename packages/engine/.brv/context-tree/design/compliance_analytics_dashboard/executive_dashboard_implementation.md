Implemented executive analytics dashboard for EdSteward compliance portal on Dec 31, 2025.

**New API Endpoint**: `/api/dashboard-analytics` 
- Returns aggregated compliance metrics including:
  - Overall compliance score (calculated from task completion, overdue items)
  - Regulation statistics (total, compliant, needs attention, non-compliant)
  - Task statistics (total, completed, in progress, pending, overdue)
  - Deadline statistics with completion rates
  - Attestation completion rates
  - User statistics
  - Top issues list (regulations needing attention)

**Frontend Components**:
- `ExecutiveDashboard` component in `client/src/components/dashboard/executive-dashboard.tsx`
- Displays charts using Recharts library (PieChart, LineChart, BarChart)
- Added as "Analytics" tab on home page alongside "Overview" tab
- Also accessible via "Analytics" link in top navigation (admin only)

**Key Implementation Details**:
- Server must be built (`npm run build`) before running since it serves pre-built files from `dist/public/`
- Uses `@tanstack/react-query` for data fetching
- Responsive grid layout with Card components
- Shows real-time metrics with Refresh button