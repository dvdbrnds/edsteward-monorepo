/**
 * Executive Dashboard
 * Beautiful analytics overview for CFOs and leadership
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Users,
  Calendar,
  ArrowRight,
  RefreshCw,
  Target,
  Zap,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardAnalytics {
  overview: {
    complianceScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    lastUpdated: string;
  };
  regulations: {
    total: number;
    compliant: number;
    needsAttention: number;
    nonCompliant: number;
    pending: number;
    complianceRate: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    overdue: number;
    completionRate: number;
  };
  deadlines: {
    total: number;
    completed: number;
    upcoming: number;
    overdue: number;
    dueThisWeek: Array<{
      id: number;
      title: string;
      dueDate: string;
      regulationId: number;
    }>;
    completionRate: number;
  };
  attestations: {
    completed: number;
    pending: number;
    rate: number;
  };
  users: {
    total: number;
    admins: number;
    complianceOfficers: number;
  };
  topIssues: Array<{
    id: number;
    name: string;
    category: string;
    status: string;
    taskCompletion: number;
    totalTasks: number;
    completedTasks: number;
  }>;
  categoryPerformance: Array<{
    name: string;
    total: number;
    compliant: number;
    rate: number;
  }>;
}

const COLORS = {
  compliant: '#10b981',
  needsAttention: '#f59e0b',
  nonCompliant: '#ef4444',
  pending: '#6b7280',
  primary: '#3b82f6',
  purple: '#8b5cf6'
};

const getRiskBadge = (level: string) => {
  const styles: Record<string, string> = {
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200'
  };
  return styles[level] || styles.medium;
};

const ScoreGauge: React.FC<{ score: number; riskLevel: string }> = ({ score, riskLevel }) => {
  const getScoreColor = (s: number) => {
    if (s >= 85) return '#10b981';
    if (s >= 70) return '#f59e0b';
    if (s >= 50) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="12"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={getScoreColor(score)}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${score * 2.64} 264`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold" style={{ color: getScoreColor(score) }}>
            {score}%
          </span>
          <span className="text-sm text-muted-foreground">Score</span>
        </div>
      </div>
      <Badge className={`mt-3 ${getRiskBadge(riskLevel)}`}>
        {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
      </Badge>
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}> = ({ title, value, subtitle, icon, trend, color = 'blue' }) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {trend && (
                <span className={trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}>
                  {trend === 'up' ? <TrendingUp className="h-4 w-4" /> : 
                   trend === 'down' ? <TrendingDown className="h-4 w-4" /> : null}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const ExecutiveDashboard: React.FC = () => {
  const { data, isLoading, error, refetch, isFetching } = useQuery<DashboardAnalytics>({
    queryKey: ['/api/dashboard-analytics'],
    refetchInterval: 60000 // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <div>
              <p className="font-medium text-red-800">Failed to load analytics</p>
              <p className="text-sm text-red-600">Please try refreshing the page</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare pie chart data
  const regulationStatusData = [
    { name: 'Compliant', value: data.regulations.compliant, color: COLORS.compliant },
    { name: 'Needs Attention', value: data.regulations.needsAttention, color: COLORS.needsAttention },
    { name: 'Non-Compliant', value: data.regulations.nonCompliant, color: COLORS.nonCompliant },
    { name: 'Pending', value: data.regulations.pending, color: COLORS.pending }
  ].filter(d => d.value > 0);

  const taskStatusData = [
    { name: 'Completed', value: data.tasks.completed, color: COLORS.compliant },
    { name: 'In Progress', value: data.tasks.inProgress, color: COLORS.primary },
    { name: 'Pending', value: data.tasks.pending, color: COLORS.pending },
    { name: 'Overdue', value: data.tasks.overdue, color: COLORS.nonCompliant }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Compliance Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Last updated: {new Date(data.overview.lastUpdated).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open('/api/reports/export/regulations/csv', '_blank')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Regulations (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open('/api/reports/export/tasks/csv', '_blank')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Tasks (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open('/api/reports/export/deadlines/csv', '_blank')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Deadlines (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alert Banner for Critical Issues */}
      {(data.deadlines.overdue > 0 || data.tasks.overdue > 0) && (
        <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-800">Attention Required</p>
                <p className="text-sm text-red-600">
                  {data.deadlines.overdue > 0 && `${data.deadlines.overdue} overdue deadline${data.deadlines.overdue > 1 ? 's' : ''}`}
                  {data.deadlines.overdue > 0 && data.tasks.overdue > 0 && ' • '}
                  {data.tasks.overdue > 0 && `${data.tasks.overdue} overdue task${data.tasks.overdue > 1 ? 's' : ''}`}
                </p>
              </div>
              <Button variant="destructive" size="sm" asChild>
                <Link href="/">
                  View Issues <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Score + Key Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Compliance Score Card */}
        <Card className="lg:col-span-1 bg-gradient-to-br from-slate-50 to-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Overall Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <ScoreGauge score={data.overview.complianceScore} riskLevel={data.overview.riskLevel} />
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Regulations"
            value={data.regulations.total}
            subtitle={`${data.regulations.complianceRate}% compliant`}
            icon={<FileText className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            title="Tasks"
            value={data.tasks.total}
            subtitle={`${data.tasks.completionRate}% complete`}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="green"
          />
          <StatCard
            title="Upcoming Deadlines"
            value={data.deadlines.upcoming}
            subtitle={`${data.deadlines.dueThisWeek.length} this week`}
            icon={<Calendar className="h-5 w-5" />}
            color="yellow"
          />
          <StatCard
            title="Team Members"
            value={data.users.total}
            subtitle={`${data.users.complianceOfficers} officers`}
            icon={<Users className="h-5 w-5" />}
            color="purple"
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regulation Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Regulation Status</CardTitle>
            <CardDescription>Distribution by compliance status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={regulationStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {regulationStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value, 'Regulations']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Task Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Task Progress</CardTitle>
            <CardDescription>Compliance task completion status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value, 'Tasks']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Performance */}
      {data.categoryPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance by Category</CardTitle>
            <CardDescription>Compliance rate across regulation categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.categoryPerformance.slice(0, 8)} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, 'Compliance Rate']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Bar 
                    dataKey="rate" 
                    fill={COLORS.primary}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom Row: Issues + Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Issues */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-500" />
                  Regulations Needing Attention
                </CardTitle>
                <CardDescription>Lowest task completion rates</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data.topIssues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium">All regulations on track!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.topIssues.map((issue) => (
                  <Link key={issue.id} href={`/regulations/${issue.id}`}>
                    <div className="p-3 border rounded-lg hover:bg-background cursor-pointer transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm truncate pr-4" title={issue.name}>
                          {issue.name.length > 40 ? issue.name.slice(0, 40) + '...' : issue.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {issue.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={issue.taskCompletion} className="flex-1 h-2" />
                        <span className="text-sm font-medium text-muted-foreground w-16 text-right">
                          {issue.completedTasks}/{issue.totalTasks}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deadlines This Week */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  Due This Week
                </CardTitle>
                <CardDescription>Upcoming compliance deadlines</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.deadlines.dueThisWeek.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium">No deadlines this week!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.deadlines.dueThisWeek.slice(0, 5).map((deadline) => (
                  <Link key={deadline.id} href={`/regulations/${deadline.regulationId}`}>
                    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-background cursor-pointer transition-colors">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Calendar className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{deadline.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(deadline.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;

