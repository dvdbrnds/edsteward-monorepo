/**
 * Notification Scheduler Settings Component
 * Allows admins to enable/disable and monitor the task notification scheduler
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Bell, 
  Clock, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Play,
  Loader2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  intervalHours: number;
  preferredHours: number[];
}

export function NotificationSchedulerSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch scheduler status
  const { data: status, isLoading, error } = useQuery<SchedulerStatus>({
    queryKey: ['/api/compliance-tasks/notifications/scheduler-status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Toggle scheduler mutation
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest('POST', '/api/compliance-tasks/notifications/scheduler-toggle', {
        enabled,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/compliance-tasks/notifications/scheduler-status'] });
      toast({
        title: data.status.enabled ? 'Scheduler Enabled' : 'Scheduler Disabled',
        description: data.status.enabled 
          ? 'Task notifications will be sent automatically.'
          : 'Automatic task notifications are now disabled.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to toggle scheduler',
        variant: 'destructive',
      });
    },
  });

  // Manual check mutation
  const manualCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/compliance-tasks/notifications/check', {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Notification Check Complete',
        description: `Checked ${data.results?.tasksChecked || 0} tasks, sent ${data.results?.notificationsSent || 0} notifications`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to run notification check',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <p className="text-red-600">Failed to load scheduler status</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Scheduler Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Task Notification Scheduler
          </CardTitle>
          <CardDescription>
            Automatically send reminder notifications for upcoming and overdue tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-background rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="scheduler-toggle" className="text-base font-medium">
                Automatic Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, the system will automatically send task reminders.
              </p>
            </div>
            <Switch
              id="scheduler-toggle"
              checked={status?.enabled || false}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
          </div>

          {/* Status Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {status?.enabled ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="font-medium">Status</span>
              </div>
              <Badge variant={status?.enabled ? 'default' : 'secondary'}>
                {status?.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Schedule</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {status?.preferredHours?.map(h => 
                  `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`
                ).join(' & ') || 'Not set'}
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-5 w-5 text-purple-500" />
                <span className="font-medium">Interval</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Every {status?.intervalHours || 6} hours
              </p>
            </div>
          </div>

          {/* Notification Rules */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Notification Rules</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Reminders sent 7, 3, and 1 day(s) before due date</li>
              <li>• Escalation notifications after 3 days overdue</li>
              <li>• Notifications sent to assigned DRI and escalation contacts</li>
            </ul>
          </div>

          {/* Manual Run Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={() => manualCheckMutation.mutate()}
              disabled={manualCheckMutation.isPending}
              variant="outline"
            >
              {manualCheckMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run Manual Check Now
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Manually trigger a notification check for all tasks.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default NotificationSchedulerSettings;


