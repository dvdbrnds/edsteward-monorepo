import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Bell, Clock, CheckCircle, XCircle, AlertTriangle, Mail,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, Plus, Users,
  ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import CreateNotificationModal from "@/components/notifications/create-notification-modal";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";

// ── Types ──────────────────────────────────────────────────────

interface AlertTask {
  id: number;
  name: string;
  status: string;
  priority: string;
  dueDate: string;
  assignedRole: string | null;
  responsibleOffice?: string | null;
  regulationId: number;
  regulationName: string | null;
  regulationTopic: string | null;
}

interface AlertsResponse {
  overdue: AlertTask[];
  dueSoon: AlertTask[];
  counts: { overdue: number; dueSoon: number };
}

interface NotificationHistoryItem {
  id: number;
  type: string;
  status: "pending" | "sent" | "failed";
  priority: "high" | "normal" | "low";
  content: any;
  createdAt: string;
  sentAt: string | null;
  retryCount: number;
  regulation: { id: number; name: string; category: string } | null;
  user: { id: number; firstName: string; lastName: string; email: string } | null;
}

interface NotificationHistoryResponse {
  notifications: NotificationHistoryItem[];
  total: number;
  offset: number;
  limit: number;
}

type SortField = "createdAt" | "sentAt" | "type" | "status" | "priority";
type SortOrder = "asc" | "desc";

// ── Page ───────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { user } = useAuth();

  // Alerts state
  const [alertTab, setAlertTab] = useState<"overdue" | "dueSoon">("overdue");
  const [alertsExpanded, setAlertsExpanded] = useState(true);

  // Notification history state
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "pending" | "failed">("sent");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // ── Queries ────────────────────────────────────────────────

  const { data: alerts, isLoading: alertsLoading } = useQuery<AlertsResponse>({
    queryKey: ["/api/compliance-tasks/alerts"],
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const { data: notificationHistory, isLoading: historyLoading } = useQuery<NotificationHistoryResponse>({
    queryKey: ["/api/notification-history", { status: statusFilter === "all" ? undefined : statusFilter, sortBy: sortField, sortOrder }],
    refetchInterval: 30_000,
  });

  const { data: deliveryIssues } = useQuery<{ summary: { bounced: number; failed: number } }>({
    queryKey: ["/api/admin/email-delivery-issues", "summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/email-delivery-issues?days=30&limit=1");
      if (!res.ok) return { summary: { bounced: 0, failed: 0 } };
      return res.json();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
  const bounceCount = (deliveryIssues?.summary?.bounced ?? 0) + (deliveryIssues?.summary?.failed ?? 0);

  // ── Handlers ───────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  // ── Alert helpers ──────────────────────────────────────────

  const currentAlerts = alertTab === "overdue" ? alerts?.overdue ?? [] : alerts?.dueSoon ?? [];
  const overdueCount = alerts?.counts.overdue ?? 0;
  const dueSoonCount = alerts?.counts.dueSoon ?? 0;

  function daysOverdue(dueDate: string) {
    const diff = Date.now() - new Date(dueDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // ── Notification history helpers ───────────────────────────

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case "pending":
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "failed":
        return <Badge variant="default" className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />High</Badge>;
      case "normal":
        return <Badge variant="secondary">Normal</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getNotificationTitle = (n: NotificationHistoryItem) => {
    if (n.regulation) return `${n.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}: ${n.regulation.name}`;
    if (n.content?.title) return n.content.title;
    if (n.content?.subject) return n.content.subject;
    return n.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const getNotificationDescription = (n: NotificationHistoryItem) => {
    if (n.content?.message) return n.content.message;
    if (n.content?.body) return n.content.body;
    if (typeof n.content === "string") return n.content;
    return "No description available";
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <Bell className="h-6 w-6 mr-3 text-blue-500" />
              <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
              {overdueCount > 0 && (
                <span className="ml-3 flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-bold text-white bg-red-500 rounded-full">
                  {overdueCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => setIsCreateModalOpen(true)} size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Send Notification
              </Button>
            </div>
          </div>

          {/* ════════ COMPLIANCE ALERTS ════════ */}
          <Card className="shadow-sm mb-6 border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Compliance Alerts
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAlertsExpanded(!alertsExpanded)}
                  className="text-muted-foreground"
                >
                  {alertsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              {/* Tabs: Overdue / Due Soon */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setAlertTab("overdue")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    alertTab === "overdue"
                      ? "bg-red-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  Overdue{overdueCount > 0 && ` (${overdueCount})`}
                </button>
                <button
                  onClick={() => setAlertTab("dueSoon")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    alertTab === "dueSoon"
                      ? "bg-amber-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  Due Soon{dueSoonCount > 0 && ` (${dueSoonCount})`}
                </button>
              </div>
            </CardHeader>

            {alertsExpanded && (
              <CardContent className="pt-0">
                {alertsLoading ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Loading alerts...</p>
                  </div>
                ) : currentAlerts.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {alertTab === "overdue" ? "No overdue tasks — nice work!" : "No tasks due in the next 7 days."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {currentAlerts.map((task) => {
                      const isOverdue = alertTab === "overdue";
                      const days = isOverdue ? daysOverdue(task.dueDate) : 0;
                      const urgencyColor = isOverdue
                        ? days > 30 ? "border-l-red-700 bg-red-50 dark:bg-red-950/30" : "border-l-red-400 bg-red-50/60 dark:bg-red-950/20"
                        : "border-l-amber-400 bg-amber-50/60 dark:bg-amber-950/20";

                      return (
                        <Link key={task.id} href={`/regulations/${task.regulationId}`}>
                          <div className={`flex items-start gap-4 p-3 rounded-lg border-l-4 ${urgencyColor} cursor-pointer hover:opacity-80 transition-opacity`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{task.name}</p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {task.regulationName}
                                {task.regulationTopic ? ` · ${task.regulationTopic}` : ""}
                              </p>
                              {(task.responsibleOffice || task.assignedRole) && (
                                <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {task.responsibleOffice
                                    ? `${task.responsibleOffice}${task.assignedRole ? ` — ${task.assignedRole}` : ''}`
                                    : task.assignedRole}
                                </span>
                              )}
                            </div>

                            <div className="flex-shrink-0 text-right">
                              {isOverdue ? (
                                <span className="text-xs font-semibold text-red-600">
                                  {days}d overdue
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-amber-600">
                                  {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
                                </span>
                              )}
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {format(new Date(task.dueDate), "MMM d, yyyy")}
                              </p>
                            </div>

                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* ════════ NOTIFICATION SYSTEM INFO (collapsed by default) ════════ */}
          <NotificationSystemInfo />

          {/* ════════ NOTIFICATION HISTORY ════════ */}
          <div className="flex items-center justify-between mb-4 p-4 bg-card rounded-lg border">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Filter:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="border border-border rounded-md px-3 py-1 text-sm bg-background text-foreground"
                >
                  <option value="all">All Notifications</option>
                  <option value="sent">Sent Only</option>
                  <option value="pending">Pending Only</option>
                  <option value="failed">Failed Only</option>
                </select>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {notificationHistory
                ? <>Showing {notificationHistory.notifications.length} of {notificationHistory.total} notifications</>
                : "Loading..."}
            </div>
          </div>

          {bounceCount > 0 && (
            <Alert variant="destructive" className="mb-6">
              <Mail className="h-4 w-4" />
              <AlertTitle>{bounceCount} email delivery {bounceCount === 1 ? "issue" : "issues"} in the last 30 days</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>Some notification emails failed to deliver. DRI contacts may not have received important compliance notifications.</span>
                <Link href="/admin/settings">
                  <Button variant="outline" size="sm" className="ml-4 whitespace-nowrap">
                    View Issues
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Email Notification History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading notification history...</p>
                </div>
              ) : !notificationHistory?.notifications.length ? (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg mb-2">No notifications found</p>
                  <p className="text-muted-foreground text-sm">
                    {statusFilter === "all" ? "No notifications have been sent yet." : `No ${statusFilter} notifications found.`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-background border-b">
                      <tr>
                        <th className="px-6 py-3 text-left">
                          <button onClick={() => handleSort("type")} className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
                            Notification {getSortIcon("type")}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left">
                          <button onClick={() => handleSort("status")} className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
                            Status {getSortIcon("status")}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left">
                          <button onClick={() => handleSort("priority")} className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
                            Priority {getSortIcon("priority")}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left">
                          <button onClick={() => handleSort("createdAt")} className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
                            Created {getSortIcon("createdAt")}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left">
                          <button onClick={() => handleSort("sentAt")} className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
                            Sent {getSortIcon("sentAt")}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Recipient
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-gray-200">
                      {notificationHistory.notifications.map((notification) => (
                        <tr
                          key={notification.id}
                          className={`hover:bg-background ${notification.regulation ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (notification.regulation) {
                              window.location.href = `/regulations/${notification.regulation.id}`;
                            }
                          }}
                        >
                          <td className="px-6 py-4">
                            <div className="max-w-xs">
                              <p className={`text-sm font-medium truncate ${notification.regulation ? "text-blue-600" : "text-foreground"}`}>
                                {getNotificationTitle(notification)}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">{getNotificationDescription(notification)}</p>
                              {notification.regulation && (
                                <p className="text-xs text-blue-500 mt-1">{notification.regulation.category} →</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(notification.status)}
                            {notification.retryCount > 0 && <p className="text-xs text-muted-foreground mt-1">Retries: {notification.retryCount}</p>}
                          </td>
                          <td className="px-6 py-4">{getPriorityBadge(notification.priority)}</td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {format(new Date(notification.createdAt), "MMM d, yyyy")}
                            <br />
                            <span className="text-xs text-muted-foreground">{format(new Date(notification.createdAt), "h:mm a")}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {notification.sentAt ? (
                              <>
                                {format(new Date(notification.sentAt), "MMM d, yyyy")}
                                <br />
                                <span className="text-xs text-muted-foreground">{format(new Date(notification.sentAt), "h:mm a")}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not sent</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {notification.user ? (
                              <>
                                <p className="font-medium">{notification.user.firstName} {notification.user.lastName}</p>
                                <p className="text-xs text-muted-foreground">{notification.user.email}</p>
                              </>
                            ) : (
                              <span className="text-muted-foreground">System</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <CreateNotificationModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}

// ── Collapsible info card ────────────────────────────────────

function NotificationSystemInfo() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="shadow-sm mb-6">
      <CardHeader className="pb-0 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2 text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Smart Compliance Notification System
          </CardTitle>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 pt-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium mb-2 flex items-center gap-2 text-blue-900 dark:text-blue-300">
                  <Clock className="h-4 w-4" /> Notification Schedule:
                </p>
                <ul className="ml-6 space-y-1 text-sm text-blue-800 dark:text-blue-400">
                  <li>• <strong>90 days before:</strong> Initial notice</li>
                  <li>• <strong>60 days before:</strong> Second reminder</li>
                  <li>• <strong>30 days before:</strong> Third reminder</li>
                  <li>• <strong>7-1 days before:</strong> Daily reminders</li>
                  <li>• <strong>Final day:</strong> Multiple reminders</li>
                  <li className="border-t border-red-200 dark:border-red-800 pt-2 mt-2"><strong className="text-red-700 dark:text-red-400">Overdue Escalation:</strong></li>
                  <li className="text-red-800 dark:text-red-400">• <strong>Day 1+:</strong> Immediate stakeholder alerts</li>
                  <li className="text-red-800 dark:text-red-400">• <strong>Week 2+:</strong> Executive escalation</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2 flex items-center gap-2 text-blue-900 dark:text-blue-300">
                  <Users className="h-4 w-4" /> Role-Based Escalation:
                </p>
                <ul className="ml-6 space-y-1 text-sm text-blue-800 dark:text-blue-400">
                  <li>• <strong>90-8 days:</strong> Compliance Officers only</li>
                  <li>• <strong>7-1 days:</strong> All stakeholders</li>
                  <li className="text-xs mt-2">(CCO, Legal Counsel, Administrators)</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
