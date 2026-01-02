/**
 * My Tasks Component
 * Shows tasks assigned to the current user with quick actions
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronRight,
  ListTodo,
  Loader2
} from "lucide-react";
import { Link } from "wouter";
import { format, isPast, isToday, addDays, isBefore } from "date-fns";

interface MyTask {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  regulationId: number;
  regulation: {
    id: number;
    name: string;
    topic: string | null;
  } | null;
}

export default function MyTasks() {
  const { data: tasks, isLoading, error } = useQuery<MyTask[]>({
    queryKey: ["/api/compliance-tasks/my-tasks"],
    queryFn: async () => {
      const response = await fetch("/api/compliance-tasks/my-tasks", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return response.json();
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "blocked":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <ListTodo className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: "bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      in_progress: "bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      blocked: "bg-red-100/50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      pending: "bg-yellow-100/50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    };
    return variants[status] || variants.pending;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      critical: "bg-red-100/50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      high: "bg-orange-100/50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      medium: "bg-yellow-100/50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      low: "bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    };
    return variants[priority] || variants.medium;
  };

  const getDueDateStatus = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    
    if (isPast(date) && !isToday(date)) {
      return { label: "Overdue", className: "text-red-600 dark:text-red-400 font-medium" };
    }
    if (isToday(date)) {
      return { label: "Due today", className: "text-orange-600 dark:text-orange-400 font-medium" };
    }
    if (isBefore(date, addDays(new Date(), 7))) {
      return { label: format(date, "MMM d"), className: "text-yellow-600 dark:text-yellow-400" };
    }
    return { label: format(date, "MMM d"), className: "text-muted-foreground" };
  };

  // Filter to show only incomplete tasks, sorted by due date
  const incompleteTasks = tasks
    ?.filter((t) => t.status !== "completed")
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 5); // Show top 5

  const completedCount = tasks?.filter((t) => t.status === "completed").length || 0;
  const totalCount = tasks?.length || 0;

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            My Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            My Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Failed to load tasks</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            My Tasks
          </CardTitle>
          <Badge variant="outline" className="font-normal">
            {completedCount}/{totalCount} done
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {incompleteTasks && incompleteTasks.length > 0 ? (
          <div className="space-y-3 flex-1">
            {incompleteTasks.map((task) => {
              const dueDateStatus = getDueDateStatus(task.dueDate);
              return (
                <Link
                  key={task.id}
                  href={`/regulations/${task.regulationId}`}
                  className="block"
                >
                  <div className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(task.status)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {task.title}
                        </p>
                        {task.regulation && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {task.regulation.name}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={`text-xs ${getStatusBadge(task.status)}`}>
                            {task.status.replace("_", " ")}
                          </Badge>
                          <Badge className={`text-xs ${getPriorityBadge(task.priority)}`}>
                            {task.priority}
                          </Badge>
                          {dueDateStatus && (
                            <span className={`text-xs ${dueDateStatus.className}`}>
                              {dueDateStatus.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-6">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">
                No pending tasks assigned to you
              </p>
            </div>
          </div>
        )}

        {totalCount > 5 && (
          <div className="pt-3 mt-auto border-t border-border">
            <Link href="/task-analytics">
              <Button variant="ghost" className="w-full text-sm">
                View all {totalCount} tasks
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

