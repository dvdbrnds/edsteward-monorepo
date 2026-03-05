EdSteward Dashboard Widget Drag-and-Drop Reordering Feature (January 2026):

**Implementation:**
- Installed `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` for drag-and-drop
- Created `DraggableWidget` component (`client/src/components/dashboard/draggable-widget.tsx`) with hover-visible drag handles
- Updated `use-dashboard-widgets.tsx` hook to track widget order in localStorage with key `edsteward-dashboard-widget-order`
- Dashboard widgets can be directly dragged to reorder on the main dashboard page

**Key Components:**
```typescript
// DraggableWidget wrapper with drag handle
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Drag handle appears on hover on left side of widget
<button className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
  <GripVertical className="h-4 w-4" />
</button>
```

**Widget Settings Dropdown:**
- Renamed from "Customize" to "Widgets"
- Provides visibility toggles for each widget
- "Show All" button to unhide all widgets
- "Reset" button to restore default order

**Widget Sizes:** stats/trusteesCard/regulationList = full width, notifications/deadlineCalendar = half width, myTasks/pendingAttestations/complianceOverview/upcomingDeadlines = quarter width