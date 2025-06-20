import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Users, Database, Activity, Plus, Settings, Trash2, Eye, AlertCircle, CheckCircle } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  domain: string;
  database: string;
  status: 'active' | 'inactive' | 'setup' | 'suspended';
  userCount: number;
  regulationCount: number;
  lastActivity: string;
  createdAt: string;
  samlConfigured: boolean;
  billingStatus: 'active' | 'trial' | 'overdue' | 'cancelled';
}

interface SystemMetrics {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalRegulations: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  uptime: string;
}

export default function TenantManagementDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data for development
  useEffect(() => {
    const mockTenants: Tenant[] = [
      {
        id: 'admin',
        name: 'EdSteward Admin',
        domain: 'edsteward.ai',
        database: 'edsteward_admin',
        status: 'active',
        userCount: 1,
        regulationCount: 367,
        lastActivity: '2025-06-20T15:01:10.000Z',
        createdAt: '2025-03-01T00:00:00.000Z',
        samlConfigured: false,
        billingStatus: 'active'
      },
      {
        id: 'moravian',
        name: 'Moravian University',
        domain: 'moravian.edu',
        database: 'edsteward_moravian',
        status: 'setup',
        userCount: 0,
        regulationCount: 0,
        lastActivity: 'Never',
        createdAt: '2025-06-20T14:00:00.000Z',
        samlConfigured: false,
        billingStatus: 'trial'
      }
    ];

    const mockMetrics: SystemMetrics = {
      totalTenants: mockTenants.length,
      activeTenants: mockTenants.filter(t => t.status === 'active').length,
      totalUsers: mockTenants.reduce((sum, t) => sum + t.userCount, 0),
      totalRegulations: mockTenants.reduce((sum, t) => sum + t.regulationCount, 0),
      systemHealth: 'healthy',
      uptime: '15 days, 4 hours'
    };

    setTimeout(() => {
      setTenants(mockTenants);
      setSystemMetrics(mockMetrics);
      setIsLoading(false);
    }, 1000);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'setup': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">EdSteward Vendor Admin</h1>
          <p className="text-muted-foreground">Manage tenants, monitor system health, and oversee platform operations</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateTenantForm onClose={() => setIsCreateDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* System Metrics Overview */}
      {systemMetrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemMetrics.totalTenants}</div>
              <p className="text-xs text-muted-foreground">
                {systemMetrics.activeTenants} active
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemMetrics.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Across all tenants
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Regulations</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemMetrics.totalRegulations}</div>
              <p className="text-xs text-muted-foreground">
                Total in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium capitalize">{systemMetrics.systemHealth}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Uptime: {systemMetrics.uptime}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="system">System Monitor</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Management</CardTitle>
              <CardDescription>
                Manage all tenant organizations and their configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tenants.map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">{tenant.name}</h3>
                          <Badge className={getStatusColor(tenant.status)}>
                            {tenant.status}
                          </Badge>
                          <Badge className={getBillingStatusColor(tenant.billingStatus)}>
                            {tenant.billingStatus}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{tenant.domain}</p>
                        <p className="text-xs text-muted-foreground">
                          {tenant.userCount} users • {tenant.regulationCount} regulations
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-1" />
                        Configure
                      </Button>
                      {tenant.id !== 'admin' && (
                        <Button variant="outline" size="sm" className="text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Monitor</CardTitle>
              <CardDescription>
                Real-time system health and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All systems operational. Database connections healthy. Multi-tenant isolation active.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing & Usage</CardTitle>
              <CardDescription>
                Monitor tenant usage and billing status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Billing management interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Analytics</CardTitle>
              <CardDescription>
                Usage analytics and platform insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics dashboard coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateTenantForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    tenantId: '',
    name: '',
    domain: '',
    adminEmail: '',
    samlEntryPoint: '',
    samlCert: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement tenant creation API call
    console.log('Creating tenant:', formData);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Create New Tenant</DialogTitle>
        <DialogDescription>
          Add a new organization to the EdSteward platform
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="tenantId">Tenant ID</Label>
          <Input
            id="tenantId"
            value={formData.tenantId}
            onChange={(e) => setFormData(prev => ({ ...prev, tenantId: e.target.value }))}
            placeholder="university-name"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="name">Organization Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="University Name"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="domain">Email Domain</Label>
          <Input
            id="domain"
            value={formData.domain}
            onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
            placeholder="university.edu"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="adminEmail">Admin Email</Label>
          <Input
            id="adminEmail"
            type="email"
            value={formData.adminEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, adminEmail: e.target.value }))}
            placeholder="admin@university.edu"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="samlEntryPoint">SAML Entry Point (Optional)</Label>
          <Input
            id="samlEntryPoint"
            value={formData.samlEntryPoint}
            onChange={(e) => setFormData(prev => ({ ...prev, samlEntryPoint: e.target.value }))}
            placeholder="https://university.edu/saml/sso"
          />
        </div>
      </div>
      
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">
          Create Tenant
        </Button>
      </DialogFooter>
    </form>
  );
} 