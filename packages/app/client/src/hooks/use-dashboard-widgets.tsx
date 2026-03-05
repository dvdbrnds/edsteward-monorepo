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

// Default order of widgets
const DEFAULT_WIDGET_ORDER: WidgetId[] = DASHBOARD_WIDGETS.map(w => w.id);

const STORAGE_KEY = 'edsteward-dashboard-widgets';
const ORDER_STORAGE_KEY = 'edsteward-dashboard-widget-order';

interface DashboardWidgetsContextType {
  widgets: Widget[];
  hiddenWidgets: Set<WidgetId>;
  hiddenCount: number;
  widgetOrder: WidgetId[];
  isWidgetVisible: (widgetId: WidgetId) => boolean;
  toggleWidget: (widgetId: WidgetId) => void;
  showAllWidgets: () => void;
  hideWidget: (widgetId: WidgetId) => void;
  showWidget: (widgetId: WidgetId) => void;
  reorderWidgets: (newOrder: WidgetId[]) => void;
  resetOrder: () => void;
  getOrderedWidgets: () => Widget[];
  isLoaded: boolean;
}

const DashboardWidgetsContext = createContext<DashboardWidgetsContextType | null>(null);

export function DashboardWidgetsProvider({ children }: { children: ReactNode }) {
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<WidgetId>>(new Set());
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(DEFAULT_WIDGET_ORDER);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      // Load hidden widgets
      const storedHidden = localStorage.getItem(STORAGE_KEY);
      if (storedHidden) {
        const parsed = JSON.parse(storedHidden);
        if (Array.isArray(parsed)) {
          setHiddenWidgets(new Set(parsed as WidgetId[]));
        }
      }
      
      // Load widget order
      const storedOrder = localStorage.getItem(ORDER_STORAGE_KEY);
      if (storedOrder) {
        const parsed = JSON.parse(storedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate and merge with any new widgets that might have been added
          const validOrder = parsed.filter((id: string) => 
            DASHBOARD_WIDGETS.some(w => w.id === id)
          ) as WidgetId[];
          
          // Add any new widgets that weren't in the saved order
          const missingWidgets = DEFAULT_WIDGET_ORDER.filter(id => !validOrder.includes(id));
          setWidgetOrder([...validOrder, ...missingWidgets]);
        }
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoaded(true);
  }, []);

  // Save hidden widgets to localStorage
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...hiddenWidgets]));
      } catch {
        // Ignore storage errors
      }
    }
  }, [hiddenWidgets, isLoaded]);

  // Save widget order to localStorage
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(widgetOrder));
      } catch {
        // Ignore storage errors
      }
    }
  }, [widgetOrder, isLoaded]);

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

  const reorderWidgets = useCallback((newOrder: WidgetId[]) => {
    setWidgetOrder(newOrder);
  }, []);

  const resetOrder = useCallback(() => {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
  }, []);

  const getOrderedWidgets = useCallback((): Widget[] => {
    return widgetOrder
      .map(id => DASHBOARD_WIDGETS.find(w => w.id === id))
      .filter((w): w is Widget => w !== undefined);
  }, [widgetOrder]);

  const hiddenCount = hiddenWidgets.size;

  return (
    <DashboardWidgetsContext.Provider value={{
      widgets: DASHBOARD_WIDGETS,
      hiddenWidgets,
      hiddenCount,
      widgetOrder,
      isWidgetVisible,
      toggleWidget,
      showAllWidgets,
      hideWidget,
      showWidget,
      reorderWidgets,
      resetOrder,
      getOrderedWidgets,
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
