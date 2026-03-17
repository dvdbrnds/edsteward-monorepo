/**
 * Task Detail Dialog
 * 
 * Shows full task details with:
 * - Task information and status
 * - Evidence upload and management
 * - Activity log
 * - Quick actions (complete, nudge, escalate)
 */

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  FileText,
  Link as LinkIcon,
  Image,
  Upload,
  Trash2,
  Download,
  ExternalLink,
  Send,
  AlertCircle,
  User as UserIcon,
  Calendar,
  Loader2,
  PenLine,
  MessageSquare,
  History,
  Paperclip,
  File,
  X,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface User {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailStatus?: string;
}

interface TaskEvidence {
  id: number;
  taskId: number;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  linkUrl: string | null;
  linkTitle: string | null;
  description: string | null;
  uploadedBy: number;
  uploadedByUser?: User;
  uploadedAt: string;
}

interface TaskActivity {
  id: number;
  taskId: number;
  userId: number;
  user?: User;
  activityType: string;
  content: string | null;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface ComplianceTask {
  id: number;
  regulationId: number;
  parentTaskId: number | null;
  taskId: string | null; // Unique task identifier (e.g., GLBA-001) - MCP Engine sync Jan 2026
  title: string;
  description: string | null;
  instructions: string | null;
  assignedTo: number | null;
  assignedRole: string | null;
  dueDate: string | null;
  status: string;
  priority: string;
  requirementType: 'requirement' | 'best_practice' | null; // MCP Engine sync Jan 2026
  completedAt: string | null;
  completedByUser?: User | null;
  evidenceRequired: boolean;
  evidenceType: string;
  evidenceInstructions: string | null;
  sortOrder: number;
  assignedUser?: User | null;
  evidenceCount: number;
  // Escalation path
  escalationEmail: string | null;
  escalationName: string | null;
}

interface TaskDetailDialogProps {
  task: ComplianceTask | null;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  regulationId: number;
  isAdmin?: boolean;
  onStatusChange: (_taskId: number, _status: string) => void;
  onScrollToFullText?: () => void;
}

const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="h-5 w-5 text-green-600" />,
  in_progress: <Clock className="h-5 w-5 text-blue-600" />,
  pending: <Circle className="h-5 w-5 text-muted-foreground" />,
  overdue: <AlertTriangle className="h-5 w-5 text-red-600" />,
  blocked: <AlertCircle className="h-5 w-5 text-amber-600" />,
};

const statusLabels: Record<string, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  pending: 'Pending',
  overdue: 'Overdue',
  blocked: 'Blocked',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-blue-100 text-blue-800 border-blue-200',
  low: 'bg-gray-100 text-foreground border-border',
};

// Requirement type styling (MCP Engine sync Jan 2026)
const requirementTypeStyles: Record<string, { label: string; className: string; description: string }> = {
  requirement: { 
    label: 'Required', 
    className: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Legally mandated - non-compliance may result in violations'
  },
  best_practice: { 
    label: 'Best Practice', 
    className: 'bg-teal-100 text-teal-700 border-teal-200',
    description: 'Recommended but not legally required'
  },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getActivityIcon(type: string): React.ReactNode {
  switch (type) {
    case 'comment': return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case 'status_change': return <History className="h-4 w-4 text-purple-500" />;
    case 'evidence_uploaded': return <Paperclip className="h-4 w-4 text-green-500" />;
    case 'nudge': return <Send className="h-4 w-4 text-amber-500" />;
    case 'escalation': return <AlertCircle className="h-4 w-4 text-red-500" />;
    default: return <History className="h-4 w-4 text-muted-foreground" />;
  }
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  regulationId,
  isAdmin,
  onStatusChange,
  onScrollToFullText,
}: TaskDetailDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [uploadType, setUploadType] = useState<'file' | 'link'>('file');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [comment, setComment] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showAssignSelect, setShowAssignSelect] = useState(false);

  // Fetch users for assignment
  const { data: availableUsers } = useQuery<User[]>({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: !!isAdmin && open,
  });

  // Assign DRI mutation
  const assignDriMutation = useMutation({
    mutationFn: async (userId: number | null) => {
      const res = await fetch(`/api/compliance-tasks/${task?.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: userId }),
      });
      if (!res.ok) throw new Error('Failed to assign task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-tasks', regulationId] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', task?.id] });
      // Also refresh the "My Tasks" dashboard widget
      queryClient.invalidateQueries({ queryKey: ['/api/compliance-tasks/my-tasks'] });
      toast({ title: 'Task assigned successfully' });
      setShowAssignSelect(false);
    },
    onError: () => {
      toast({ title: 'Failed to assign task', variant: 'destructive' });
    },
  });

  // Fetch evidence for task
  const { data: evidence, isLoading: evidenceLoading } = useQuery<TaskEvidence[]>({
    queryKey: ['task-evidence', task?.id],
    queryFn: async () => {
      if (!task) return [];
      const res = await fetch(`/api/compliance-tasks/${task.id}/evidence`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch evidence');
      return res.json();
    },
    enabled: !!task && open,
  });

  // Fetch activity for task
  const { data: activity, isLoading: activityLoading } = useQuery<TaskActivity[]>({
    queryKey: ['task-activity', task?.id],
    queryFn: async () => {
      if (!task) return [];
      const res = await fetch(`/api/compliance-tasks/${task.id}/activity`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    enabled: !!task && open,
  });

  // Upload evidence mutation
  const uploadEvidence = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/compliance-tasks/${task?.id}/evidence`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload evidence');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-evidence', task?.id] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', task?.id] });
      queryClient.invalidateQueries({ queryKey: ['compliance-tasks', regulationId] });
      toast({ title: 'Evidence uploaded successfully' });
      setDescription('');
      setLinkUrl('');
      setLinkTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (error: Error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });

  // Delete evidence mutation
  const deleteEvidence = useMutation({
    mutationFn: async (evidenceId: number) => {
      const res = await fetch(`/api/compliance-tasks/${task?.id}/evidence/${evidenceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete evidence');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-evidence', task?.id] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', task?.id] });
      queryClient.invalidateQueries({ queryKey: ['compliance-tasks', regulationId] });
      toast({ title: 'Evidence deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete evidence', variant: 'destructive' });
    },
  });

  // Add comment mutation
  const addComment = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/compliance-tasks/${task?.id}/activity`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityType: 'comment', content }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-activity', task?.id] });
      toast({ title: 'Comment added' });
      setComment('');
    },
    onError: () => {
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('description', description);

    try {
      await uploadEvidence.mutateAsync(formData);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkSubmit = async () => {
    if (!linkUrl.trim()) {
      toast({ title: 'Please enter a URL', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('linkUrl', linkUrl);
    formData.append('linkTitle', linkTitle || linkUrl);
    formData.append('description', description);

    try {
      await uploadEvidence.mutateAsync(formData);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    addComment.mutate(comment);
  };

  if (!task) return null;

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const displayStatus = isOverdue ? 'overdue' : task.status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {statusIcons[displayStatus] || statusIcons.pending}
            <div className="flex-1">
              <DialogTitle className="text-xl">{task.title}</DialogTitle>
              <DialogDescription className="mt-1">
                {task.description || 'No description provided'}
              </DialogDescription>
            </div>
            <Badge variant="outline" className={cn("shrink-0", priorityColors[task.priority])}>
              {task.priority}
            </Badge>
            {/* Requirement Type Badge (MCP Engine sync Jan 2026) */}
            {task.requirementType && requirementTypeStyles[task.requirementType] && (
              <Badge 
                variant="outline" 
                className={cn("shrink-0", requirementTypeStyles[task.requirementType].className)}
                title={requirementTypeStyles[task.requirementType].description}
              >
                {requirementTypeStyles[task.requirementType].label}
              </Badge>
            )}
          </div>
          {/* Task ID display (MCP Engine sync Jan 2026) */}
          {task.taskId && (
            <div className="text-xs text-muted-foreground mt-1">
              Task ID: {task.taskId}
            </div>
          )}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="evidence">
              Evidence {evidence && evidence.length > 0 && `(${evidence.length})`}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Status & Actions */}
            <div className="flex items-center justify-between p-4 bg-background rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                <Badge variant="outline" className={cn(
                  displayStatus === 'completed' && 'bg-green-100 text-green-800',
                  displayStatus === 'in_progress' && 'bg-blue-100 text-blue-800',
                  displayStatus === 'pending' && 'bg-gray-100 text-foreground',
                  displayStatus === 'overdue' && 'bg-red-100 text-red-800',
                )}>
                  {statusLabels[displayStatus] || displayStatus}
                </Badge>
              </div>
              {isAdmin && task.status !== 'completed' && (
                <Button 
                  size="sm" 
                  onClick={() => {
                    onStatusChange(task.id, 'completed');
                    onOpenChange(false);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              )}
            </div>

            {/* Completion Signature */}
            {task.status === 'completed' && task.completedAt && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <PenLine className="h-4 w-4 text-green-700" />
                  <span className="font-medium text-green-800">Signed:</span>
                  <span className="text-green-700">
                    {task.completedByUser 
                      ? (task.completedByUser.firstName && task.completedByUser.lastName
                          ? `${task.completedByUser.firstName} ${task.completedByUser.lastName}`
                          : task.completedByUser.username || task.completedByUser.email)
                      : task.attestationSignature
                        ? task.attestationSignature.match(/attested by ([^\n]+) on/)?.[1] || 'External Attester'
                        : 'Unknown'}
                    {task.completedByUser?.email && (
                      <span className="text-green-600 ml-1">({task.completedByUser.email})</span>
                    )}
                  </span>
                  <span className="text-green-600">•</span>
                  <span className="text-green-700">
                    {format(new Date(task.completedAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
              </div>
            )}

            {/* Task Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Assigned To */}
              <div className="p-3 bg-background rounded-lg">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    Assigned To
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      aria-expanded={showAssignSelect}
                      onClick={() => setShowAssignSelect(!showAssignSelect)}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      {task.assignedUser ? 'Change' : 'Assign'}
                    </Button>
                  )}
                </div>
                
                {showAssignSelect && isAdmin ? (
                  <div className="space-y-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start font-normal"
                          disabled={assignDriMutation.isPending}
                        >
                          {task.assignedTo && task.assignedUser
                            ? (task.assignedUser.firstName && task.assignedUser.lastName
                              ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}`
                              : task.assignedUser.username || task.assignedUser.email)
                            : <span className="text-muted-foreground">Select a person...</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search users..." className="h-9" />
                          <CommandList>
                            <CommandEmpty>No users found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__unassign__"
                                onSelect={() => assignDriMutation.mutate(null)}
                              >
                                <span className="text-muted-foreground italic">Unassigned</span>
                              </CommandItem>
                              {availableUsers?.map((user) => {
                                const displayName = user.firstName && user.lastName
                                  ? `${user.firstName} ${user.lastName}`
                                  : user.username || user.email || `User #${user.id}`;
                                const showEmail = user.email && displayName !== user.email;
                                return (
                                  <CommandItem
                                    key={user.id}
                                    value={`${displayName} ${user.email || ''}`}
                                    onSelect={() => assignDriMutation.mutate(user.id)}
                                    className={cn(
                                      task.assignedTo === user.id && "bg-primary/10"
                                    )}
                                  >
                                    <div className="flex flex-col">
                                      <span>{displayName}</span>
                                      {showEmail && (
                                        <span className="text-xs text-muted-foreground">{user.email}</span>
                                      )}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {task.assignedRole && (
                      <div className="text-xs text-muted-foreground">
                        Suggested role: <span className="font-medium">{task.assignedRole}</span>
                        {task.responsibleOffice && (
                          <span className="ml-1">({task.responsibleOffice})</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="font-medium">
                      {task.responsibleOffice && task.assignedUser
                        ? `${task.responsibleOffice} — ${task.assignedUser.firstName && task.assignedUser.lastName ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}` : task.assignedUser.username}`
                        : task.responsibleOffice || (task.assignedUser 
                            ? (task.assignedUser.firstName && task.assignedUser.lastName
                                ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}`
                                : task.assignedUser.username)
                            : task.assignedRole || 'Unassigned')}
                    </div>
                    {task.assignedUser?.email && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {task.assignedUser.email}
                        {task.assignedUser.emailStatus === 'bounced' && (
                          <span className="inline-flex items-center gap-0.5 text-red-600 font-medium" title="Emails to this address are bouncing">
                            <AlertCircle className="h-3 w-3" />
                            bounced
                          </span>
                        )}
                      </div>
                    )}
                    {task.responsibleOfficeEmail && (
                      <div className="text-xs text-muted-foreground">{task.responsibleOfficeEmail}</div>
                    )}
                    {!task.assignedUser && task.assignedRole && (
                      <div className="text-xs text-amber-600 mt-1">
                        Click "Assign" to assign a person
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Due Date */}
              <div className="p-3 bg-background rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  Due Date
                </div>
                <div className={cn("font-medium", isOverdue && "text-red-600")}>
                  {task.dueDate 
                    ? format(new Date(task.dueDate), 'MMM d, yyyy')
                    : 'No due date'}
                </div>
                {isOverdue && (
                  <div className="text-xs text-red-500">Overdue</div>
                )}
              </div>
            </div>

            {/* Instructions */}
            {task.instructions && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Instructions</h4>
                <p className="text-sm text-blue-800 whitespace-pre-wrap">{task.instructions}</p>
              </div>
            )}

            {/* Statute Reference */}
            {task.statutoryCitation && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-medium text-amber-900 mb-1 text-sm">Statute Reference</h4>
                <p className="text-sm text-amber-800">{task.statutoryCitation}</p>
                {onScrollToFullText && (
                  <button
                    type="button"
                    onClick={() => { onOpenChange(false); setTimeout(() => onScrollToFullText(), 150); }}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View in full regulation text
                  </button>
                )}
              </div>
            )}

            {/* Escalation Contact */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Escalation Contact
              </h4>
              {task.escalationEmail || task.escalationName ? (
                <div className="text-sm text-red-800">
                  <p className="font-medium">{task.escalationName || 'Supervisor'}</p>
                  {task.escalationEmail && (
                    <p className="text-red-600">{task.escalationEmail}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-600 italic">No escalation contact defined</p>
              )}
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs border-red-300 text-red-700 hover:bg-red-100"
                  onClick={() => {
                    const name = prompt('Escalation contact name (e.g., VP of Student Affairs):', task.escalationName || '');
                    if (name !== null) {
                      const email = prompt('Escalation contact email:', task.escalationEmail || '');
                      if (email !== null) {
                        // Update via API
                        fetch(`/api/compliance-tasks/${task.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ escalationName: name || null, escalationEmail: email || null })
                        }).then(() => {
                          // Invalidate queries to refresh
                          window.location.reload();
                        });
                      }
                    }
                  }}
                >
                  {task.escalationEmail ? 'Edit' : 'Set'} Escalation Contact
                </Button>
              )}
            </div>

            {/* Evidence Requirements */}
            {task.evidenceRequired && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Evidence Required
                </h4>
                <p className="text-sm text-amber-800">
                  {task.evidenceInstructions || `Please provide ${task.evidenceType || 'documentation'} to complete this task.`}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Evidence Tab */}
          <TabsContent value="evidence" className="space-y-4 mt-4">
            {/* Upload Section */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">Add Evidence</h4>
              
              <div className="flex gap-2 mb-4">
                <Button
                  variant={uploadType === 'file' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUploadType('file')}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
                <Button
                  variant={uploadType === 'link' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUploadType('link')}
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Add Link
                </Button>
              </div>

              {uploadType === 'file' ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="file">File</Label>
                    <input
                      ref={fileInputRef}
                      id="file"
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPendingFile(file);
                        }
                      }}
                      disabled={isUploading}
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={pendingFile ? `Selected file: ${pendingFile.name}. Press to change file.` : 'Click or drag to upload evidence file'}
                      onClick={() => !isUploading && fileInputRef.current?.click()}
                      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isUploading) { e.preventDefault(); fileInputRef.current?.click(); } }}
                      onDragOver={(e) => { e.preventDefault(); if (!isUploading) setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        if (!isUploading && e.dataTransfer.files.length > 0) {
                          setPendingFile(e.dataTransfer.files[0]);
                        }
                      }}
                      className={cn(
                        "mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                        isUploading && "opacity-50 cursor-not-allowed",
                        isDragOver 
                          ? "border-primary bg-primary/5" 
                          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                        pendingFile && "border-green-500 bg-green-50"
                      )}
                    >
                      {pendingFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <File className="h-6 w-6 text-green-600" />
                          <div className="text-left">
                            <p className="font-medium text-foreground text-sm">{pendingFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-2"
                            disabled={isUploading}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              Click to browse or drag & drop
                            </p>
                            <p className="text-xs text-muted-foreground">
                              PDF, DOC, XLS, or images up to 10MB
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="file-description">Description (optional)</Label>
                    <Input
                      id="file-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe this evidence..."
                      disabled={isUploading}
                      className="mt-1"
                    />
                  </div>
                  {pendingFile && (
                    <Button
                      onClick={() => {
                        // Trigger upload with the pending file
                        const event = { target: { files: [pendingFile] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                        handleFileUpload(event);
                        setPendingFile(null);
                      }}
                      disabled={isUploading}
                      className="w-full"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload File
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="link-url">URL</Label>
                    <Input
                      id="link-url"
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://..."
                      disabled={isUploading}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="link-title">Title</Label>
                    <Input
                      id="link-title"
                      value={linkTitle}
                      onChange={(e) => setLinkTitle(e.target.value)}
                      placeholder="Link title..."
                      disabled={isUploading}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="link-description">Description (optional)</Label>
                    <Input
                      id="link-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe this evidence..."
                      disabled={isUploading}
                      className="mt-1"
                    />
                  </div>
                  <Button 
                    onClick={handleLinkSubmit} 
                    disabled={isUploading || !linkUrl.trim()}
                    className="w-full"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Add Link
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Evidence List */}
            <div className="border rounded-lg">
              <div className="p-3 border-b bg-background">
                <h4 className="font-medium">Uploaded Evidence</h4>
              </div>
              
              {evidenceLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : evidence && evidence.length > 0 ? (
                <div className="divide-y">
                  {evidence.map((item) => (
                    <div key={item.id} className="p-3 flex items-center gap-3 hover:bg-background">
                      <div className="p-2 bg-gray-100 rounded">
                        {item.linkUrl ? (
                          <LinkIcon className="h-5 w-5 text-blue-600" />
                        ) : item.fileType?.startsWith('image/') ? (
                          <Image className="h-5 w-5 text-purple-600" />
                        ) : (
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {item.linkTitle || item.fileName}
                        </div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {item.uploadedByUser && (
                            <span>
                              {item.uploadedByUser.firstName && item.uploadedByUser.lastName
                                ? `${item.uploadedByUser.firstName} ${item.uploadedByUser.lastName}`
                                : item.uploadedByUser.username}
                              {' • '}
                            </span>
                          )}
                          {format(new Date(item.uploadedAt), 'MMM d, yyyy')}
                          {item.fileSize && ` • ${formatFileSize(item.fileSize)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {item.linkUrl ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Open link in new tab"
                            onClick={() => window.open(item.linkUrl!, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        ) : item.fileUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Download file"
                            onClick={() => window.open(item.fileUrl!, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Delete evidence"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (confirm('Delete this evidence?')) {
                                deleteEvidence.mutate(item.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Paperclip className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No evidence uploaded yet</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            {/* Add Comment */}
            <div className="flex gap-2">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1"
                rows={2}
              />
              <Button 
                onClick={handleAddComment}
                disabled={!comment.trim() || addComment.isPending}
              >
                {addComment.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Activity List */}
            <div className="border rounded-lg">
              <div className="p-3 border-b bg-background">
                <h4 className="font-medium">Activity Log</h4>
              </div>
              
              {activityLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : activity && activity.length > 0 ? (
                <div className="divide-y">
                  {activity.map((item) => (
                    <div key={item.id} className="p-3 flex items-start gap-3">
                      <div className="mt-0.5">
                        {getActivityIcon(item.activityType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <span className="font-medium">
                            {item.user
                              ? (item.user.firstName && item.user.lastName
                                  ? `${item.user.firstName} ${item.user.lastName}`
                                  : item.user.username)
                              : 'System'}
                          </span>
                          {' '}
                          {item.activityType === 'comment' && 'commented'}
                          {item.activityType === 'status_change' && (
                            <>changed status from <Badge variant="outline" className="mx-1">{item.previousValue}</Badge> to <Badge variant="outline" className="mx-1">{item.newValue}</Badge></>
                          )}
                          {item.activityType === 'evidence_uploaded' && 'uploaded evidence'}
                          {item.activityType === 'nudge' && 'sent a reminder'}
                          {item.activityType === 'escalation' && 'escalated this task'}
                        </div>
                        {item.content && (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.content}</p>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(item.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No activity yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

