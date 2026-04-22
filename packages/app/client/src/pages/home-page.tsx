import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navigation from "@/components/layout/navigation";
import ExecutiveDashboard from "@/components/dashboard/executive-dashboard";
import MyTasks from "@/components/dashboard/my-tasks";
import PendingAttestations from "@/components/dashboard/pending-attestations";
import UpcomingDeadlines from "@/components/dashboard/upcoming-deadlines";
import DeadlineCalendar from "@/components/dashboard/deadline-calendar";
import RegulationList from "@/components/regulations/regulation-list";
import RegulationContextStrip from "@/components/dashboard/regulation-context-strip";
import { AppliesToFilter } from "@/components/filters/applies-to-filter";
import { WidgetSettings } from "@/components/dashboard/widget-settings";
import { DraggableWidget } from "@/components/dashboard/draggable-widget";
import { DashboardWidgetsProvider, useDashboardWidgets, type WidgetId } from "@/hooks/use-dashboard-widgets";
import { useState, useEffect, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, CheckCircle, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import type { Notification as _Notification } from "@shared/schema";

type WidgetSize = 'full' | 'half';

const ANALYTICS_WIDGET_SIZES: Record<string, WidgetSize> = {
  myTasks: 'half',
  pendingAttestations: 'half',
  upcomingDeadlines: 'half',
  deadlineCalendar: 'half',
  notifications: 'half',
};

function AnalyticsTabWidgets() {
  const { widgetOrder, isWidgetVisible, reorderWidgets } = useDashboardWidgets();
  const [activeId, setActiveId] = useState<WidgetId | null>(null);

  const { data: notificationHistory, isLoading: notificationsLoading } = useQuery<{
    notifications: Array<{
      id: number;
      type: string;
      status: string;
      priority: string;
      content: any;
      createdAt: string;
      sentAt: string | null;
      regulation: { id: number; name: string; category: string } | null;
      user: { id: number; firstName: string; lastName: string; email: string } | null;
    }>;
    total: number;
  }>({
    queryKey: ["/api/notification-history", { status: 'sent', limit: 10 }],
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as WidgetId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const oldIndex = widgetOrder.indexOf(active.id as WidgetId);
      const newIndex = widgetOrder.indexOf(over.id as WidgetId);
      reorderWidgets(arrayMove(widgetOrder, oldIndex, newIndex));
    }
  };

  const analyticsWidgetIds: WidgetId[] = ['myTasks', 'pendingAttestations', 'upcomingDeadlines', 'deadlineCalendar', 'notifications'];
  const visibleWidgets = widgetOrder.filter(id => analyticsWidgetIds.includes(id) && isWidgetVisible(id));

  const renderWidget = (widgetId: WidgetId): ReactNode => {
    switch (widgetId) {
      case 'myTasks':
        return <MyTasks />;
      case 'pendingAttestations':
        return <PendingAttestations />;
      case 'upcomingDeadlines':
        return <UpcomingDeadlines categoryFilter={null} />;
      case 'deadlineCalendar':
        return <DeadlineCalendar />;
      case 'notifications':
        return (
          <Card className="h-full min-h-[400px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-500" />
                Recent Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-2 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-3 scrollbar-thin px-6 pb-4">
                {notificationsLoading ? (
                  <p className="text-muted-foreground text-center py-4">Loading notifications...</p>
                ) : notificationHistory?.notifications && notificationHistory.notifications.length > 0 ? (
                  notificationHistory.notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border rounded-lg hover:bg-muted transition-colors ${notification.regulation ? 'cursor-pointer hover:border-blue-300' : ''}`}
                      {...(notification.regulation ? {
                        role: "button",
                        tabIndex: 0,
                        onClick: () => { window.location.href = `/regulations/${notification.regulation!.id}`; },
                        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') window.location.href = `/regulations/${notification.regulation!.id}`; },
                      } : {})}
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm leading-tight overflow-hidden" style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}>
                              {notification.regulation
                                ? (
                                  <>
                                    <span className="text-blue-600">
                                      {notification.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                                    </span>
                                    <span className="ml-1">
                                      {notification.regulation.name.length > 60
                                        ? `${notification.regulation.name.substring(0, 60)}...`
                                        : notification.regulation.name
                                      }
                                    </span>
                                  </>
                                )
                                : notification.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                              }
                            </p>
                            {notification.priority === 'high' && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                High Priority
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {new Date(notification.sentAt || notification.createdAt).toLocaleDateString()}
                            </span>
                            {notification.regulation && (
                              <>
                                <span>&bull;</span>
                                <span className="text-blue-600 truncate max-w-[120px]">
                                  {notification.regulation.category} &rarr;
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No recent notifications
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  const groupedWidgets: { widgets: WidgetId[]; size: WidgetSize }[] = [];
  let currentGroup: { widgets: WidgetId[]; size: WidgetSize } | null = null;

  visibleWidgets.forEach((widgetId) => {
    const size = ANALYTICS_WIDGET_SIZES[widgetId] || 'full';
    if (size === 'full') {
      if (currentGroup) { groupedWidgets.push(currentGroup); currentGroup = null; }
      groupedWidgets.push({ widgets: [widgetId], size: 'full' });
      return;
    }
    if (!currentGroup) {
      currentGroup = { widgets: [widgetId], size };
    } else if (currentGroup.widgets.length < 2) {
      currentGroup.widgets.push(widgetId);
    } else {
      groupedWidgets.push(currentGroup);
      currentGroup = { widgets: [widgetId], size };
    }
  });
  if (currentGroup) groupedWidgets.push(currentGroup);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={visibleWidgets} strategy={rectSortingStrategy}>
        <div className="space-y-6">
          {groupedWidgets.map((group, groupIndex) => {
            if (group.size === 'full') {
              return (
                <DraggableWidget key={group.widgets[0]} id={group.widgets[0]}>
                  {renderWidget(group.widgets[0])}
                </DraggableWidget>
              );
            }
            return (
              <div key={`group-${groupIndex}`} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {group.widgets.map(widgetId => (
                  <DraggableWidget key={widgetId} id={widgetId}>
                    {renderWidget(widgetId)}
                  </DraggableWidget>
                ))}
              </div>
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <div className="opacity-80 shadow-2xl rounded-lg">
            {renderWidget(activeId)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const isAdminMode = import.meta.env.VITE_ADMIN_MODE === 'true' || window.location.hostname.includes('admin');
    if (user?.role?.toLowerCase() === "admin" && isAdminMode) {
      setLocation("/admin/dashboard");
      return;
    }
  }, [user, setLocation]);

  return (
    <DashboardWidgetsProvider>
      <div className="min-h-screen bg-background">
        <Navigation />

        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Welcome, {(user as { firstName?: string })?.firstName || user?.username}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Your compliance regulations at a glance
                </p>
              </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Regulations
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="space-y-6">
                  <RegulationContextStrip
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                  />
                  <AppliesToFilter />
                  <RegulationList
                    categoryFilter={selectedCategory}
                    jurisdictionFilter={null}
                  />
                </div>
              </TabsContent>

              <TabsContent value="analytics">
                <div className="space-y-8">
                  <ExecutiveDashboard />

                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-foreground">Operational Widgets</h2>
                      <WidgetSettings />
                    </div>
                    <AnalyticsTabWidgets />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </DashboardWidgetsProvider>
  );
}
