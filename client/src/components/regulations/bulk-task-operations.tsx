/**
 * Bulk Task Operations Component
 * 
 * Provides UI for bulk operations on compliance tasks:
 * - Select multiple tasks
 * - Bulk assign DRIs
 * - Bulk update status
 * - Bulk send notifications
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  Square,
  Users,
  Bell,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ComplianceTask {
  id: number;
  title: string;
  status: string;
  assignedTo?: number;
  dueDate?: string;
}

interface User {
  id: number;
  firstName?: string;
  lastName?: string;
  username: string;
  email: string;
}

interface BulkTaskOperationsProps {
  regulationId: number;
  tasks: ComplianceTask[];
  selectedTaskIds: number[];
  onSelectionChange: (taskIds: number[]) => void;
  isAdmin: boolean;
}

export function BulkTaskOperations({
  regulationId,
  tasks,
  selectedTaskIds,
  onSelectionChange,
  isAdmin,
}: BulkTaskOperationsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'assign' | 'status' | 'notify';
    value?: string | number;
    label?: string;
  } | null>(null);

  // Fetch users for assignment
  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: isAdmin,
  });

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async ({ taskIds, userId }: { taskIds: number[]; userId: number | null }) => {
      const response = await apiRequest('POST', '/api/compliance-tasks/bulk/assign', {
        taskIds,
        userId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/compliance-tasks/regulation/${regulationId}`] });
      toast({
        title: 'Tasks Updated',
        description: `Successfully assigned ${selectedTaskIds.length} tasks`,
      });
      onSelectionChange([]);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to assign tasks',
        variant: 'destructive',
      });
    },
  });

  // Bulk status mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async ({ taskIds, status }: { taskIds: number[]; status: string }) => {
      const response = await apiRequest('POST', '/api/compliance-tasks/bulk/status', {
        taskIds,
        status,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/compliance-tasks/regulation/${regulationId}`] });
      toast({
        title: 'Tasks Updated',
        description: `Successfully updated status for ${selectedTaskIds.length} tasks`,
      });
      onSelectionChange([]);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive',
      });
    },
  });

  // Bulk notify mutation
  const bulkNotifyMutation = useMutation({
    mutationFn: async ({ taskIds, notificationType }: { taskIds: number[]; notificationType: string }) => {
      const response = await apiRequest('POST', '/api/compliance-tasks/bulk/notify', {
        taskIds,
        notificationType,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Notifications Sent',
        description: `Successfully sent ${data.results?.filter((r: { success: boolean }) => r.success).length || 0} notifications`,
      });
      onSelectionChange([]);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send notifications',
        variant: 'destructive',
      });
    },
  });

  const handleSelectAll = () => {
    if (selectedTaskIds.length === tasks.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(tasks.map(t => t.id));
    }
  };

  const handleBulkAction = (action: typeof pendingAction) => {
    setPendingAction(action);
    setShowConfirmDialog(true);
  };

  const executeAction = () => {
    if (!pendingAction) return;

    switch (pendingAction.type) {
      case 'assign':
        bulkAssignMutation.mutate({
          taskIds: selectedTaskIds,
          userId: pendingAction.value as number | null,
        });
        break;
      case 'status':
        bulkStatusMutation.mutate({
          taskIds: selectedTaskIds,
          status: pendingAction.value as string,
        });
        break;
      case 'notify':
        bulkNotifyMutation.mutate({
          taskIds: selectedTaskIds,
          notificationType: pendingAction.value as string,
        });
        break;
    }

    setShowConfirmDialog(false);
    setPendingAction(null);
  };

  const isLoading = bulkAssignMutation.isPending || bulkStatusMutation.isPending || bulkNotifyMutation.isPending;

  const getUserDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username || user.email;
  };

  if (!isAdmin || tasks.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 p-3 bg-background border-b">
        {/* Select All */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSelectAll}
          className="gap-2"
        >
          {selectedTaskIds.length === tasks.length ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {selectedTaskIds.length === tasks.length ? 'Deselect All' : 'Select All'}
        </Button>

        {selectedTaskIds.length > 0 && (
          <>
            <Badge variant="secondary" className="ml-2">
              {selectedTaskIds.length} selected
            </Badge>

            <div className="flex-1" />

            {/* Bulk Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4 mr-2" />
                  )}
                  Assign
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleBulkAction({ type: 'assign', value: undefined, label: 'Unassigned' })}
                >
                  Unassign
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {users?.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => handleBulkAction({ 
                      type: 'assign', 
                      value: user.id, 
                      label: getUserDisplayName(user) 
                    })}
                  >
                    {getUserDisplayName(user)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleBulkAction({ type: 'status', value: 'pending', label: 'Pending' })}
                >
                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                  Pending
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleBulkAction({ type: 'status', value: 'in_progress', label: 'In Progress' })}
                >
                  <Clock className="h-4 w-4 mr-2 text-blue-500" />
                  In Progress
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleBulkAction({ type: 'status', value: 'completed', label: 'Completed' })}
                >
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  Completed
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleBulkAction({ type: 'status', value: 'blocked', label: 'Blocked' })}
                >
                  <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                  Blocked
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleBulkAction({ type: 'notify', value: 'nudge', label: 'Nudge Reminder' })}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Nudge All
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectionChange([])}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Action</DialogTitle>
            <DialogDescription>
              {pendingAction?.type === 'assign' && (
                <>
                  Assign {selectedTaskIds.length} task(s) to{' '}
                  <strong>{pendingAction.label || 'Unassigned'}</strong>?
                </>
              )}
              {pendingAction?.type === 'status' && (
                <>
                  Update status of {selectedTaskIds.length} task(s) to{' '}
                  <strong>{pendingAction.label}</strong>?
                </>
              )}
              {pendingAction?.type === 'notify' && (
                <>
                  Send {pendingAction.label} notifications for {selectedTaskIds.length} task(s)?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={executeAction}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BulkTaskOperations;

