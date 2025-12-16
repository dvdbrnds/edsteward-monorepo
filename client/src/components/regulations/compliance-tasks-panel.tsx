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
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { TaskDetailDialog } from './task-detail-dialog';

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
  subTasks: ComplianceTask[];
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
  depth = 0 
}: { 
  task: ComplianceTask; 
  isAdmin?: boolean;
  onStatusChange: (_id: number, _newStatus: string) => void;
  onNudge: (_taskToNudge: ComplianceTask) => void;
  onEscalate: (_taskToEscalate: ComplianceTask) => void;
  onTaskClick: (_task: ComplianceTask) => void;
  depth?: number;
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
        isOverdue ? 'bg-red-50' : 'bg-white hover:bg-gray-50'
      )}>
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

            {/* Evidence Indicator */}
            {task.evidenceRequired && (
              <div className={cn(
                "flex items-center gap-1",
                task.evidenceCount > 0 ? "text-green-600" : "text-amber-600"
              )}>
                {evidenceIcons[task.evidenceType] || evidenceIcons.document}
                <span>{task.evidenceCount > 0 ? `${task.evidenceCount} file(s)` : 'Evidence needed'}</span>
              </div>
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
              depth={depth + 1}
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
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [escalateEmail, setEscalateEmail] = useState('');
  const [escalateMessage, setEscalateMessage] = useState('');

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
        /* Task List */
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
            />
          ))}
        </div>
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

