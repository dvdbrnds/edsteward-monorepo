/**
 * Task Page
 * 
 * Allows users to view and complete tasks via email links.
 * Uses JWT tokens for authentication (no login required).
 */

import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { format } from 'date-fns';
import {
  CheckCircle,
  AlertTriangle,
  Calendar,
  FileText,
  Loader2,
  AlertCircle,
  Clock,
  Upload,
  PenLine,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface User {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  instructions: string | null;
  dueDate: string | null;
  status: string;
  priority: string;
  evidenceRequired: boolean;
  evidenceType: string | null;
  evidenceInstructions: string | null;
  completedAt: string | null;
  regulationId: number;
  regulationName: string | null;
  completedByUser?: User | null;
}

interface TaskData {
  task: Task;
  user: User;
  tokenValid: boolean;
}

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-blue-100 text-blue-800 border-blue-200',
  low: 'bg-gray-100 text-foreground border-border',
};

export default function TaskPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [taskData, setTaskData] = useState<TaskData | null>(null);

  useEffect(() => {
    async function fetchTask() {
      if (!token) {
        setError('No token provided');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/compliance-tasks/token/${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to load task');
          setErrorCode(data.code || null);
          setLoading(false);
          return;
        }

        setTaskData(data);
      } catch {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }

    fetchTask();
  }, [token]);

  const handleComplete = async () => {
    if (!token || !taskData) return;

    setCompleting(true);
    try {
      const response = await fetch(`/api/compliance-tasks/token/${token}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to complete task',
          variant: 'destructive',
        });
        return;
      }

      // Update local state
      setTaskData(prev => prev ? {
        ...prev,
        task: {
          ...prev.task,
          status: 'completed',
          completedAt: data.completedAt,
          completedByUser: data.completedBy,
        }
      } : null);

      toast({
        title: 'Task Completed!',
        description: 'Your completion has been recorded.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive',
      });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading task...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              {errorCode === 'TOKEN_EXPIRED' ? (
                <Clock className="h-8 w-8 text-red-600" />
              ) : (
                <AlertCircle className="h-8 w-8 text-red-600" />
              )}
            </div>
            <CardTitle className="text-red-600">
              {errorCode === 'TOKEN_EXPIRED' ? 'Link Expired' : 'Unable to Load Task'}
            </CardTitle>
            <CardDescription>
              {errorCode === 'TOKEN_EXPIRED' 
                ? 'This task link has expired. Please contact your compliance officer for a new link.'
                : error}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!taskData) return null;

  const { task, user } = taskData;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const isCompleted = task.status === 'completed';

  const userName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.username;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">EdSteward Compliance Task</h1>
          <p className="text-muted-foreground mt-1">Assigned to: {userName}</p>
        </div>

        {/* Task Card */}
        <Card className={cn(
          "overflow-hidden",
          isCompleted && "border-green-300",
          isOverdue && !isCompleted && "border-red-300"
        )}>
          {/* Status Banner */}
          {isCompleted ? (
            <div className="bg-green-500 text-white px-6 py-3 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Task Completed</span>
            </div>
          ) : isOverdue ? (
            <div className="bg-red-500 text-white px-6 py-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Overdue</span>
            </div>
          ) : (
            <div className="bg-blue-500 text-white px-6 py-3 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <span className="font-medium">Action Required</span>
            </div>
          )}

          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">{task.title}</CardTitle>
                {task.regulationName && (
                  <CardDescription className="mt-1">
                    Regulation: {task.regulationName}
                  </CardDescription>
                )}
              </div>
              <Badge variant="outline" className={cn("shrink-0", priorityColors[task.priority])}>
                {task.priority}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Description */}
            {task.description && (
              <div>
                <h2 className="font-medium text-foreground mb-2">Description</h2>
                <p className="text-muted-foreground">{task.description}</p>
              </div>
            )}

            {/* Instructions */}
            {task.instructions && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h2 className="font-medium text-blue-900 mb-2">Instructions</h2>
                <p className="text-blue-800 whitespace-pre-wrap">{task.instructions}</p>
              </div>
            )}

            {/* Due Date */}
            {task.dueDate && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Due: {format(new Date(task.dueDate), 'MMMM d, yyyy')}</span>
                {isOverdue && !isCompleted && (
                  <Badge variant="destructive" className="ml-2">Overdue</Badge>
                )}
              </div>
            )}

            {/* Evidence Requirements */}
            {task.evidenceRequired && !isCompleted && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
                  <Upload className="h-4 w-4" />
                  Evidence Required
                </div>
                <p className="text-amber-700 text-sm">
                  {task.evidenceInstructions || `Please provide ${task.evidenceType || 'documentation'} to complete this task.`}
                </p>
                <p className="text-amber-600 text-xs mt-2">
                  Note: Evidence can be uploaded after marking the task complete, or by logging into the main portal.
                </p>
              </div>
            )}

            {/* Completion Signature */}
            {isCompleted && task.completedAt && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <PenLine className="h-4 w-4" />
                  <span className="font-medium">Completion Signature</span>
                </div>
                <div className="mt-2 text-green-700">
                  <p>
                    <strong>Signed by:</strong>{' '}
                    {task.completedByUser
                      ? (task.completedByUser.firstName && task.completedByUser.lastName
                          ? `${task.completedByUser.firstName} ${task.completedByUser.lastName}`
                          : task.completedByUser.username)
                      : userName}
                  </p>
                  {task.completedByUser?.email && (
                    <p className="text-sm">{task.completedByUser.email}</p>
                  )}
                  <p className="text-sm mt-1">
                    <strong>Date:</strong> {format(new Date(task.completedAt), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isCompleted && (
              <div className="pt-4 border-t">
                <Button 
                  onClick={handleComplete}
                  disabled={completing}
                  className="w-full"
                  size="lg"
                >
                  {completing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Mark Task as Complete
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-muted-foreground text-center mt-3">
                  By clicking this button, you confirm that you have completed this compliance task
                  and that all requirements have been fulfilled.
                </p>
              </div>
            )}

            {/* Portal Link */}
            <div className="pt-4 border-t text-center">
              <a 
                href={`/regulations/${task.regulationId}`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-4 w-4" />
                View full regulation in portal
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-muted-foreground text-sm">
          <p>EdSteward Compliance Management Platform</p>
        </div>
      </div>
    </div>
  );
}

