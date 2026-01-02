/**
 * Compliance Analytics Dashboard
 * 
 * Provides comprehensive analytics and insights for regulatory compliance
 * including metrics, trends, risk assessment, and performance indicators.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Users,
  FileText,
  Calendar,
  Activity,
  Shield,
  BarChart3,
  Download,
  RefreshCw
} from 'lucide-react';

// Types for analytics data
interface ComplianceMetrics {
  totalRegulations: number;
  activeRegulations: number;
  totalDeadlines: number;
  upcomingDeadlines: number;
  overdueDeadlines: number;
  completedDeadlines: number;
  complianceScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastCalculated: Date;
}

interface TrendData {
  period: string;
  completed: number;
  overdue: number;
  pending: number;
  complianceScore: number;
}

interface RiskAnalysis {
  category: string;
  risk: number;
  regulations: number;
  trend: 'up' | 'down' | 'stable';
}

interface SystemUsage {
  activeUsers: number;
  totalLogins: number;
  averageSessionDuration: number;
  storageUsed: number;
  apiCallsThisMonth: number;
  emailsSent: number;
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#6366f1',
  gray: '#6b7280'
};

const PIE_COLORS = [COLORS.success, COLORS.warning, COLORS.danger, COLORS.info];

export const ComplianceAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  
  // Mock data - in real implementation, this would come from API
  const [metrics, setMetrics] = useState<ComplianceMetrics>({
    totalRegulations: 127,
    activeRegulations: 98,
    totalDeadlines: 45,
    upcomingDeadlines: 12,
    overdueDeadlines: 3,
    completedDeadlines: 30,
    complianceScore: 87,
    riskLevel: 'medium',
    lastCalculated: new Date()
  });

  const [trendData] = useState<TrendData[]>([
    { period: 'Jan', completed: 85, overdue: 5, pending: 10, complianceScore: 85 },
    { period: 'Feb', completed: 88, overdue: 4, pending: 8, complianceScore: 87 },
    { period: 'Mar', completed: 90, overdue: 3, pending: 7, complianceScore: 89 },
    { period: 'Apr', completed: 87, overdue: 6, pending: 7, complianceScore: 86 },
    { period: 'May', completed: 92, overdue: 2, pending: 6, complianceScore: 91 },
    { period: 'Jun', completed: 89, overdue: 3, pending: 8, complianceScore: 87 }
  ]);

  const [riskAnalysis] = useState<RiskAnalysis[]>([
    { category: 'Financial Aid', risk: 85, regulations: 23, trend: 'up' },
    { category: 'Student Privacy', risk: 72, regulations: 18, trend: 'stable' },
    { category: 'Accessibility', risk: 91, regulations: 31, trend: 'down' },
    { category: 'Safety & Security', risk: 68, regulations: 15, trend: 'up' },
    { category: 'Academic Standards', risk: 79, regulations: 25, trend: 'stable' }
  ]);

  const [systemUsage] = useState<SystemUsage>({
    activeUsers: 47,
    totalLogins: 1543,
    averageSessionDuration: 23.5,
    storageUsed: 2.3,
    apiCallsThisMonth: 12789,
    emailsSent: 234
  });

  const deadlineDistribution = [
    { name: 'Completed', value: metrics.completedDeadlines, color: COLORS.success },
    { name: 'Upcoming', value: metrics.upcomingDeadlines, color: COLORS.warning },
    { name: 'Overdue', value: metrics.overdueDeadlines, color: COLORS.danger },
  ];

  const regulationStatusData = [
    { name: 'Active', value: metrics.activeRegulations, color: COLORS.success },
    { name: 'Inactive', value: metrics.totalRegulations - metrics.activeRegulations, color: COLORS.gray },
  ];

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      case 'critical': return 'bg-red-200 text-red-900';
      default: return 'bg-gray-100 text-foreground';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance Analytics</h1>
          <p className="text-muted-foreground">
            Last updated: {metrics.lastCalculated.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Compliance Score</p>
                <div className="flex items-center mt-2">
                  <span className="text-2xl font-bold">{metrics.complianceScore}%</span>
                  <Badge className={`ml-2 ${getRiskLevelColor(metrics.riskLevel)}`}>
                    {metrics.riskLevel}
                  </Badge>
                </div>
                <Progress value={metrics.complianceScore} className="mt-2" />
              </div>
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Active Regulations</p>
                <p className="text-2xl font-bold">{metrics.activeRegulations}</p>
                <p className="text-xs text-muted-foreground">of {metrics.totalRegulations} total</p>
              </div>
              <FileText className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Upcoming Deadlines</p>
                <p className="text-2xl font-bold">{metrics.upcomingDeadlines}</p>
                {metrics.overdueDeadlines > 0 && (
                  <p className="text-xs text-red-500">{metrics.overdueDeadlines} overdue</p>
                )}
              </div>
              <Calendar className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{systemUsage.activeUsers}</p>
                <p className="text-xs text-muted-foreground">
                  Avg. session: {systemUsage.averageSessionDuration}m
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {metrics.overdueDeadlines > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have {metrics.overdueDeadlines} overdue deadline{metrics.overdueDeadlines > 1 ? 's' : ''} 
            that require immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
          <TabsTrigger value="usage">System Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deadline Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Deadline Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={deadlineDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {deadlineDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Regulation Status */}
            <Card>
              <CardHeader>
                <CardTitle>Regulation Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={regulationStatusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill={COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Trends Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stackId="1"
                    stroke={COLORS.success}
                    fill={COLORS.success}
                    fillOpacity={0.8}
                  />
                  <Area
                    type="monotone"
                    dataKey="pending"
                    stackId="1"
                    stroke={COLORS.warning}
                    fill={COLORS.warning}
                    fillOpacity={0.8}
                  />
                  <Area
                    type="monotone"
                    dataKey="overdue"
                    stackId="1"
                    stroke={COLORS.danger}
                    fill={COLORS.danger}
                    fillOpacity={0.8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance Score Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="complianceScore"
                    stroke={COLORS.primary}
                    strokeWidth={3}
                    dot={{ fill: COLORS.primary, strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Analysis by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {riskAnalysis.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{item.category}</h3>
                        <div className="flex items-center space-x-2">
                          {getTrendIcon(item.trend)}
                          <span className="text-sm text-muted-foreground">{item.regulations} regulations</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Progress value={item.risk} className="flex-1" />
                        <span className="text-sm font-medium">{item.risk}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Logins</p>
                    <p className="text-2xl font-bold">{systemUsage.totalLogins.toLocaleString()}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Storage Used</p>
                    <p className="text-2xl font-bold">{systemUsage.storageUsed} GB</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">API Calls</p>
                    <p className="text-2xl font-bold">{systemUsage.apiCallsThisMonth.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">this month</p>
                  </div>
                  <Target className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}; 