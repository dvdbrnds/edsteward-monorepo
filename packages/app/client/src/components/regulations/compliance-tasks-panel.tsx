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
  UserPlus,
  Calendar,
  Loader2,
  Plus,
  PenLine,
  Upload,
  Paperclip,
  Trash2,
  Shield,
  Mail,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  taskId: string | null; // Unique task identifier (e.g., GLBA-001, OSHA-005) - MCP Engine sync Jan 2026
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
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  overdue: <AlertTriangle className="h-4 w-4 text-red-600" />,
  blocked: <AlertCircle className="h-4 w-4 text-amber-600" />,
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

const evidenceIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-3 w-3" />,
  link: <LinkIcon className="h-3 w-3" />,
  screenshot: <Image className="h-3 w-3" />,
  attestation: <FileCheck className="h-3 w-3" />,
  form: <FileText className="h-3 w-3" />,
};

interface AssignableUser {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

function TaskItem({ 
  task, 
  isAdmin, 
  onStatusChange, 
  onNudge, 
  onEscalate,
  onRequestAttestation,
  onTaskClick,
  onAddEvidence,
  onDeleteEvidence,
  onAssign,
  availableUsers,
  isAssigning,
  depth = 0,
  selectedTaskIds = [],
  onToggleSelect,
}: { 
  task: ComplianceTask; 
  isAdmin?: boolean;
  onStatusChange: (_id: number, _newStatus: string) => void;
  onNudge: (_taskToNudge: ComplianceTask) => void;
  onEscalate: (_taskToEscalate: ComplianceTask) => void;
  onRequestAttestation: (_taskToAttest: ComplianceTask) => void;
  onTaskClick: (_task: ComplianceTask) => void;
  onAddEvidence: (_task: ComplianceTask) => void;
  onDeleteEvidence: (_taskId: number, _evidenceId: number, _fileName: string) => void;
  onAssign?: (_taskId: number, _userId: number | null) => void;
  availableUsers?: AssignableUser[];
  isAssigning?: boolean;
  depth?: number;
  selectedTaskIds?: number[];
  onToggleSelect?: (_taskId: number) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [assignPopoverOpen, setAssignPopoverOpen] = useState(false);
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
      isOverdue ? 'border-red-300' : 'border-border')}>
      <div className={cn(
        "flex items-start gap-3 p-3 rounded-lg mb-2 transition-colors",
        task.status === 'completed' ? 'bg-green-50' : 
        isOverdue ? 'bg-red-50' : 'bg-card hover:bg-background',
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
            aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
            aria-expanded={expanded}
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
                  task.status === 'completed' && "line-through text-muted-foreground"
                )}>
                  {task.title}
                </h4>
              </button>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
              )}
            </div>

            {/* Priority Badge */}
            <Badge variant="outline" className={cn("text-xs shrink-0", priorityColors[task.priority])}>
              {task.priority}
            </Badge>
            
            {/* Requirement Type Badge (MCP Engine sync Jan 2026) */}
            {task.requirementType && requirementTypeStyles[task.requirementType] && (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs shrink-0 cursor-help", requirementTypeStyles[task.requirementType].className)}
                  >
                    {requirementTypeStyles[task.requirementType].label}
                  </Badge>
                </HoverCardTrigger>
                <HoverCardContent className="w-64 text-sm">
                  <p>{requirementTypeStyles[task.requirementType].description}</p>
                  {task.taskId && (
                    <p className="text-xs text-muted-foreground mt-2">Task ID: {task.taskId}</p>
                  )}
                </HoverCardContent>
              </HoverCard>
            )}
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
            {/* Assignee with inline assign */}
            <div className="flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              <span className={cn(!task.assignedUser && task.assignedRole && "text-amber-600")}>
                {assigneeName}
              </span>
              {isAdmin && onAssign && (
                <Popover open={assignPopoverOpen} onOpenChange={setAssignPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 px-1.5 ml-1 text-xs text-primary border-primary/30 hover:bg-primary/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <UserPlus className="h-3 w-3 mr-0.5" />
                      Assign
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                        Assign to:
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-8"
                        disabled={isAssigning}
                        onClick={() => {
                          onAssign(task.id, null);
                          setAssignPopoverOpen(false);
                        }}
                      >
                        <span className="text-muted-foreground italic">Unassign</span>
                      </Button>
                      {availableUsers?.map((user) => {
                        const displayName = user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.username || user.email || `User #${user.id}`;
                        return (
                          <Button
                            key={user.id}
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "w-full justify-start text-xs h-auto py-1.5 flex-col items-start",
                              task.assignedTo === user.id && "bg-primary/10"
                            )}
                            disabled={isAssigning}
                            onClick={() => {
                              onAssign(task.id, user.id);
                              setAssignPopoverOpen(false);
                            }}
                          >
                            <span>{displayName}</span>
                            {user.email && (
                              <span className="text-[10px] text-muted-foreground font-normal">{user.email}</span>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
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
                className="h-6 px-2 text-xs text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
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
                    <div className="flex items-start gap-2 text-xs bg-card/60 rounded px-2 py-1.5 border border-blue-100 cursor-pointer hover:bg-card hover:border-blue-200 transition-colors">
                      {/* File type icon */}
                      <div className="p-1 bg-gray-100 rounded shrink-0">
                        {evidence.linkUrl ? (
                          <LinkIcon className="h-3 w-3 text-blue-600" />
                        ) : evidence.fileType?.startsWith('image/') ? (
                          <Image className="h-3 w-3 text-purple-600" />
                        ) : (
                          <FileText className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {evidence.linkUrl ? (
                            <span className="text-blue-600 font-medium truncate">
                              {evidence.linkTitle || evidence.fileName}
                            </span>
                          ) : (
                            <span className="font-medium text-foreground truncate">{evidence.fileName}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
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
                              <span className="text-muted-foreground">•</span>
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
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold truncate">{evidence.fileName}</h4>
                          {evidence.fileType && (
                            <p className="text-xs text-muted-foreground">{evidence.fileType}</p>
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
                          <div className="w-full bg-background rounded-md p-4 text-center border">
                            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground">
                              {evidence.fileType || 'Document'}
                            </p>
                          </div>
                        )
                      )}

                      {/* Description */}
                      {evidence.description && (
                        <p className="text-xs text-muted-foreground">{evidence.description}</p>
                      )}

                      {/* Signature Block */}
                      <div className="bg-background rounded-md p-2 space-y-1">
                        <div className="flex items-center gap-1 text-xs">
                          <PenLine className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-foreground">Uploaded by:</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p className="font-medium">
                            {evidence.uploader 
                              ? (evidence.uploader.firstName && evidence.uploader.lastName
                                  ? `${evidence.uploader.firstName} ${evidence.uploader.lastName}`
                                  : evidence.uploader.username)
                              : 'Unknown'}
                          </p>
                          {evidence.uploader?.email && (
                            <p className="text-muted-foreground">{evidence.uploader.email}</p>
                          )}
                          {evidence.uploadedAt && (
                            <p className="text-muted-foreground">{format(new Date(evidence.uploadedAt), "MMMM d, yyyy 'at' h:mm a")}</p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {(evidence.linkUrl || evidence.fileUrl) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-2"
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
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => onDeleteEvidence(task.id, evidence.id, evidence.fileName)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        )}
                      </div>
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
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Task actions menu">
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
              <DropdownMenuItem onClick={() => onRequestAttestation(task)} className="text-emerald-600">
                <Shield className="h-4 w-4 mr-2" />
                Request Attestation
              </DropdownMenuItem>
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
              onRequestAttestation={onRequestAttestation}
              onTaskClick={onTaskClick}
              onAddEvidence={onAddEvidence}
              onDeleteEvidence={onDeleteEvidence}
              onAssign={onAssign}
              availableUsers={availableUsers}
              isAssigning={isAssigning}
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
  
  // Add Task Dialog state
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskInstructions, setNewTaskInstructions] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssignedRole, setNewTaskAssignedRole] = useState('');
  const [newTaskEvidenceRequired, setNewTaskEvidenceRequired] = useState(false);
  const [newTaskEvidenceType, setNewTaskEvidenceType] = useState<'none' | 'document' | 'link' | 'screenshot' | 'attestation'>('none');
  const [newTaskEvidenceInstructions, setNewTaskEvidenceInstructions] = useState('');
  
  // Requirement type filter (MCP Engine sync Jan 2026)
  const [requirementTypeFilter, setRequirementTypeFilter] = useState<'all' | 'requirement' | 'best_practice'>('all');
  
  // Attestation request dialog state
  const [attestationTask, setAttestationTask] = useState<ComplianceTask | null>(null);
  const [attestationEmail, setAttestationEmail] = useState('');
  const [attestationRecipientName, setAttestationRecipientName] = useState('');
  const [attestationMessage, setAttestationMessage] = useState('');

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

  // Fetch users for assignment
  const { data: availableUsers } = useQuery<AssignableUser[]>({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: !!isAdmin,
  });

  // Assign task mutation
  const assignTaskMutation = useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: number; userId: number | null }) => {
      const response = await fetch(`/api/compliance-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedTo: userId }),
      });
      if (!response.ok) throw new Error('Failed to assign task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-tasks', regulationId] });
      // Also refresh the "My Tasks" dashboard widget
      queryClient.invalidateQueries({ queryKey: ['/api/compliance-tasks/my-tasks'] });
      toast({ title: 'Task assigned' });
    },
    onError: () => {
      toast({ title: 'Failed to assign task', variant: 'destructive' });
    },
  });

  const handleAssignTask = (taskId: number, userId: number | null) => {
    assignTaskMutation.mutate({ taskId, userId });
  };

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

  // Request attestation mutation
  const requestAttestationMutation = useMutation({
    mutationFn: async ({ taskId, email, recipientName, personalMessage }: { 
      taskId: number; 
      email: string; 
      recipientName?: string;
      personalMessage?: string;
    }) => {
      const response = await fetch(`/api/compliance-tasks/${taskId}/request-attestation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, recipientName, personalMessage }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to request attestation');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Attestation request sent successfully' });
      setAttestationTask(null);
      setAttestationEmail('');
      setAttestationRecipientName('');
      setAttestationMessage('');
      queryClient.invalidateQueries({ queryKey: ['compliance-tasks', regulationId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: {
      regulationId: number;
      title: string;
      description?: string;
      instructions?: string;
      priority: string;
      dueDate?: string;
      assignedRole?: string;
      evidenceRequired: boolean;
      evidenceType?: string;
      evidenceInstructions?: string;
    }) => {
      const response = await fetch('/api/compliance-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(taskData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create task');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Task Created', description: 'New compliance task has been added' });
      queryClient.invalidateQueries({ queryKey: ['compliance-tasks', regulationId] });
      resetAddTaskForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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

  // Delete evidence mutation
  const deleteEvidenceMutation = useMutation({
    mutationFn: async ({ taskId, evidenceId }: { taskId: number; evidenceId: number }) => {
      const response = await fetch(`/api/compliance-tasks/${taskId}/evidence/${evidenceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete evidence');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Evidence Deleted', description: 'Evidence has been removed from the task' });
      queryClient.invalidateQueries({ queryKey: ['compliance-tasks', regulationId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Handle evidence deletion with confirmation
  const handleDeleteEvidence = (taskId: number, evidenceId: number, fileName: string) => {
    if (confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) {
      deleteEvidenceMutation.mutate({ taskId, evidenceId });
    }
  };

  // Reset evidence form helper
  const resetEvidenceForm = () => {
    setEvidenceTask(null);
    setEvidenceFile(null);
    setEvidenceDescription('');
    setEvidenceLinkUrl('');
    setEvidenceLinkTitle('');
    setEvidenceType('file');
  };

  // Reset add task form helper
  const resetAddTaskForm = () => {
    setShowAddTask(false);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskInstructions('');
    setNewTaskPriority('medium');
    setNewTaskDueDate('');
    setNewTaskAssignedRole('');
    setNewTaskEvidenceRequired(false);
    setNewTaskEvidenceType('none');
    setNewTaskEvidenceInstructions('');
  };

  // Handle add task submission
  const handleAddTaskSubmit = () => {
    if (!newTaskTitle.trim()) {
      toast({ title: 'Error', description: 'Task title is required', variant: 'destructive' });
      return;
    }
    
    createTaskMutation.mutate({
      regulationId,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim() || undefined,
      instructions: newTaskInstructions.trim() || undefined,
      priority: newTaskPriority,
      dueDate: newTaskDueDate || undefined,
      assignedRole: newTaskAssignedRole.trim() || undefined,
      evidenceRequired: newTaskEvidenceRequired,
      evidenceType: newTaskEvidenceRequired ? newTaskEvidenceType : 'none',
      evidenceInstructions: newTaskEvidenceRequired ? newTaskEvidenceInstructions.trim() || undefined : undefined,
    });
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              <span className="text-sm text-muted-foreground">
                {data?.completedTasks}/{data?.totalTasks} complete ({data?.progress}%)
              </span>
            </div>
          )}
        </div>
        {isAdmin && (
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setShowAddTask(true)}
          >
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        )}
      </div>

      {/* Requirement Type Filter (MCP Engine sync Jan 2026) */}
      {!hasNoTasks && (
        <div className="flex items-center gap-4 pb-2 border-b">
          <span className="text-sm text-muted-foreground">Filter by type:</span>
          <div className="flex items-center gap-1">
            <Button
              variant={requirementTypeFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setRequirementTypeFilter('all')}
              className="h-7 text-xs"
            >
              All Tasks
            </Button>
            <Button
              variant={requirementTypeFilter === 'requirement' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setRequirementTypeFilter('requirement')}
              className="h-7 text-xs"
            >
              <span className="w-2 h-2 rounded-full bg-purple-500 mr-1.5" />
              Requirements Only
            </Button>
            <Button
              variant={requirementTypeFilter === 'best_practice' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setRequirementTypeFilter('best_practice')}
              className="h-7 text-xs"
            >
              <span className="w-2 h-2 rounded-full bg-teal-500 mr-1.5" />
              Best Practices
            </Button>
          </div>
          {/* Task count by type */}
          <div className="flex-1 text-right text-xs text-muted-foreground">
            {(() => {
              const allTasks = data?.tasks?.flatMap(t => [t, ...t.subTasks]) || [];
              const reqCount = allTasks.filter(t => !t.requirementType || t.requirementType === 'requirement').length;
              const bpCount = allTasks.filter(t => t.requirementType === 'best_practice').length;
              return `${reqCount} requirements · ${bpCount} best practices`;
            })()}
          </div>
        </div>
      )}

      {/* Empty State */}
      {hasNoTasks ? (
        <div className="text-center py-12 bg-background rounded-lg border-2 border-dashed">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h4 className="text-lg font-medium text-foreground">No Compliance Tasks</h4>
          <p className="text-muted-foreground mt-1 max-w-md mx-auto">
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
            {data?.tasks
              .filter(task => {
                if (requirementTypeFilter === 'all') return true;
                const taskType = task.requirementType || 'requirement';
                return taskType === requirementTypeFilter;
              })
              .map(task => (
              <TaskItem
                key={task.id}
                task={task}
                isAdmin={isAdmin}
                onStatusChange={(taskId, status) => updateStatusMutation.mutate({ taskId, status })}
                onNudge={setNudgeTask}
                onEscalate={setEscalateTask}
                onRequestAttestation={(task) => {
                  setAttestationTask(task);
                  // Pre-fill email if task is assigned
                  if (task.assignedUser?.email) {
                    setAttestationEmail(task.assignedUser.email);
                    setAttestationRecipientName(
                      task.assignedUser.firstName && task.assignedUser.lastName
                        ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}`
                        : task.assignedUser.username
                    );
                  }
                }}
                onTaskClick={setSelectedTask}
                onAddEvidence={setEvidenceTask}
                onDeleteEvidence={handleDeleteEvidence}
                onAssign={handleAssignTask}
                availableUsers={availableUsers}
                isAssigning={assignTaskMutation.isPending}
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
            <div className="bg-background p-3 rounded-lg">
              <p className="font-medium">{nudgeTask?.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{nudgeTask?.description}</p>
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
              <p className="text-sm text-muted-foreground mt-1">Assigned to: {escalateTask?.assignedUser?.email || escalateTask?.assignedRole}</p>
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

      {/* Request Attestation Dialog */}
      <Dialog open={!!attestationTask} onOpenChange={() => {
        setAttestationTask(null);
        setAttestationEmail('');
        setAttestationRecipientName('');
        setAttestationMessage('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <Shield className="h-5 w-5" />
              Request Attestation
            </DialogTitle>
            <DialogDescription>
              Send an attestation request email. The recipient will receive a secure link to confirm compliance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <p className="font-medium">{attestationTask?.title}</p>
              {attestationTask?.description && (
                <p className="text-sm text-muted-foreground mt-1">{attestationTask.description}</p>
              )}
              {attestationTask?.evidenceRequired && (
                <Badge variant="outline" className="mt-2 text-amber-700 border-amber-300 bg-amber-50">
                  Evidence Required
                </Badge>
              )}
            </div>
            <div>
              <Label htmlFor="attestation-email">Recipient Email *</Label>
              <Input
                id="attestation-email"
                type="email"
                placeholder="compliance-officer@university.edu"
                value={attestationEmail}
                onChange={(e) => setAttestationEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="attestation-name">Recipient Name (optional)</Label>
              <Input
                id="attestation-name"
                type="text"
                placeholder="Jane Smith"
                value={attestationRecipientName}
                onChange={(e) => setAttestationRecipientName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="attestation-message">Personal Message (optional)</Label>
              <Textarea
                id="attestation-message"
                placeholder="Please complete this attestation by end of week..."
                value={attestationMessage}
                onChange={(e) => setAttestationMessage(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAttestationTask(null);
              setAttestationEmail('');
              setAttestationRecipientName('');
              setAttestationMessage('');
            }}>Cancel</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => attestationTask && requestAttestationMutation.mutate({ 
                taskId: attestationTask.id, 
                email: attestationEmail,
                recipientName: attestationRecipientName || undefined,
                personalMessage: attestationMessage || undefined,
              })}
              disabled={!attestationEmail || requestAttestationMutation.isPending}
            >
              {requestAttestationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Request
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
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setEvidenceType('file')}
                className={cn(
                  "flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors",
                  evidenceType === 'file' 
                    ? "border-blue-600 text-blue-600" 
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
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
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
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
                      : "border-border bg-background hover:bg-muted hover:border-blue-400"
                  )}
                >
                  {evidenceFile ? (
                    <div className="flex flex-col items-center text-green-600">
                      <FileCheck className="h-8 w-8 mb-2" />
                      <p className="text-sm font-medium">{evidenceFile.name}</p>
                      <p className="text-xs text-green-500 mt-1">Click to change file</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Upload className="h-8 w-8 mb-2" />
                      <p className="text-sm font-medium">Click to upload</p>
                      <p className="text-xs text-muted-foreground">or drag and drop</p>
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

      {/* Add Task Dialog */}
      <Dialog open={showAddTask} onOpenChange={() => resetAddTaskForm()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Add Compliance Task
            </DialogTitle>
            <DialogDescription>
              Create a new task for this regulation. Tasks can be assigned to specific roles and include evidence requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Task Title */}
            <div>
              <Label htmlFor="task-title">Task Title *</Label>
              <Input
                id="task-title"
                placeholder="e.g., Submit Annual Safety Report"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Task Description */}
            <div>
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Describe what needs to be done..."
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            {/* Task Instructions */}
            <div>
              <Label htmlFor="task-instructions">Instructions</Label>
              <Textarea
                id="task-instructions"
                placeholder="Step-by-step instructions for completing this task..."
                value={newTaskInstructions}
                onChange={(e) => setNewTaskInstructions(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            {/* Priority & Due Date Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="task-priority">Priority</Label>
                <select
                  id="task-priority"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high' | 'critical')}
                  className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <Label htmlFor="task-due-date">Due Date</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Assigned Role */}
            <div>
              <Label htmlFor="task-role">Assigned Role</Label>
              <Input
                id="task-role"
                placeholder="e.g., Campus Safety Director, Compliance Officer"
                value={newTaskAssignedRole}
                onChange={(e) => setNewTaskAssignedRole(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the role responsible for this task
              </p>
            </div>

            {/* Evidence Required */}
            <div className="border rounded-lg p-4 bg-background">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="evidence-required"
                  checked={newTaskEvidenceRequired}
                  onCheckedChange={(checked) => setNewTaskEvidenceRequired(checked === true)}
                />
                <Label htmlFor="evidence-required" className="cursor-pointer">
                  Evidence required for completion
                </Label>
              </div>

              {newTaskEvidenceRequired && (
                <div className="mt-4 space-y-3 pl-6 border-l-2 border-blue-200">
                  <div>
                    <Label htmlFor="evidence-type">Evidence Type</Label>
                    <select
                      id="evidence-type"
                      value={newTaskEvidenceType}
                      onChange={(e) => setNewTaskEvidenceType(e.target.value as 'document' | 'link' | 'screenshot' | 'attestation')}
                      className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="document">Document Upload</option>
                      <option value="link">External Link</option>
                      <option value="screenshot">Screenshot</option>
                      <option value="attestation">Signed Attestation</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="evidence-instructions">Evidence Instructions</Label>
                    <Textarea
                      id="evidence-instructions"
                      placeholder="Describe what evidence needs to be provided..."
                      value={newTaskEvidenceInstructions}
                      onChange={(e) => setNewTaskEvidenceInstructions(e.target.value)}
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => resetAddTaskForm()}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddTaskSubmit}
              disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
            >
              {createTaskMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

