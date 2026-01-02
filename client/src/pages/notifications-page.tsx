import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Clock, CheckCircle, XCircle, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Filter, Plus, Users } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import CreateNotificationModal from "@/components/notifications/create-notification-modal";
import { Link } from "wouter";
import { format } from "date-fns";

interface NotificationHistoryItem {
  id: number;
  type: string;
  status: 'pending' | 'sent' | 'failed';
  priority: 'high' | 'normal' | 'low';
  content: any;
  createdAt: string;
  sentAt: string | null;
  retryCount: number;
  regulation: {
    id: number;
    name: string;
    category: string;
  } | null;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

interface NotificationHistoryResponse {
  notifications: NotificationHistoryItem[];
  total: number;
  offset: number;
  limit: number;
}

type SortField = 'createdAt' | 'sentAt' | 'type' | 'status' | 'priority';
type SortOrder = 'asc' | 'desc';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'pending' | 'failed'>('sent');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: notificationHistory, isLoading } = useQuery<NotificationHistoryResponse>({
    queryKey: ["/api/notification-history", { status: statusFilter === 'all' ? undefined : statusFilter, sortBy: sortField, sortOrder }],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Sent
        </Badge>;
      case 'pending':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>;
      case 'failed':
        return <Badge variant="default" className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          High
        </Badge>;
      case 'normal':
        return <Badge variant="secondary">Normal</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getNotificationTitle = (notification: NotificationHistoryItem) => {
    if (notification.regulation) {
      return `${notification.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${notification.regulation.name}`;
    }
    
    // Try to extract title from content
    if (notification.content && typeof notification.content === 'object') {
      if (notification.content.title) return notification.content.title;
      if (notification.content.subject) return notification.content.subject;
    }
    
    return notification.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getNotificationDescription = (notification: NotificationHistoryItem) => {
    if (notification.content && typeof notification.content === 'object') {
      if (notification.content.message) return notification.content.message;
      if (notification.content.body) return notification.content.body;
    }
    
    if (typeof notification.content === 'string') {
      return notification.content;
    }
    
    return 'No description available';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <Bell className="h-6 w-6 mr-3 text-blue-500" />
              <h1 className="text-3xl font-bold text-foreground">
                Notifications
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Send Notification
              </Button>
            </div>
          </div>

          {/* Smart Notification System Info - Always Visible */}
          <Card className="shadow-sm mb-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Smart Compliance Notification System
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* How It Works */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium mb-2 flex items-center gap-2 text-blue-900">
                        <Clock className="h-4 w-4" />
                        Notification Schedule:
                      </p>
                      <ul className="ml-6 space-y-1 text-sm text-blue-800">
                        <li>• <strong>90 days before:</strong> Initial notice</li>
                        <li>• <strong>60 days before:</strong> Second reminder</li>
                        <li>• <strong>30 days before:</strong> Third reminder</li>
                        <li>• <strong>7-1 days before:</strong> Daily reminders</li>
                        <li>• <strong>Final day:</strong> Multiple reminders (morning, afternoon, evening)</li>
                        <li className="border-t border-red-200 pt-2 mt-2">
                          <strong className="text-red-700">Overdue Escalation:</strong>
                        </li>
                        <li className="text-red-800">• <strong>Day 1 overdue:</strong> Immediate alert to all stakeholders</li>
                        <li className="text-red-800">• <strong>Days 2-7 overdue:</strong> Daily urgent reminders</li>
                        <li className="text-red-800">• <strong>Week 2+ overdue:</strong> Weekly critical alerts + executive escalation</li>
                      </ul>
                    </div>
                    
                    <div>
                      <p className="font-medium mb-2 flex items-center gap-2 text-blue-900">
                        <Users className="h-4 w-4" />
                        Role-Based Escalation:
                      </p>
                      <ul className="ml-6 space-y-1 text-sm text-blue-800">
                        <li>• <strong>90-8 days:</strong> Compliance Officers only</li>
                        <li>• <strong>7-1 days:</strong> All stakeholders</li>
                        <li className="text-xs text-blue-600 mt-2">
                          (CCO, Legal Counsel, Administrators)
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* System Status */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900 text-sm">System Active</p>
                        <p className="text-xs text-green-700">Monitoring all deadlines</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-medium text-blue-900 text-sm">Email Delivery</p>
                        <p className="text-xs text-blue-700">Automatic notifications</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="font-medium text-purple-900 text-sm">Smart Filtering</p>
                        <p className="text-xs text-purple-700">Only when needed</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Override Controls */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-900 text-sm mb-1">Notification Override</p>
                      <p className="text-xs text-yellow-800">
                        Compliance officers can disable notifications for specific regulations when appropriate. 
                        Override controls are available on individual regulation pages.
                      </p>
                    </div>
                  </div>
                </div>

                {/* No Configuration Needed */}
                <div className="bg-background border border-border rounded-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    <strong>Automatic System:</strong> Monitors compliance deadlines and sends targeted notifications 
                    based on your role and urgency. Officers can override notifications per regulation as needed.
                  </p>
                </div>
              </CardContent>
            </Card>

          {/* Filter and Stats Bar */}
          <div className="flex items-center justify-between mb-6 p-4 bg-card rounded-lg border">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Filter:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="border border-border rounded-md px-3 py-1 text-sm"
                >
                  <option value="all">All Notifications</option>
                  <option value="sent">Sent Only</option>
                  <option value="pending">Pending Only</option>
                  <option value="failed">Failed Only</option>
                </select>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {notificationHistory ? (
                <>Showing {notificationHistory.notifications.length} of {notificationHistory.total} notifications</>
              ) : (
                'Loading...'
              )}
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Notification History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading notification history...</p>
                </div>
              ) : !notificationHistory?.notifications.length ? (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg mb-2">No notifications found</p>
                  <p className="text-muted-foreground text-sm">
                    {statusFilter === 'all' 
                      ? 'No notifications have been sent yet.' 
                      : `No ${statusFilter} notifications found.`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-background border-b">
                      <tr>
                        <th className="px-6 py-3 text-left">
                          <button
                            onClick={() => handleSort('type')}
                            className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                          >
                            Notification
                            {getSortIcon('type')}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left">
                          <button
                            onClick={() => handleSort('status')}
                            className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                          >
                            Status
                            {getSortIcon('status')}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left">
                          <button
                            onClick={() => handleSort('priority')}
                            className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                          >
                            Priority
                            {getSortIcon('priority')}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left">
                          <button
                            onClick={() => handleSort('createdAt')}
                            className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                          >
                            Created
                            {getSortIcon('createdAt')}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left">
                          <button
                            onClick={() => handleSort('sentAt')}
                            className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                          >
                            Sent
                            {getSortIcon('sentAt')}
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
                          className={`hover:bg-background ${notification.regulation ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (notification.regulation) {
                              window.location.href = `/regulations/${notification.regulation.id}`;
                            }
                          }}
                        >
                          <td className="px-6 py-4">
                            <div className="max-w-xs">
                              <p className={`text-sm font-medium truncate ${notification.regulation ? 'text-blue-600' : 'text-foreground'}`}>
                                {getNotificationTitle(notification)}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {getNotificationDescription(notification)}
                              </p>
                              {notification.regulation && (
                                <p className="text-xs text-blue-500 mt-1">
                                  {notification.regulation.category} →
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(notification.status)}
                            {notification.retryCount > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Retries: {notification.retryCount}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {getPriorityBadge(notification.priority)}
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {format(new Date(notification.createdAt), 'MMM d, yyyy')}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(notification.createdAt), 'h:mm a')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {notification.sentAt ? (
                              <>
                                {format(new Date(notification.sentAt), 'MMM d, yyyy')}
                                <br />
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(notification.sentAt), 'h:mm a')}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not sent</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {notification.user ? (
                              <>
                                <p className="font-medium">
                                  {notification.user.firstName} {notification.user.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {notification.user.email}
                                </p>
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

      {/* Create Notification Modal */}
      <CreateNotificationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}