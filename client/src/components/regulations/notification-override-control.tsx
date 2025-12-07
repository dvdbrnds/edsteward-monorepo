import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  BellOff, 
  AlertTriangle, 
  Loader2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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
  hasCustomSchedule?: boolean;
}

export function NotificationOverrideControl({ regulationId }: NotificationOverrideControlProps) {
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
        credentials: 'include',
        body: JSON.stringify({ disabled, reason }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update notification override');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/regulation-notifications/${regulationId}/status`] });
      const isNowDisabled = data.regulation?.notificationsDisabled ?? data.notificationsDisabled;
      toast({
        title: isNowDisabled ? "Notifications Disabled" : "Notifications Enabled",
        description: isNowDisabled 
          ? "Compliance notifications have been disabled for this regulation"
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
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  // Show default state if API fails - assume standard notifications enabled
  const isDisabled = notificationStatus?.notificationsDisabled ?? false;
  const hasCustomSchedule = notificationStatus?.hasCustomSchedule ?? false;


  // Determine badge state
  const getBadgeContent = () => {
    if (isDisabled) {
      return {
        icon: <BellOff className="h-3 w-3" />,
        text: "Disabled",
        className: "bg-red-100 text-red-700 border-red-200"
      };
    }
    if (hasCustomSchedule) {
      return {
        icon: <Bell className="h-3 w-3" />,
        text: "Custom",
        className: "bg-yellow-100 text-yellow-700 border-yellow-200"
      };
    }
    return {
      icon: <Bell className="h-3 w-3" />,
      text: "Standard (90-60-30-7-1)",
      className: "bg-green-100 text-green-700 border-green-200"
    };
  };

  const badge = getBadgeContent();

  return (
    <div className="space-y-2">
      {/* Inline notification status */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Notifications:</span>
        <Badge 
          variant="outline" 
          className={`${badge.className} flex items-center gap-1 font-medium`}
        >
          {badge.icon}
          {badge.text}
        </Badge>
        <Switch
          checked={!isDisabled}
          onCheckedChange={(checked) => handleToggle(!checked)}
          disabled={toggleMutation.isPending}
          className="ml-1"
        />
      </div>

      {/* Reason input when disabling */}
      {showReasonInput && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2 mt-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-yellow-800 mb-2">
                Reason for disabling:
              </p>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Regulation no longer applicable..."
                className="min-h-[60px] text-sm"
              />
            </div>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => {
                setShowReasonInput(false);
                setReason('');
              }}
              variant="ghost"
              size="sm"
              disabled={toggleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleToggle(true)}
              disabled={!reason.trim() || toggleMutation.isPending}
              variant="destructive"
              size="sm"
            >
              {toggleMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Saving...
                </>
              ) : (
                'Disable'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
