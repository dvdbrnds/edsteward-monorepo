/**
 * Compliance Tasks Panel
 * 
 * Displays hierarchical compliance tasks for complex regulations.
 * Features:
 * - Task hierarchy with collapsible sub-tasks
 * - Progress tracking
 * - Per-task status management
 * - Nudge and escalate actions
 * - Evidence indicators
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  FileText,
  Link as LinkIcon,
  Image,
  FileCheck,
  MoreHorizontal,
  Send,
  AlertCircle,
  User as UserIcon,
  Calendar,
  Loader2,
  Plus,
  PenLine,
  Upload,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { TaskDetailDialog } from './task-detail-dialog';
import { BulkTaskOperations } from './bulk-task-operations';

interface EvidenceItem {
  id: number;
  fileName: string;
  fileType: string | null;
  fileUrl: string | null;
  linkUrl: string | null;
  linkTitle: string | null;
  description: string | null;
  uploadedAt: string | null;
  uploader: {
    id: number;
    username: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface ComplianceTask {
  id: number;
  regulationId: number;
  parentTaskId: number | null;
  title: string;
  description: string | null;
  instructions: string | null;
  assignedTo: number | null;
  assignedRole: string | null;
  dueDate: string | null;
  status: string;
  priority: string;
  completedAt: string | null;
  completedByUser?: {
    id: number;
    username: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  evidenceRequired: boolean;
  evidenceType: string;
  evidenceInstructions: string | null;
  sortOrder: number;
  assignedUser?: {
    id: number;
    username: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  evidenceCount: number;
  evidenceItems?: EvidenceItem[];
  subTasks: ComplianceTask[];
  // Escalation path
  escalationEmail: string | null;
  escalationName: string | null;
}

interface TasksResponse {
  tasks: ComplianceTask[];
  totalTasks: number;
  completedTasks: number;
  progress: number;
}

interface ComplianceTasksPanelProps {
  regulationId: number;
  regulationName: string;
  isAdmin?: boolean;
}

const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="h-4 w-4 text-green-600" />,
  in_progress: <Clock className="h-4 w-4 text-blue-600" />,
  pending: <Circle className="h-4 w-4 text-gray-400" />,
  overdue: <AlertTriangle className="h-4 w-4 text-red-600" />,
  blocked: <AlertCircle className="h-4 w-4 text-amber-600" />,
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-blue-100 text-blue-800 border-blue-200',
  low: 'bg-gray-100 text-gray-800 border-gray-200',
};

const evidenceIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-3 w-3" />,
  link: <LinkIcon className="h-3 w-3" />,
  screenshot: <Image className="h-3 w-3" />,
  attestation: <FileCheck className="h-3 w-3" />,
  form: <FileText className="h-3 w-3" />,
};

function TaskItem({ 
  task, 
  isAdmin, 
  onStatusChange, 
  onNudge, 
  onEscalate,
  onTaskClick,
  onAddEvidence,
  depth = 0,
  selectedTaskIds = [],
  onToggleSelect,
}: { 
  task: ComplianceTask; 
  isAdmin?: boolean;
  onStatusChange: (_id: number, _newStatus: string) => void;
  onNudge: (_taskToNudge: ComplianceTask) => void;
  onEscalate: (_taskToEscalate: ComplianceTask) => void;
  onTaskClick: (_task: ComplianceTask) => void;
  onAddEvidence: (_task: ComplianceTask) => void;
  depth?: number;
  selectedTaskIds?: number[];
  onToggleSelect?: (_taskId: number) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasSubTasks = task.subTasks && task.subTasks.length > 0;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  const assigneeName = task.assignedUser 
    ? (task.assignedUser.firstName && task.assignedUser.lastName 
        ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}`
        : task.assignedUser.username)
    : task.assignedRole || 'Unassigned';

  return (
    <div className={cn("border-l-2", depth > 0 ? "ml-6 pl-4" : "pl-0", 
      task.status === 'completed' ? 'border-green-300' : 
      isOverdue ? 'border-red-300' : 'border-gray-200')}>
      <div className={cn(
        "flex items-start gap-3 p-3 rounded-lg mb-2 transition-colors",
        task.status === 'completed' ? 'bg-green-50' : 
        isOverdue ? 'bg-red-50' : 'bg-white hover:bg-gray-50',
        selectedTaskIds.includes(task.id) && 'ring-2 ring-blue-500 ring-inset'
      )}>
        {/* Selection Checkbox (admin only) */}
        {isAdmin && onToggleSelect && (
          <Checkbox
            checked={selectedTaskIds.includes(task.id)}
            onCheckedChange={() => onToggleSelect(task.id)}
            className="mt-1"
          />
        )}

        {/* Expand/Collapse */}
        {hasSubTasks ? (
          <button 
            onClick={() => setExpanded(!expanded)}
            className="mt-1 p-0.5 hover:bg-gray-200 rounded"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Status Icon */}
        <button 
          onClick={() => {
            if (task.status === 'completed') {
              onStatusChange(task.id, 'pending');
            } else {
              onStatusChange(task.id, 'completed');
            }
          }}
          className="mt-1"
        >
          {isOverdue && task.status !== 'completed' 
            ? statusIcons.overdue 
            : statusIcons[task.status] || statusIcons.pending}
        </button>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <button 
                onClick={() => onTaskClick(task)}
                className="text-left w-full hover:text-blue-600 transition-colors"
              >
                <h4 className={cn(
                  "font-medium text-sm",
                  task.status === 'completed' && "line-through text-gray-500"
                )}>
                  {task.title}
                </h4>
              </button>
              {task.description && (
                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{task.description}</p>
              )}
            </div>

            {/* Priority Badge */}
            <Badge variant="outline" className={cn("text-xs shrink-0", priorityColors[task.priority])}>
              {task.priority}
            </Badge>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
            {/* Assignee */}
            <div className="flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              <span>{assigneeName}</span>
            </div>

            {/* Due Date */}
            {task.dueDate && (
              <div className={cn("flex items-center gap-1", isOverdue && "text-red-600 font-medium")}>
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
              </div>
            )}

            {/* Evidence Indicator & Add Button */}
            {task.evidenceRequired && (
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center gap-1",
                  task.evidenceCount > 0 ? "text-green-600" : "text-amber-600"
                )}>
                  {evidenceIcons[task.evidenceType] || evidenceIcons.document}
                  <span>{task.evidenceCount > 0 ? `${task.evidenceCount} file(s)` : 'Evidence needed'}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddEvidence(task);
                  }}
                >
                  <Paperclip className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            )}
            {/* Show Add Evidence button even if not required */}
            {!task.evidenceRequired && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddEvidence(task);
                }}
              >
                <Paperclip className="h-3 w-3 mr-1" />
                Add Evidence
              </Button>
            )}

            {/* Sub-task count */}
            {hasSubTasks && (
              <div className="flex items-center gap-1">
                <span>{task.subTasks.filter(t => t.status === 'completed').length}/{task.subTasks.length} subtasks</span>
              </div>
            )}
          </div>

          {/* Completion Signature - Shows who completed and when */}
          {task.status === 'completed' && (
            <div className="mt-2 pt-2 border-t border-green-200 bg-green-50/50 -mx-3 px-3 -mb-3 pb-3 rounded-b-lg">
              <div className="flex items-center gap-2 text-xs">
                <PenLine className="h-3 w-3 text-green-700" />
                <span className="font-medium text-green-800">Signed:</span>
                <span className="text-green-700">
                  {task.completedByUser 
                    ? (task.completedByUser.firstName && task.completedByUser.lastName
                        ? `${task.completedByUser.firstName} ${task.completedByUser.lastName}`
                        : task.completedByUser.username)
                    : 'Unknown'}
                  {task.completedByUser?.email && (
                    <span className="text-green-600 ml-1">({task.completedByUser.email})</span>
                  )}
                </span>
                <span className="text-green-600">•</span>
                <span className="text-green-700">
                  {task.completedAt 
                    ? format(new Date(task.completedAt), "MMM d, yyyy 'at' h:mm a")
                    : '(no timestamp)'}
                </span>
              </div>
            </div>
          )}

          {/* Evidence Items with Signatures */}
          {task.evidenceItems && task.evidenceItems.length > 0 && (
            <div className={cn(
              "mt-2 pt-2 border-t -mx-3 px-3 -mb-3 pb-3 rounded-b-lg space-y-2",
              task.status === 'completed' ? "border-green-200" : "border-blue-200 bg-blue-50/30"
            )}>
              <div className="flex items-center gap-1 text-xs font-medium text-blue-800">
                <Paperclip className="h-3 w-3" />
                Evidence Attached ({task.evidenceItems.length})
              </div>
              {task.evidenceItems.map((evidence) => (
                <HoverCard key={evidence.id}>
                  <HoverCardTrigger asChild>
                    <div className="flex items-start gap-2 text-xs bg-white/60 rounded px-2 py-1.5 border border-blue-100 cursor-pointer hover:bg-white hover:border-blue-200 transition-colors">
                      {/* File type icon */}
                      <div className="p-1 bg-gray-100 rounded shrink-0">
                        {evidence.linkUrl ? (
                          <LinkIcon className="h-3 w-3 text-blue-600" />
                        ) : evidence.fileType?.startsWith('image/') ? (
                          <Image className="h-3 w-3 text-purple-600" />
                        ) : (
                          <FileText className="h-3 w-3 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {evidence.linkUrl ? (
                            <span className="text-blue-600 font-medium truncate">
                              {evidence.linkTitle || evidence.fileName}
                            </span>
                          ) : (
                            <span className="font-medium text-gray-700 truncate">{evidence.fileName}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500">
                          <PenLine className="h-2.5 w-2.5" />
                          <span>
                            {evidence.uploader 
                              ? (evidence.uploader.firstName && evidence.uploader.lastName
                                  ? `${evidence.uploader.firstName} ${evidence.uploader.lastName}`
                                  : evidence.uploader.username)
                              : 'Unknown'}
                          </span>
                          {evidence.uploadedAt && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span>{format(new Date(evidence.uploadedAt), "MMM d, yyyy")}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent align="start" className="w-80">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start gap-2">
                        <div className="p-2 bg-gray-100 rounded">
                          {evidence.linkUrl ? (
                            <LinkIcon className="h-5 w-5 text-blue-600" />
                          ) : evidence.fileType?.startsWith('image/') ? (
                            <Image className="h-5 w-5 text-purple-600" />
                          ) : (
                            <FileText className="h-5 w-5 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold truncate">{evidence.fileName}</h4>
                          {evidence.fileType && (
                            <p className="text-xs text-gray-500">{evidence.fileType}</p>
                          )}
                        </div>
                      </div>

                      {/* File Preview */}
                      {evidence.fileUrl && (
                        evidence.fileType?.startsWith('image/') ? (
                          <div className="relative w-full h-32 bg-gray-100 rounded-md overflow-hidden">
                            <img 
                              src={evidence.fileUrl}
                              alt={evidence.fileName}
                              className="object-cover w-full h-full"
                            />
                          </div>
                        ) : evidence.fileType === 'application/pdf' ? (
                          <div className="relative w-full h-40 bg-gray-100 rounded-md overflow-hidden border">
                            <iframe
                              src={`${evidence.fileUrl}#toolbar=0&navpanes=0`}
                              className="w-full h-full"
                              title={evidence.fileName}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/70 to-transparent p-2">
                              <p className="text-white text-xs font-medium truncate">PDF Document</p>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full bg-gray-50 rounded-md p-4 text-center border">
                            <FileText className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                            <p className="text-xs text-gray-500">
                              {evidence.fileType || 'Document'}
                            </p>
                          </div>
                        )
                      )}

                      {/* Description */}
                      {evidence.description && (
                        <p className="text-xs text-gray-600">{evidence.description}</p>
                      )}

                      {/* Signature Block */}
                      <div className="bg-gray-50 rounded-md p-2 space-y-1">
                        <div className="flex items-center gap-1 text-xs">
                          <PenLine className="h-3 w-3 text-gray-500" />
                          <span className="font-medium text-gray-700">Uploaded by:</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          <p className="font-medium">
                            {evidence.uploader 
                              ? (evidence.uploader.firstName && evidence.uploader.lastName
                                  ? `${evidence.uploader.firstName} ${evidence.uploader.lastName}`
                                  : evidence.uploader.username)
                              : 'Unknown'}
                          </p>
                          {evidence.uploader?.email && (
                            <p className="text-gray-500">{evidence.uploader.email}</p>
                          )}
                          {evidence.uploadedAt && (
                            <p className="text-gray-500">{format(new Date(evidence.uploadedAt), "MMMM d, yyyy 'at' h:mm a")}</p>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      {(evidence.linkUrl || evidence.fileUrl) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2"
                          asChild
                        >
                          <a 
                            href={evidence.linkUrl || evidence.fileUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {evidence.linkUrl ? (
                              <>
                                <LinkIcon className="h-4 w-4" />
                                Open Link
                              </>
                            ) : (
                              <>
                                <FileText className="h-4 w-4" />
                                View File
                              </>
                            )}
                          </a>
                        </Button>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </div>
          )}
        </div>

        {/* Actions Menu */}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in_progress')}>
                <Clock className="h-4 w-4 mr-2" />
                Mark In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'completed')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Complete
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onNudge(task)}>
                <Send className="h-4 w-4 mr-2" />
                Nudge DRI
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEscalate(task)} className="text-red-600">
                <AlertCircle className="h-4 w-4 mr-2" />
                Escalate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Sub-tasks */}
      {expanded && hasSubTasks && (
        <div className="space-y-1">
          {task.subTasks.map(subTask => (
            <TaskItem 
              key={subTask.id} 
              task={subTask} 
              isAdmin={isAdmin}
              onStatusChange={onStatusChange}
              onNudge={onNudge}
              onEscalate={onEscalate}
              onTaskClick={onTaskClick}
              onAddEvidence={onAddEvidence}
              depth={depth + 1}
              selectedTaskIds={selectedTaskIds}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ComplianceTasksPanel({ regulationId, regulationName: _regulationName, isAdmin }: ComplianceTasksPanelProps) {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<ComplianceTask | null>(null);
  const [nudgeTask, setNudgeTask] = useState<ComplianceTask | null>(null);
  const [escalateTask, setEscalateTask] = useState<ComplianceTask | null>(null);
  const [evidenceTask, setEvidenceTask] = useState<ComplianceTask | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [escalateEmail, setEscalateEmail] = useState('');
  const [escalateMessage, setEscalateMessage] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [evidenceLinkUrl, setEvidenceLinkUrl] = useState('');
  const [evidenceLinkTitle, setEvidenceLinkTitle] = useState('');
  const [evidenceType, setEvidenceType] = useState<'file' | 'link'>('file');
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);

  // Fetch tasks
  const { data, isLoading, error } = useQuery<TasksResponse>({
    queryKey: ['compliance-tasks', regulationId],
    queryFn: async () => {
      const response = await fetch(`/api/compliance-tasks/regulation/${regulationId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
  });

  // Update task status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      const response = await fetch(`/api/compliance-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-tasks', regulationId] });
    },
  });

  // Nudge mutation
  const nudgeMutation = useMutation({
    mutationFn: async ({ taskId, message }: { taskId: number; message: string }) => {
      const response = await fetch(`/api/compliance-tasks/${taskId}/nudge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error('Failed to send nudge');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Nudge Sent', description: 'Reminder email sent to DRI' });
      setNudgeTask(null);
      setNudgeMessage('');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send nudge', variant: 'destructive' });
    },
  });

  // Escalate mutation
  const escalateMutation = useMutation({
    mutationFn: async ({ taskId, escalationEmail, message }: { taskId: number; escalationEmail: string; message: string }) => {
      const response = await fetch(`/api/compliance-tasks/${taskId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ escalationEmail, message, ccDri: true }),
      });
      if (!response.ok) throw new Error('Failed to escalate');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Task Escalated', description: 'Escalation email sent' });
      setEscalateTask(null);
      setEscalateEmail('');
      setEscalateMessage('');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to escalate task', variant: 'destructive' });
    },
  });

  // Evidence upload mutation
  const evidenceMutation = useMutation({
    mutationFn: async ({ taskId, file, description, linkUrl, linkTitle }: { 
      taskId: number; 
      file?: File; 
      description: string; 
      linkUrl?: string; 
      linkTitle?: string 
    }) => {
      if (file) {
        // File upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('description', description);
        
        const response = await fetch(`/api/compliance-tasks/${taskId}/evidence`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        if (!response.ok) throw new Error('Failed to upload evidence');
        return response.json();
      } else if (linkUrl) {
        // Link submission
        const response = await fetch(`/api/compliance-tasks/${taskId}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ linkUrl, linkTitle, description }),
        });
        if (!response.ok) throw new Error('Failed to add evidence link');
        return response.json();
      }
      throw new Error('No file or link provided');
    },
    onSuccess: () => {
      toast({ title: 'Evidence Added', description: 'Evidence has been attached to the task' });
      queryClient.invalidateQueries({ queryKey: ['compliance-tasks', regulationId] });
      resetEvidenceForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add evidence', variant: 'destructive' });
    },
  });

  // Reset evidence form helper
  const resetEvidenceForm = () => {
    setEvidenceTask(null);
    setEvidenceFile(null);
    setEvidenceDescription('');
    setEvidenceLinkUrl('');
    setEvidenceLinkTitle('');
    setEvidenceType('file');
  };

  // Handle evidence submission
  const handleEvidenceSubmit = () => {
    if (!evidenceTask) return;
    
    if (evidenceType === 'file' && evidenceFile) {
      evidenceMutation.mutate({
        taskId: evidenceTask.id,
        file: evidenceFile,
        description: evidenceDescription,
      });
    } else if (evidenceType === 'link' && evidenceLinkUrl) {
      evidenceMutation.mutate({
        taskId: evidenceTask.id,
        linkUrl: evidenceLinkUrl,
        linkTitle: evidenceLinkTitle,
        description: evidenceDescription,
      });
    } else {
      toast({ title: 'Error', description: 'Please provide a file or link', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-600">
        Failed to load compliance tasks
      </div>
    );
  }

  const hasNoTasks = !data?.tasks || data.tasks.length === 0;

  return (
    <div className="space-y-4">
      {/* Header with Progress */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Compliance Tasks</h3>
          {!hasNoTasks && (
            <div className="flex items-center gap-3 mt-2">
              <Progress value={data?.progress || 0} className="h-2 flex-1 max-w-xs" />
              <span className="text-sm text-gray-600">
                {data?.completedTasks}/{data?.totalTasks} complete ({data?.progress}%)
              </span>
            </div>
          )}
        </div>
        {isAdmin && !hasNoTasks && (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        )}
      </div>

      {/* Empty State */}
      {hasNoTasks ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-700">No Compliance Tasks</h4>
          <p className="text-gray-500 mt-1 max-w-md mx-auto">
            This regulation doesn't have any compliance tasks defined yet.
            Tasks are configured by the system administrator.
          </p>
        </div>
      ) : (
        <>
          {/* Bulk Operations Bar */}
          <BulkTaskOperations
            regulationId={regulationId}
            tasks={data?.tasks?.flatMap(t => [t, ...t.subTasks]) || []}
            selectedTaskIds={selectedTaskIds}
            onSelectionChange={setSelectedTaskIds}
            isAdmin={isAdmin}
          />
          
          {/* Task List */}
          <div className="space-y-2">
            {data?.tasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                isAdmin={isAdmin}
                onStatusChange={(taskId, status) => updateStatusMutation.mutate({ taskId, status })}
                onNudge={setNudgeTask}
                onEscalate={setEscalateTask}
                onTaskClick={setSelectedTask}
                onAddEvidence={setEvidenceTask}
                selectedTaskIds={selectedTaskIds}
                onToggleSelect={(taskId) => {
                  setSelectedTaskIds(prev => 
                    prev.includes(taskId) 
                      ? prev.filter(id => id !== taskId)
                      : [...prev, taskId]
                  );
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Nudge Dialog */}
      <Dialog open={!!nudgeTask} onOpenChange={() => setNudgeTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Reminder</DialogTitle>
            <DialogDescription>
              Send a reminder to {nudgeTask?.assignedUser?.email || nudgeTask?.assignedRole} about this task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="font-medium">{nudgeTask?.title}</p>
              <p className="text-sm text-gray-600 mt-1">{nudgeTask?.description}</p>
            </div>
            <div>
              <Label htmlFor="nudge-message">Message (optional)</Label>
              <Textarea
                id="nudge-message"
                placeholder="Add a personal message..."
                value={nudgeMessage}
                onChange={(e) => setNudgeMessage(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNudgeTask(null)}>Cancel</Button>
            <Button 
              onClick={() => nudgeTask && nudgeMutation.mutate({ taskId: nudgeTask.id, message: nudgeMessage })}
              disabled={nudgeMutation.isPending}
            >
              {nudgeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalate Dialog */}
      <Dialog open={!!escalateTask} onOpenChange={() => setEscalateTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Escalate Task</DialogTitle>
            <DialogDescription>
              Escalate this task to a supervisor. The DRI will be CC'd on the email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <p className="font-medium">{escalateTask?.title}</p>
              <p className="text-sm text-gray-600 mt-1">Assigned to: {escalateTask?.assignedUser?.email || escalateTask?.assignedRole}</p>
            </div>
            <div>
              <Label htmlFor="escalate-email">Supervisor Email *</Label>
              <Input
                id="escalate-email"
                type="email"
                placeholder="supervisor@university.edu"
                value={escalateEmail}
                onChange={(e) => setEscalateEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="escalate-message">Message</Label>
              <Textarea
                id="escalate-message"
                placeholder="Explain why this task is being escalated..."
                value={escalateMessage}
                onChange={(e) => setEscalateMessage(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateTask(null)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={() => escalateTask && escalateMutation.mutate({ 
                taskId: escalateTask.id, 
                escalationEmail: escalateEmail,
                message: escalateMessage 
              })}
              disabled={!escalateEmail || escalateMutation.isPending}
            >
              {escalateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evidence Upload Dialog */}
      <Dialog open={!!evidenceTask} onOpenChange={() => resetEvidenceForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-blue-600" />
              Add Evidence
            </DialogTitle>
            <DialogDescription>
              Attach evidence to: <span className="font-medium">{evidenceTask?.title}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Type Selector - Styled as tabs */}
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setEvidenceType('file')}
                className={cn(
                  "flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors",
                  evidenceType === 'file' 
                    ? "border-blue-600 text-blue-600" 
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <Upload className="h-4 w-4 inline mr-2" />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setEvidenceType('link')}
                className={cn(
                  "flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors",
                  evidenceType === 'link' 
                    ? "border-blue-600 text-blue-600" 
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <LinkIcon className="h-4 w-4 inline mr-2" />
                Add Link
              </button>
            </div>

            {evidenceType === 'file' ? (
              <div>
                {/* Styled Drop Zone */}
                <label 
                  htmlFor="evidence-file"
                  className={cn(
                    "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                    evidenceFile 
                      ? "border-green-400 bg-green-50" 
                      : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-blue-400"
                  )}
                >
                  {evidenceFile ? (
                    <div className="flex flex-col items-center text-green-600">
                      <FileCheck className="h-8 w-8 mb-2" />
                      <p className="text-sm font-medium">{evidenceFile.name}</p>
                      <p className="text-xs text-green-500 mt-1">Click to change file</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-gray-500">
                      <Upload className="h-8 w-8 mb-2" />
                      <p className="text-sm font-medium">Click to upload</p>
                      <p className="text-xs text-gray-400">or drag and drop</p>
                    </div>
                  )}
                  <input
                    id="evidence-file"
                    type="file"
                    className="hidden"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="evidence-link-url">URL *</Label>
                  <Input
                    id="evidence-link-url"
                    type="url"
                    placeholder="https://..."
                    value={evidenceLinkUrl}
                    onChange={(e) => setEvidenceLinkUrl(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="evidence-link-title">Link Title</Label>
                  <Input
                    id="evidence-link-title"
                    placeholder="e.g., Policy Document v2.0"
                    value={evidenceLinkTitle}
                    onChange={(e) => setEvidenceLinkTitle(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="evidence-description">Description (optional)</Label>
              <Textarea
                id="evidence-description"
                placeholder="Describe this evidence..."
                value={evidenceDescription}
                onChange={(e) => setEvidenceDescription(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => resetEvidenceForm()}>Cancel</Button>
            <Button 
              onClick={handleEvidenceSubmit}
              disabled={evidenceMutation.isPending || (evidenceType === 'file' ? !evidenceFile : !evidenceLinkUrl)}
            >
              {evidenceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Submit Evidence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        regulationId={regulationId}
        isAdmin={isAdmin}
        onStatusChange={(taskId, status) => updateStatusMutation.mutate({ taskId, status })}
      />
    </div>
  );
}

