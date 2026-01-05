import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

export type WidgetId = 
  | 'stats'
  | 'myTasks'
  | 'pendingAttestations'
  | 'complianceOverview'
  | 'upcomingDeadlines'
  | 'notifications'
  | 'deadlineCalendar'
  | 'trusteesCard'
  | 'regulationList';

export interface Widget {
  id: WidgetId;
  name: string;
  description: string;
  defaultVisible: boolean;
  canHide: boolean; // Some widgets might be required
}

export const DASHBOARD_WIDGETS: Widget[] = [
  {
    id: 'stats',
    name: 'Dashboard Statistics',
    description: 'Overview of compliance metrics',
    defaultVisible: true,
    canHide: true,
  },
  {
    id: 'myTasks',
    name: 'My Tasks',
    description: 'Tasks assigned to you',
    defaultVisible: true,
    canHide: true,
  },
  {
    id: 'pendingAttestations',
    name: 'Pending Attestations',
    description: 'Attestations requiring your action',
    defaultVisible: true,
    canHide: true,
  },
  {
    id: 'complianceOverview',
    name: 'Compliance Overview',
    description: 'Compliance status by category',
    defaultVisible: true,
    canHide: true,
  },
  {
    id: 'upcomingDeadlines',
    name: 'Upcoming Deadlines',
    description: 'Next compliance deadlines',
    defaultVisible: true,
    canHide: true,
  },
  {
    id: 'notifications',
    name: 'Recent Notifications',
    description: 'Latest notification activity',
    defaultVisible: true,
    canHide: true,
  },
  {
    id: 'deadlineCalendar',
    name: 'Deadline Calendar',
    description: 'Calendar view of deadlines',
    defaultVisible: true,
    canHide: true,
  },
  {
    id: 'trusteesCard',
    name: 'Board of Trustees Link',
    description: 'Quick access to trustees dashboard',
    defaultVisible: true,
    canHide: true,
  },
  {
    id: 'regulationList',
    name: 'Regulations List',
    description: 'Full list of regulations',
    defaultVisible: true,
    canHide: false, // Core functionality - always visible
  },
];

const STORAGE_KEY = 'edsteward-dashboard-widgets';

interface DashboardWidgetsContextType {
  widgets: Widget[];
  hiddenWidgets: Set<WidgetId>;
  hiddenCount: number;
  isWidgetVisible: (widgetId: WidgetId) => boolean;
  toggleWidget: (widgetId: WidgetId) => void;
  showAllWidgets: () => void;
  hideWidget: (widgetId: WidgetId) => void;
  showWidget: (widgetId: WidgetId) => void;
  isLoaded: boolean;
}

const DashboardWidgetsContext = createContext<DashboardWidgetsContextType | null>(null);

export function DashboardWidgetsProvider({ children }: { children: ReactNode }) {
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<WidgetId>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHiddenWidgets(new Set(parsed as WidgetId[]));
        }
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever hiddenWidgets changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...hiddenWidgets]));
      } catch {
        // Ignore storage errors
      }
    }
  }, [hiddenWidgets, isLoaded]);

  const isWidgetVisible = useCallback((widgetId: WidgetId): boolean => {
    const widget = DASHBOARD_WIDGETS.find(w => w.id === widgetId);
    if (!widget?.canHide) return true; // Cannot hide required widgets
    return !hiddenWidgets.has(widgetId);
  }, [hiddenWidgets]);

  const toggleWidget = useCallback((widgetId: WidgetId) => {
    const widget = DASHBOARD_WIDGETS.find(w => w.id === widgetId);
    if (!widget?.canHide) return; // Cannot toggle required widgets

    setHiddenWidgets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(widgetId)) {
        newSet.delete(widgetId);
      } else {
        newSet.add(widgetId);
      }
      return newSet;
    });
  }, []);

  const showAllWidgets = useCallback(() => {
    setHiddenWidgets(new Set());
  }, []);

  const hideWidget = useCallback((widgetId: WidgetId) => {
    const widget = DASHBOARD_WIDGETS.find(w => w.id === widgetId);
    if (!widget?.canHide) return;

    setHiddenWidgets(prev => new Set([...prev, widgetId]));
  }, []);

  const showWidget = useCallback((widgetId: WidgetId) => {
    setHiddenWidgets(prev => {
      const newSet = new Set(prev);
      newSet.delete(widgetId);
      return newSet;
    });
  }, []);

  const hiddenCount = hiddenWidgets.size;

  return (
    <DashboardWidgetsContext.Provider value={{
      widgets: DASHBOARD_WIDGETS,
      hiddenWidgets,
      hiddenCount,
      isWidgetVisible,
      toggleWidget,
      showAllWidgets,
      hideWidget,
      showWidget,
      isLoaded,
    }}>
      {children}
    </DashboardWidgetsContext.Provider>
  );
}

export function useDashboardWidgets() {
  const context = useContext(DashboardWidgetsContext);
  if (!context) {
    throw new Error('useDashboardWidgets must be used within a DashboardWidgetsProvider');
  }
  return context;
}

