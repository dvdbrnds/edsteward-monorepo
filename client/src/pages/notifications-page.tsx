import Navigation from "@/components/layout/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { Notification } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
// Removed unused Shadcn Select imports - using native HTML select instead
import { Bell, CheckCircle, XCircle, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingNotification, setEditingNotification] = useState<number | null>(null);
  

  // Helper function to get clean frequency display text
  const getFrequencyDisplayText = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      default: return frequency;
    }
  };

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });


  // Update notification mutation
  const updateNotificationMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Notification> }) => {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update notification');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      setEditingNotification(null);
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete notification');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const handleToggleEnabled = (id: number, enabled: boolean) => {
    updateNotificationMutation.mutate({ id, updates: { enabled } });
  };

  const handleFrequencyChange = (id: number, frequency: string) => {
    updateNotificationMutation.mutate({ id, updates: { frequency } });
  };

  const handleDeleteNotification = (id: number) => {
    if (confirm('Are you sure you want to delete this notification?')) {
      deleteNotificationMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            Loading...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-8">
            <Bell className="h-6 w-6 mr-3 text-blue-500" />
            <h1 className="text-3xl font-bold text-gray-900">
              Notifications
            </h1>
          </div>
          

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-xl font-semibold">Notification Settings</CardTitle>
              <Button
                onClick={() => {
                  // TODO: Add new notification functionality
                  alert('Add new notification feature coming soon!');
                }}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Notification
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Information Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Bell className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-blue-900 mb-3">How Notifications Work</h3>
                    <div className="text-sm text-blue-800 space-y-3">
                      <div>
                        <p className="font-medium mb-1">Default Settings:</p>
                        <p>Email notifications are enabled weekly for compliance alerts.</p>
                      </div>
                      
                      <div>
                        <p className="font-medium mb-1">When You'll Receive Notifications:</p>
                        <ul className="ml-4 space-y-1">
                          <li>• <strong>Out of Compliance:</strong> When regulations fall out of compliance status</li>
                          <li>• <strong>Due Date Alerts:</strong> When deadlines approach or are overdue</li>
                          <li>• <strong>No Spam:</strong> Compliant regulations with no upcoming deadlines won't trigger notifications</li>
                        </ul>
                      </div>
                      
                      <div>
                        <p className="font-medium mb-1">Frequency Options:</p>
                        <ul className="ml-4 space-y-1">
                          <li>• <strong>Daily:</strong> Check for compliance issues every day at 9:00 AM</li>
                          <li>• <strong>Weekly:</strong> Check for compliance issues every Monday at 9:00 AM (recommended)</li>
                          <li>• <strong>Monthly:</strong> Check for compliance issues on the 1st of each month at 9:00 AM</li>
                        </ul>
                      </div>
                      
                      <div className="pt-1 border-t border-blue-200">
                        <p><strong>Note:</strong> SMS notifications require a valid phone number in your profile.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification List */}
              {notifications?.map((notification) => (
                <div 
                  key={notification.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {notification.enabled ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                    
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 mb-2">
                        {notification.type === 'email' ? 'Email' : 'SMS'} Notification
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Frequency:</span>
                        <select
                          value={notification.frequency}
                          onChange={(e) => handleFrequencyChange(notification.id, e.target.value)}
                          className="w-auto min-w-[120px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Enabled:</span>
                      <Switch
                        checked={notification.enabled}
                        onCheckedChange={(checked) => handleToggleEnabled(notification.id, checked)}
                      />
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteNotification(notification.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!notifications || notifications.length === 0) && (
                <p className="text-gray-500 text-center py-4">
                  No notifications found
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
