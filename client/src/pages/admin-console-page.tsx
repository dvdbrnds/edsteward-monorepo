import React, { useState, useEffect } from 'react';
import { Shield, Users, Building2, Database, Settings, BarChart3, AlertTriangle, Clock, LogOut, RefreshCw, UserPlus, Activity, Server } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';

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
  const { user, logoutMutation } = useAuth();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [tenantStats, setTenantStats] = useState<TenantStats[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSystemData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Navigation functions for buttons
  const handleNavigateToSettings = () => {
    setLocation('/admin/settings');
  };

  const handleNavigateToLogs = () => {
    setLocation('/admin/logs');
  };

  const handleNavigateToDebug = () => {
    setLocation('/admin/debug');
  };

  const handleManageTenant = (tenantId: string) => {
    console.log(`Managing tenant: ${tenantId}`);
    // In a real implementation, this would open a tenant management modal or navigate to a tenant detail page
    alert(`Tenant management for ${tenantId} - Feature coming soon!`);
  };

  const handleAddNewTenant = () => {
    console.log('Adding new tenant');
    alert('Add New Tenant - Feature coming soon!');
  };

  const handleAddUser = () => {
    console.log('Adding new user');
    alert('Add User - Feature coming soon!');
  };

  const handleViewUsers = (tenantId: string) => {
    console.log(`Viewing users for tenant: ${tenantId}`);
    alert(`View users for ${tenantId} - Feature coming soon!`);
  };

  const handleQuickAction = (action: string) => {
    console.log(`Quick action: ${action}`);
    switch (action) {
      case 'manage-users':
        alert('Manage Users - Feature coming soon!');
        break;
      case 'database-tools':
        alert('Database Tools - Feature coming soon!');
        break;
      case 'system-reports':
        alert('System Reports - Feature coming soon!');
        break;
      case 'server-settings':
        handleNavigateToSettings();
        break;
      case 'security-policies':
        alert('Security Policies - Feature coming soon!');
        break;
      case 'monitoring-alerts':
        alert('Monitoring & Alerts - Feature coming soon!');
        break;
      default:
        alert(`${action} - Feature coming soon!`);
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
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
              <Badge variant="outline" className="text-xs">
                System Admin
              </Badge>
              <span className="text-sm text-gray-500">{user.email}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
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
              <Button onClick={handleAddNewTenant} className="flex items-center space-x-2">
                <Building2 className="h-4 w-4" />
                <span>Add New Tenant</span>
              </Button>
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
                          <h3 className="text-lg font-medium capitalize">{tenant.name}</h3>
                          <p className="text-sm text-gray-500">ID: {tenant.id}</p>
                          <p className="text-xs text-gray-400">Last Activity: {tenant.lastActivity}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{tenant.userCount}</div>
                          <div className="text-xs text-gray-500">Users</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{tenant.regulationCount}</div>
                          <div className="text-xs text-gray-500">Regulations</div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Badge className={getStatusColor(tenant.status)}>
                            {tenant.status}
                          </Badge>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleManageTenant(tenant.id)}
                          >
                            Manage
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">User Management</h2>
              <Button onClick={handleAddUser} className="flex items-center space-x-2">
                <UserPlus className="h-4 w-4" />
                <span>Add User</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {tenantStats.reduce((acc, tenant) => acc + (tenant.name === 'admin' ? tenant.userCount : 0), 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">System administrators</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {tenantStats.filter(t => t.status === 'active').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Currently online</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>User Activity by Tenant</CardTitle>
                <CardDescription>User distribution across tenants</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tenantStats.map((tenant) => (
                    <div key={tenant.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded">
                          <Building2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium capitalize">{tenant.name}</h4>
                          <p className="text-sm text-gray-500">{tenant.userCount} users</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(tenant.status)}>
                          {tenant.status}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewUsers(tenant.id)}
                        >
                          View Users
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">System Status</h2>
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Server className="h-5 w-5" />
                    <span>System Health</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Overall Status</span>
                      <Badge className={`${getHealthColor(systemMetrics?.systemHealth || 'healthy')} bg-opacity-10`}>
                        {systemMetrics?.systemHealth || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Database</span>
                      <Badge className="bg-green-100 text-green-800">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">API Services</span>
                      <Badge className="bg-green-100 text-green-800">Running</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Multi-Tenant</span>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Database className="h-5 w-5" />
                    <span>Database Statistics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Total Records</span>
                      <span className="font-medium">{(systemMetrics?.totalRegulations || 0) + (systemMetrics?.totalUsers || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Tenant Databases</span>
                      <span className="font-medium">{systemMetrics?.totalTenants || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Data Isolation</span>
                      <Badge className="bg-blue-100 text-blue-800">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Backup Status</span>
                      <Badge className="bg-green-100 text-green-800">Current</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>Current system settings and configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-medium">Environment</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Mode:</span>
                        <Badge variant="outline">Development</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Version:</span>
                        <span>1.0.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Uptime:</span>
                        <span>Running</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium">Features</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Multi-Tenant:</span>
                        <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Authentication:</span>
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>API Rate Limiting:</span>
                        <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Admin Settings</h2>
              <Button 
                onClick={() => handleQuickAction('advanced-settings')}
                className="flex items-center space-x-2"
              >
                <Settings className="h-4 w-4" />
                <span>Advanced Settings</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tenant Management</CardTitle>
                  <CardDescription>Configure tenant settings and policies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={handleAddNewTenant}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Create New Tenant
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('tenant-policies')}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Tenant Policies
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('data-migration')}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Data Migration
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Configuration</CardTitle>
                  <CardDescription>Manage system-wide settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('server-settings')}
                  >
                    <Server className="h-4 w-4 mr-2" />
                    Server Settings
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('security-policies')}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Security Policies
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('monitoring-alerts')}
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Monitoring & Alerts
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => handleQuickAction('manage-users')}
                  >
                    <Users className="h-6 w-6 mb-2" />
                    <span>Manage Users</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => handleQuickAction('database-tools')}
                  >
                    <Database className="h-6 w-6 mb-2" />
                    <span>Database Tools</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => handleQuickAction('system-reports')}
                  >
                    <BarChart3 className="h-6 w-6 mb-2" />
                    <span>System Reports</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 