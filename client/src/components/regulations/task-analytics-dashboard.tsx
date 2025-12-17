import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Users,
  TrendingUp,
  Loader2,
  AlertCircle,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface TaskAnalytics {
  overview: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    blocked: number;
    overdue: number;
    dueSoon: number;
    parentTasks: number;
    subTasks: number;
    completionRate: number;
  };
  byRegulation: Record<string, {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  }>;
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byRole: Array<{ role: string; count: number }>;
  completionTrend: Array<{ date: string; count: number }>;
}

export function TaskAnalyticsDashboard() {
  const { data, isLoading, error } = useQuery<TaskAnalytics>({
    queryKey: ['task-analytics'],
    queryFn: async () => {
      const response = await fetch('/api/compliance-tasks/analytics', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-600">
        <AlertCircle className="h-6 w-6 mr-2" />
        <span>Failed to load analytics</span>
      </div>
    );
  }

  if (!data) return null;

  const { overview, byRegulation, byPriority, byRole, completionTrend } = data;

  // Get regulations sorted by total tasks
  const regulationEntries = Object.entries(byRegulation).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Tasks</p>
                <p className="text-3xl font-bold text-blue-900">{overview.total}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-blue-600 mt-2">
              {overview.parentTasks} categories • {overview.subTasks} sub-tasks
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Completed</p>
                <p className="text-3xl font-bold text-green-900">{overview.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <Progress value={overview.completionRate} className="h-2" />
              <p className="text-xs text-green-600 mt-1">{overview.completionRate}% complete</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">Due Soon</p>
                <p className="text-3xl font-bold text-amber-900">{overview.dueSoon}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <p className="text-xs text-amber-600 mt-2">
              Due within next 7 days
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Overdue</p>
                <p className="text-3xl font-bold text-red-900">{overview.overdue}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-xs text-red-600 mt-2">
              Need immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span className="text-sm">Pending</span>
                </div>
                <span className="font-medium">{overview.pending}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm">In Progress</span>
                </div>
                <span className="font-medium">{overview.inProgress}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">Completed</span>
                </div>
                <span className="font-medium">{overview.completed}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-sm">Blocked</span>
                </div>
                <span className="font-medium">{overview.blocked}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="destructive" className="bg-red-600">Critical</Badge>
                <span className="font-medium">{byPriority.critical}</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="bg-orange-500">High</Badge>
                <span className="font-medium">{byPriority.high}</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="bg-yellow-500 text-black">Medium</Badge>
                <span className="font-medium">{byPriority.medium}</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="bg-green-500">Low</Badge>
                <span className="font-medium">{byPriority.low}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Assigned Roles */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Top Assigned Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {byRole.slice(0, 5).map(({ role, count }) => (
                <div key={role} className="flex items-center justify-between text-sm">
                  <span className="truncate max-w-[180px]" title={role}>{role}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regulations Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Tasks by Regulation
          </CardTitle>
          <CardDescription>
            Compliance task distribution across regulations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {regulationEntries.map(([name, stats]) => (
              <div key={name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate max-w-[300px]" title={name}>{name}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-green-600">{stats.completed} done</span>
                    <span className="text-gray-600">{stats.pending} pending</span>
                    {stats.overdue > 0 && (
                      <span className="text-red-600">{stats.overdue} overdue</span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-green-500 h-2 transition-all duration-500"
                    style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Completion Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Completion Trend (Last 30 Days)
          </CardTitle>
          <CardDescription>
            Number of tasks completed each day
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-end gap-1">
            {completionTrend.map(({ date, count }) => {
              const maxCount = Math.max(...completionTrend.map(d => d.count), 1);
              const height = (count / maxCount) * 100;
              return (
                <div
                  key={date}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 transition-colors rounded-t cursor-pointer group relative"
                  style={{ height: `${Math.max(height, count > 0 ? 8 : 2)}%` }}
                  title={`${date}: ${count} completed`}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {count} tasks
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TaskAnalyticsDashboard;


