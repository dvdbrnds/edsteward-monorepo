import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  BellOff, 
  AlertTriangle, 
  User, 
  Calendar,
  Shield,
  Loader2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';

interface NotificationOverrideControlProps {
  regulationId: number;
  regulationName: string;
}

interface NotificationStatus {
  regulationId: number;
  regulationName: string;
  notificationsDisabled: boolean;
  notificationsDisabledBy: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  notificationsDisabledAt: string | null;
  notificationsDisabledReason: string | null;
}

export function NotificationOverrideControl({ regulationId, regulationName }: NotificationOverrideControlProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);

  // Check if user has permission to modify notification overrides
  const hasPermission = user && (
    user.role === 'admin' ||
    user.role === 'compliance_officer' ||
    user.role === 'cco' ||
    user.role === 'legal' ||
    user.username === 'dvdbrnds' ||
    (user.roles && (
      user.roles.includes('admin') ||
      user.roles.includes('compliance_officer') ||
      user.roles.includes('cco') ||
      user.roles.includes('legal')
    ))
  );

  // Fetch notification status
  const { data: notificationStatus, isLoading } = useQuery<NotificationStatus>({
    queryKey: [`/api/regulation-notifications/${regulationId}/status`],
    queryFn: async () => {
      const response = await fetch(`/api/regulation-notifications/${regulationId}/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch notification status');
      }
      return response.json();
    },
    enabled: !!regulationId && hasPermission,
  });

  // Toggle notification override mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ disabled, reason }: { disabled: boolean; reason: string }) => {
      const response = await fetch(`/api/regulation-notifications/${regulationId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ disabled, reason }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle notification override');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/regulation-notifications/${regulationId}/status`] });
      queryClient.invalidateQueries({ queryKey: ["/api/regulations", regulationId.toString()] });
      
      toast({
        title: "Notification Override Updated",
        description: data.regulation.notificationsDisabled 
          ? "Notifications have been disabled for this regulation"
          : "Notifications have been re-enabled for this regulation",
      });
      
      setReason('');
      setShowReasonInput(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update notification override",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (disabled: boolean) => {
    if (disabled && !showReasonInput) {
      setShowReasonInput(true);
      return;
    }
    
    if (disabled && !reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for disabling notifications",
        variant: "destructive",
      });
      return;
    }
    
    toggleMutation.mutate({ disabled, reason: reason.trim() });
  };

  // Don't render if user doesn't have permission
  if (!hasPermission) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="border-yellow-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-yellow-600" />
            Notification Override
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2 text-sm text-gray-600">Loading notification status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!notificationStatus) {
    return null;
  }

  const isDisabled = notificationStatus.notificationsDisabled;

  return (
    <Card className={`border-2 ${isDisabled ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {isDisabled ? (
            <BellOff className="h-5 w-5 text-red-600" />
          ) : (
            <Bell className="h-5 w-5 text-yellow-600" />
          )}
          Notification Override
          <Badge variant={isDisabled ? "destructive" : "secondary"} className="ml-2">
            {isDisabled ? "DISABLED" : "ACTIVE"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">
              Compliance notifications are {isDisabled ? 'disabled' : 'enabled'}
            </span>
          </div>
          <Switch
            checked={!isDisabled}
            onCheckedChange={(checked) => handleToggle(!checked)}
            disabled={toggleMutation.isPending}
          />
        </div>

        {/* Override Information */}
        {isDisabled && notificationStatus.notificationsDisabledBy && (
          <div className="bg-white border border-red-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Disabled by:</span>
              <span>
                {notificationStatus.notificationsDisabledBy.firstName} {notificationStatus.notificationsDisabledBy.lastName}
              </span>
              <span className="text-gray-500">({notificationStatus.notificationsDisabledBy.email})</span>
            </div>
            
            {notificationStatus.notificationsDisabledAt && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Disabled on:</span>
                <span>{format(new Date(notificationStatus.notificationsDisabledAt), 'PPP p')}</span>
              </div>
            )}
            
            {notificationStatus.notificationsDisabledReason && (
              <div className="text-sm">
                <span className="font-medium">Reason:</span>
                <p className="mt-1 text-gray-700 italic">"{notificationStatus.notificationsDisabledReason}"</p>
              </div>
            )}
          </div>
        )}

        {/* Reason Input (when disabling) */}
        {showReasonInput && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 mb-2">
                  Please provide a reason for disabling notifications:
                </p>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Regulation is no longer applicable, compliance completed, etc."
                  className="min-h-[80px]"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => handleToggle(true)}
                disabled={!reason.trim() || toggleMutation.isPending}
                variant="destructive"
                size="sm"
              >
                {toggleMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Disabling...
                  </>
                ) : (
                  'Disable Notifications'
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowReasonInput(false);
                  setReason('');
                }}
                variant="outline"
                size="sm"
                disabled={toggleMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Warning Message */}
        <div className="bg-white border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Important:</p>
              <p>
                {isDisabled 
                  ? "This regulation will not send any compliance deadline notifications until re-enabled."
                  : "This regulation follows the standard compliance notification timeline (90-60-30-7-1 days + overdue escalation)."}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

