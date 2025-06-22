import React, { useState, useEffect } from 'react';
import { Shield, Users, Building2, Database, Settings, BarChart3, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

interface TenantStats {
  id: string;
  name: string;
  userCount: number;
  regulationCount: number;
  status: 'active' | 'inactive' | 'suspended';
  lastActivity: string;
}

interface SystemMetrics {
  totalTenants: number;
  totalUsers: number;
  totalRegulations: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  recentActivity: Array<{
    tenant: string;
    action: string;
    timestamp: string;
    user: string;
  }>;
}

export default function AdminConsolePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [tenantStats, setTenantStats] = useState<TenantStats[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Only admin users can access this page
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Access denied. This page is restricted to system administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  useEffect(() => {
    fetchSystemData();
  }, []);

  const fetchSystemData = async () => {
    setLoading(true);
    try {
      // Fetch tenant statistics
      const tenantsResponse = await fetch('/api/admin/tenants');
      if (tenantsResponse.ok) {
        const tenants = await tenantsResponse.json();
        setTenantStats(tenants);
      }

      // Fetch system metrics
      const metricsResponse = await fetch('/api/admin/metrics');
      if (metricsResponse.ok) {
        const metrics = await metricsResponse.json();
        setSystemMetrics(metrics);
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">EdSteward Admin Console</h1>
                <p className="text-sm text-gray-500">System Administration & Tenant Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                System Admin
              </Badge>
              <span className="text-sm text-gray-500">{user.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* System Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{systemMetrics?.totalTenants || 0}</div>
                      <p className="text-xs text-muted-foreground">Active organizations</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{systemMetrics?.totalUsers || 0}</div>
                      <p className="text-xs text-muted-foreground">Across all tenants</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Regulations</CardTitle>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{systemMetrics?.totalRegulations || 0}</div>
                      <p className="text-xs text-muted-foreground">System-wide compliance items</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">System Health</CardTitle>
                      <BarChart3 className={`h-4 w-4 ${getHealthColor(systemMetrics?.systemHealth || 'healthy')}`} />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${getHealthColor(systemMetrics?.systemHealth || 'healthy')}`}>
                        {systemMetrics?.systemHealth || 'Unknown'}
                      </div>
                      <p className="text-xs text-muted-foreground">Overall system status</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Clock className="h-5 w-5" />
                      <span>Recent Activity</span>
                    </CardTitle>
                    <CardDescription>Latest actions across all tenants</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {systemMetrics?.recentActivity?.map((activity, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline" className="text-xs">
                              {activity.tenant}
                            </Badge>
                            <span className="text-sm">{activity.action}</span>
                            <span className="text-xs text-gray-500">by {activity.user}</span>
                          </div>
                          <span className="text-xs text-gray-400">{activity.timestamp}</span>
                        </div>
                      )) || (
                        <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Tenants Tab */}
          <TabsContent value="tenants" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Tenant Management</h2>
              <Button>Add New Tenant</Button>
            </div>
            
            <div className="grid gap-4">
              {tenantStats.map((tenant) => (
                <Card key={tenant.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium">{tenant.name}</h3>
                          <p className="text-sm text-gray-500">ID: {tenant.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-sm font-medium">{tenant.userCount}</div>
                          <div className="text-xs text-gray-500">Users</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium">{tenant.regulationCount}</div>
                          <div className="text-xs text-gray-500">Regulations</div>
                        </div>
                        <Badge className={getStatusColor(tenant.status)}>
                          {tenant.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage users across all tenants</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">User management interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system">
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>System-wide settings and monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">System configuration interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Global Settings</CardTitle>
                <CardDescription>Platform-wide configuration options</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">Global settings interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 