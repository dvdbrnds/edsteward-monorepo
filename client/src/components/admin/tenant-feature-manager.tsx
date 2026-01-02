import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
// import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Building2, 
  Settings, 
  Activity, 
  Users, 
  // Database, 
  // ToggleLeft, 
  // ToggleRight,
  AlertCircle, 
  CheckCircle, 
  Clock,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Power,
  PowerOff,
  // MessageSquare,
  Bell,
  Zap
} from 'lucide-react';
import { FEATURE_FLAGS, FEATURE_CATEGORIES } from '@shared/feature-flags';

interface Tenant {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended';
  userCount: number;
  regulationCount: number;
  lastActivity: string;
  featureFlags: Record<string, boolean>;
  health: 'healthy' | 'warning' | 'critical';
  uptime: string;
}

interface FeatureRollout {
  featureKey: string;
  featureName: string;
  targetTenants: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  progress: number;
}

export default function TenantFeatureManager() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [rollouts, setRollouts] = useState<FeatureRollout[]>([]);
  const [isRolloutDialogOpen, setIsRolloutDialogOpen] = useState(false);
  const [selectedFeatureForRollout, setSelectedFeatureForRollout] = useState<string>('');

  // Mock data - replace with real API calls
  useEffect(() => {
    const mockTenants: Tenant[] = [
      {
        id: 'moravian',
        name: 'Moravian University',
        domain: 'moravian.edu',
        status: 'active',
        userCount: 45,
        regulationCount: 367,
        lastActivity: '2 minutes ago',
        featureFlags: {
          'advanced_dashboard': true,
          'bulk_operations': false,
          'document_ai': true,
          'email_notifications': true,
          'sms_notifications': false
        },
        health: 'healthy',
        uptime: '99.9%'
      },
      {
        id: 'admin',
        name: 'EdSteward Admin',
        domain: 'edsteward.ai',
        status: 'active',
        userCount: 3,
        regulationCount: 367,
        lastActivity: '1 minute ago',
        featureFlags: {
          'advanced_dashboard': true,
          'bulk_operations': true,
          'document_ai': true,
          'email_notifications': true,
          'tenant_analytics': true,
          'user_impersonation': true
        },
        health: 'healthy',
        uptime: '99.8%'
      },
      {
        id: 'staging',
        name: 'EdSteward Staging',
        domain: 'staging.edsteward.ai',
        status: 'active',
        userCount: 1,
        regulationCount: 5,
        lastActivity: '5 minutes ago',
        featureFlags: {
          'advanced_dashboard': true,
          'bulk_operations': true,
          'document_ai': false,
          'email_notifications': false
        },
        health: 'warning',
        uptime: '98.5%'
      }
    ];

    const mockRollouts: FeatureRollout[] = [
      {
        featureKey: 'document_ai',
        featureName: 'Document AI Analysis',
        targetTenants: ['moravian', 'admin'],
        status: 'completed',
        startedAt: '2025-01-20T10:00:00Z',
        completedAt: '2025-01-20T10:15:00Z',
        progress: 100
      },
      {
        featureKey: 'advanced_search',
        featureName: 'Advanced Search',
        targetTenants: ['moravian', 'admin', 'staging'],
        status: 'in-progress',
        startedAt: '2025-01-20T14:00:00Z',
        progress: 66
      }
    ];

    setTimeout(() => {
      setTenants(mockTenants);
      setRollouts(mockRollouts);
      setIsLoading(false);
    }, 1000);
  }, []);

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tenant.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredFeatures = Object.entries(FEATURE_FLAGS).filter(([, feature]) => {
    if (selectedCategory === 'all') return true;
    return feature.category === selectedCategory;
  });

  const handleFeatureToggle = async (tenantId: string, featureKey: string, enabled: boolean) => {
    try {
      // Optimistic update
      setTenants(prev => prev.map(tenant => {
        if (tenant.id === tenantId) {
          return {
            ...tenant,
            featureFlags: {
              ...tenant.featureFlags,
              [featureKey]: enabled
            }
          };
        }
        return tenant;
      }));

      // TODO: Replace with actual API call
      const response = await fetch(`/api/admin/tenants/${tenantId}/features`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [featureKey]: enabled })
      });

      if (!response.ok) {
        throw new Error('Failed to update feature');
      }

      console.log(`Feature ${featureKey} ${enabled ? 'enabled' : 'disabled'} for tenant ${tenantId}`);
    } catch (error) {
      console.error('Error updating feature:', error);
      // Revert optimistic update
      setTenants(prev => prev.map(tenant => {
        if (tenant.id === tenantId) {
          return {
            ...tenant,
            featureFlags: {
              ...tenant.featureFlags,
              [featureKey]: !enabled
            }
          };
        }
        return tenant;
      }));
    }
  };

  const handleBulkFeatureToggle = async (featureKey: string, enabled: boolean) => {
    const activeTenants = tenants.filter(t => t.status === 'active');
    
    for (const tenant of activeTenants) {
      await handleFeatureToggle(tenant.id, featureKey, enabled);
    }
  };

  const startFeatureRollout = (featureKey: string, targetTenantIds: string[]) => {
    const feature = FEATURE_FLAGS[featureKey];
    if (!feature) return;

    const newRollout: FeatureRollout = {
      featureKey,
      featureName: feature.name,
      targetTenants: targetTenantIds,
      status: 'pending',
      startedAt: new Date().toISOString(),
      progress: 0
    };

    setRollouts(prev => [...prev, newRollout]);
    setIsRolloutDialogOpen(false);
    
    // Simulate rollout progress
    setTimeout(() => {
      setRollouts(prev => prev.map(r => 
        r.featureKey === featureKey && r.status === 'pending' 
          ? { ...r, status: 'in-progress', progress: 50 }
          : r
      ));
    }, 2000);

    setTimeout(() => {
      setRollouts(prev => prev.map(r => 
        r.featureKey === featureKey && r.status === 'in-progress' 
          ? { ...r, status: 'completed', progress: 100, completedAt: new Date().toISOString() }
          : r
      ));
      
      // Actually enable the feature for target tenants
      targetTenantIds.forEach(tenantId => {
        handleFeatureToggle(tenantId, featureKey, true);
      });
    }, 5000);
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-secondary" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-accent" />;
      case 'critical': return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-secondary/10 text-secondary';
      case 'inactive': return 'bg-muted text-muted-foreground';
      case 'suspended': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRolloutStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-secondary/10 text-secondary';
      case 'in-progress': return 'bg-primary/10 text-primary';
      case 'pending': return 'bg-accent/10 text-accent';
      case 'failed': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenant Feature Management</h1>
          <p className="text-muted-foreground">Monitor tenants and manage feature flags across the platform</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsLoading(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isRolloutDialogOpen} onOpenChange={setIsRolloutDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Zap className="h-4 w-4 mr-2" />
                Start Rollout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start Feature Rollout</DialogTitle>
                <DialogDescription>
                  Enable a feature for multiple tenants in a controlled manner
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Feature</Label>
                  <Select value={selectedFeatureForRollout} onValueChange={setSelectedFeatureForRollout}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a feature" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FEATURE_FLAGS).map(([key, feature]) => (
                        <SelectItem key={key} value={key}>
                          {feature.name} ({feature.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target Tenants</Label>
                  <div className="mt-2 space-y-2">
                    {tenants.filter(t => t.status === 'active').map(tenant => (
                      <div key={tenant.id} className="flex items-center space-x-2">
                        <input type="checkbox" id={tenant.id} />
                        <label htmlFor={tenant.id} className="text-sm">{tenant.name}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRolloutDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => startFeatureRollout(selectedFeatureForRollout, ['moravian', 'admin'])}>
                  Start Rollout
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.filter(t => t.status === 'active').length}</div>
            <p className="text-xs text-muted-foreground">of {tenants.length} total</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.reduce((sum, t) => sum + t.userCount, 0)}</div>
            <p className="text-xs text-muted-foreground">across all tenants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Features Available</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(FEATURE_FLAGS).length}</div>
            <p className="text-xs text-muted-foreground">feature flags</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rollouts</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rollouts.filter(r => r.status === 'in-progress').length}</div>
            <p className="text-xs text-muted-foreground">in progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Tenant Overview</TabsTrigger>
          <TabsTrigger value="features">Feature Management</TabsTrigger>
          <TabsTrigger value="rollouts">Rollout History</TabsTrigger>
          <TabsTrigger value="monitoring">Real-time Monitoring</TabsTrigger>
        </TabsList>

        {/* Tenant Overview Tab */}
        <TabsContent value="tenants" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid gap-4">
            {filteredTenants.map((tenant) => (
              <Card key={tenant.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold">{tenant.name}</h3>
                          <Badge className={getStatusColor(tenant.status)}>
                            {tenant.status}
                          </Badge>
                          {getHealthIcon(tenant.health)}
                        </div>
                        <p className="text-sm text-muted-foreground">{tenant.domain}</p>
                        <p className="text-xs text-muted-foreground">
                          {tenant.userCount} users • {tenant.regulationCount} regulations • Last active: {tenant.lastActivity}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <div className="text-sm font-medium text-secondary">{tenant.uptime}</div>
                        <div className="text-xs text-muted-foreground">Uptime</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          {Object.values(tenant.featureFlags).filter(Boolean).length}
                        </div>
                        <div className="text-xs text-muted-foreground">Features On</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTenant(tenant)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Manage
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Feature Management Tab */}
        <TabsContent value="features" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="pl-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(FEATURE_CATEGORIES).map(([key, name]) => (
                    <SelectItem key={key} value={key}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredFeatures.map(([featureKey, feature]) => (
              <Card key={featureKey}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{feature.name}</CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                      <Badge variant="outline" className="mt-2">
                        {FEATURE_CATEGORIES[feature.category]}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkFeatureToggle(featureKey, true)}
                      >
                        <Power className="h-4 w-4 mr-1" />
                        Enable All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkFeatureToggle(featureKey, false)}
                      >
                        <PowerOff className="h-4 w-4 mr-1" />
                        Disable All
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {tenants.map((tenant) => {
                      const isEnabled = tenant.featureFlags[featureKey] ?? feature.defaultValue;
                      return (
                        <div key={tenant.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <div className="font-medium">{tenant.name}</div>
                            <div className="text-sm text-muted-foreground">{tenant.id}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => handleFeatureToggle(tenant.id, featureKey, checked)}
                            />
                            <Badge variant={isEnabled ? "default" : "secondary"}>
                              {isEnabled ? "On" : "Off"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Rollout History Tab */}
        <TabsContent value="rollouts" className="space-y-4">
          <div className="space-y-4">
            {rollouts.map((rollout, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{rollout.featureName}</h3>
                      <p className="text-sm text-muted-foreground">
                        Target: {rollout.targetTenants.join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Started: {rollout.startedAt ? new Date(rollout.startedAt).toLocaleString() : 'Not started'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{rollout.progress}%</div>
                        <div className="text-xs text-muted-foreground">Progress</div>
                      </div>
                      <Badge className={getRolloutStatusColor(rollout.status)}>
                        {rollout.status}
                      </Badge>
                    </div>
                  </div>
                  {rollout.status === 'in-progress' && (
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${rollout.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Real-time Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Feature Usage Analytics</CardTitle>
                <CardDescription>Real-time feature adoption across tenants</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(FEATURE_FLAGS).slice(0, 5).map(([key, feature]) => {
                    const enabledCount = tenants.filter(t => t.featureFlags[key] ?? feature.defaultValue).length;
                    const percentage = Math.round((enabledCount / tenants.length) * 100);
                    
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{feature.name}</span>
                          <span>{enabledCount}/{tenants.length} ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Monitor tenant health and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tenants.map((tenant) => (
                    <div key={tenant.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getHealthIcon(tenant.health)}
                        <div>
                          <div className="font-medium">{tenant.name}</div>
                          <div className="text-sm text-muted-foreground">{tenant.uptime} uptime</div>
                        </div>
                      </div>
                      <Badge variant={tenant.health === 'healthy' ? 'default' : 'destructive'}>
                        {tenant.health}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <Bell className="h-4 w-4" />
            <AlertDescription>
              <strong>Feature Disabled Messaging:</strong> When features are disabled, tenants will see contextual messages 
              explaining why certain functionality is unavailable. This provides transparency and encourages feature adoption.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {/* Tenant Detail Dialog */}
      {selectedTenant && (
        <Dialog open={!!selectedTenant} onOpenChange={() => setSelectedTenant(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedTenant.name} - Feature Configuration</DialogTitle>
              <DialogDescription>
                Manage feature flags and settings for this tenant
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(FEATURE_FLAGS).map(([key, feature]) => {
                const isEnabled = selectedTenant.featureFlags[key] ?? feature.defaultValue;
                return (
                  <div key={key} className="flex items-center justify-between p-4 border rounded">
                    <div>
                      <div className="font-medium">{feature.name}</div>
                      <div className="text-sm text-muted-foreground">{feature.description}</div>
                      <Badge variant="outline" className="mt-1">
                        {FEATURE_CATEGORIES[feature.category]}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => {
                          handleFeatureToggle(selectedTenant.id, key, checked);
                          setSelectedTenant(prev => prev ? {
                            ...prev,
                            featureFlags: {
                              ...prev.featureFlags,
                              [key]: checked
                            }
                          } : null);
                        }}
                      />
                      <Badge variant={isEnabled ? "default" : "secondary"}>
                        {isEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTenant(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}