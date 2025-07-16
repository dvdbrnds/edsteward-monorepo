import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Server,
    Plus,
    Activity,
    Users,
    Database,
    Settings,
    AlertCircle,
    CheckCircle,
    Clock,
    RefreshCw,
    Search,
    Play,
    Pause,
    Trash2,
    Eye,
    Globe,
    Cpu,
    HardDrive,
    Zap,
    LogOut,
    FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TenantDeployment {
    id: string;
    institutionName: string;
    domain: string;
    status: 'provisioning' | 'active' | 'failed' | 'stopping' | 'stopped';
    lastUpdated: Date;
    infrastructure: {
        clusterId: string;
        serviceId: string;
        hasTaskDefinition: boolean;
        hasTargetGroup: boolean;
        hasListenerRule: boolean;
    };
}

interface TenantDetails extends TenantDeployment {
    config: {
        institutionName: string;
        domain: string;
        port: number;
        nodeEnv: string;
        additionalEnvVars: Record<string, string>;
    };
    serviceStatus: string;
}

interface TenantLog {
    timestamp: Date;
    message: string;
}

export default function AWSTenantsManagement() {
    const { toast } = useToast();
    const [tenants, setTenants] = useState<TenantDeployment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTenant, setSelectedTenant] = useState<TenantDetails | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [tenantLogs, setTenantLogs] = useState<TenantLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    // Form state for creating new tenant
    const [newTenant, setNewTenant] = useState({
        tenantId: '',
        institutionName: '',
        domain: '',
        databaseUrl: '',
        sessionSecret: '',
        nodeEnv: 'production',
        additionalEnvVars: ''
    });

    // Fetch tenants
    const fetchTenants = async () => {
        try {
            const response = await fetch('/api/aws-tenant-management/tenants', {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success) {
                setTenants(data.tenants.map((tenant: any) => ({
                    ...tenant,
                    lastUpdated: new Date(tenant.lastUpdated)
                })));
            } else {
                throw new Error(data.message || 'Failed to fetch tenants');
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to fetch tenants",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch tenant details
    const fetchTenantDetails = async (tenantId: string) => {
        try {
            const response = await fetch(`/api/aws-tenant-management/tenants/${tenantId}`, {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success) {
                setSelectedTenant({
                    ...data.tenant,
                    lastUpdated: new Date(data.tenant.lastUpdated)
                });
            } else {
                throw new Error(data.message || 'Failed to fetch tenant details');
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to fetch tenant details",
                variant: "destructive",
            });
        }
    };

    // Fetch tenant logs
    const fetchTenantLogs = async (tenantId: string) => {
        setIsLoadingLogs(true);
        try {
            const response = await fetch(`/api/aws-tenant-management/tenants/${tenantId}/logs`, {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success) {
                setTenantLogs(data.logs.map((log: any) => ({
                    ...log,
                    timestamp: new Date(log.timestamp)
                })));
            } else {
                throw new Error(data.message || 'Failed to fetch logs');
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to fetch logs",
                variant: "destructive",
            });
        } finally {
            setIsLoadingLogs(false);
        }
    };

    // Create new tenant
    const createTenant = async () => {
        setIsCreating(true);
        try {
            const additionalEnvVars = newTenant.additionalEnvVars
                ? JSON.parse(newTenant.additionalEnvVars)
                : {};

            const response = await fetch('/api/aws-tenant-management/tenants', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    ...newTenant,
                    additionalEnvVars
                })
            });

            const data = await response.json();

            if (data.success) {
                toast({
                    title: "Success",
                    description: `Tenant ${newTenant.tenantId} provisioning started`,
                });
                setIsCreateDialogOpen(false);
                setNewTenant({
                    tenantId: '',
                    institutionName: '',
                    domain: '',
                    databaseUrl: '',
                    sessionSecret: '',
                    nodeEnv: 'production',
                    additionalEnvVars: ''
                });
                fetchTenants();
            } else {
                throw new Error(data.message || 'Failed to create tenant');
            }
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to create tenant",
                variant: "destructive",
            });
        } finally {
            setIsCreating(false);
        }
    };

    // Restart tenant
    const restartTenant = async (tenantId: string) => {
        try {
            const response = await fetch(`/api/aws-tenant-management/tenants/${tenantId}/restart`, {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                toast({
                    title: "Success",
                    description: `Tenant ${tenantId} restart initiated`,
                });
                fetchTenants();
            } else {
                throw new Error(data.message || 'Failed to restart tenant');
            }
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to restart tenant",
                variant: "destructive",
            });
        }
    };

    // Delete tenant
    const deleteTenant = async (tenantId: string) => {
        if (!confirm(`Are you sure you want to delete tenant ${tenantId}? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/aws-tenant-management/tenants/${tenantId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                toast({
                    title: "Success",
                    description: `Tenant ${tenantId} deprovisioning started`,
                });
                fetchTenants();
            } else {
                throw new Error(data.message || 'Failed to delete tenant');
            }
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to delete tenant",
                variant: "destructive",
            });
        }
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const filteredTenants = tenants.filter(tenant =>
        tenant.institutionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.domain.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'provisioning': return 'bg-blue-100 text-blue-800';
            case 'failed': return 'bg-red-100 text-red-800';
            case 'stopping': return 'bg-yellow-100 text-yellow-800';
            case 'stopped': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active': return <CheckCircle className="h-4 w-4" />;
            case 'provisioning': return <Clock className="h-4 w-4" />;
            case 'failed': return <AlertCircle className="h-4 w-4" />;
            case 'stopping': return <Pause className="h-4 w-4" />;
            case 'stopped': return <Pause className="h-4 w-4" />;
            default: return <AlertCircle className="h-4 w-4" />;
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
                    <h1 className="text-3xl font-bold tracking-tight">AWS Tenant Management</h1>
                    <p className="text-muted-foreground">Manage single-tenant AWS deployments</p>
                </div>
                <div className="flex items-center space-x-4">
                    <Button variant="outline" onClick={fetchTenants}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Tenant
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Create New Tenant Deployment</DialogTitle>
                                <DialogDescription>
                                    Deploy a new single-tenant EdSteward instance to AWS
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="tenantId">Tenant ID</Label>
                                        <Input
                                            id="tenantId"
                                            value={newTenant.tenantId}
                                            onChange={(e) => setNewTenant({ ...newTenant, tenantId: e.target.value })}
                                            placeholder="e.g., university-abc"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="institutionName">Institution Name</Label>
                                        <Input
                                            id="institutionName"
                                            value={newTenant.institutionName}
                                            onChange={(e) => setNewTenant({ ...newTenant, institutionName: e.target.value })}
                                            placeholder="e.g., University ABC"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="domain">Domain</Label>
                                    <Input
                                        id="domain"
                                        value={newTenant.domain}
                                        onChange={(e) => setNewTenant({ ...newTenant, domain: e.target.value })}
                                        placeholder="e.g., universityabc.edsteward.ai"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="databaseUrl">Database URL</Label>
                                    <Input
                                        id="databaseUrl"
                                        type="password"
                                        value={newTenant.databaseUrl}
                                        onChange={(e) => setNewTenant({ ...newTenant, databaseUrl: e.target.value })}
                                        placeholder="PostgreSQL connection string"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="sessionSecret">Session Secret</Label>
                                    <Input
                                        id="sessionSecret"
                                        type="password"
                                        value={newTenant.sessionSecret}
                                        onChange={(e) => setNewTenant({ ...newTenant, sessionSecret: e.target.value })}
                                        placeholder="Random secret for session encryption"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="nodeEnv">Environment</Label>
                                    <select
                                        id="nodeEnv"
                                        value={newTenant.nodeEnv}
                                        onChange={(e) => setNewTenant({ ...newTenant, nodeEnv: e.target.value })}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="production">Production</option>
                                        <option value="staging">Staging</option>
                                        <option value="development">Development</option>
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="additionalEnvVars">Additional Environment Variables (JSON)</Label>
                                    <Textarea
                                        id="additionalEnvVars"
                                        value={newTenant.additionalEnvVars}
                                        onChange={(e) => setNewTenant({ ...newTenant, additionalEnvVars: e.target.value })}
                                        placeholder='{"FEATURE_ENABLED": "true", "CUSTOM_SETTING": "value"}'
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={createTenant} disabled={isCreating}>
                                    {isCreating ? 'Creating...' : 'Create Tenant'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tenants.length}</div>
                        <p className="text-xs text-muted-foreground">AWS deployments</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tenants.filter(t => t.status === 'active').length}</div>
                        <p className="text-xs text-muted-foreground">running instances</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Provisioning</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tenants.filter(t => t.status === 'provisioning').length}</div>
                        <p className="text-xs text-muted-foreground">in progress</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Failed</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tenants.filter(t => t.status === 'failed').length}</div>
                        <p className="text-xs text-muted-foreground">need attention</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search and Filter */}
            <div className="flex items-center space-x-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search tenants..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Tenants List */}
            <div className="space-y-4">
                {filteredTenants.map((tenant) => (
                    <Card key={tenant.id}>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <Server className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <h3 className="text-lg font-semibold">{tenant.institutionName}</h3>
                                            <Badge className={getStatusColor(tenant.status)}>
                                                {getStatusIcon(tenant.status)}
                                                <span className="ml-1">{tenant.status}</span>
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{tenant.domain}</p>
                                        <p className="text-xs text-muted-foreground">
                                            ID: {tenant.id} • Updated: {tenant.lastUpdated.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            fetchTenantDetails(tenant.id);
                                            setIsDetailsDialogOpen(true);
                                        }}
                                    >
                                        <Eye className="h-4 w-4 mr-1" />
                                        Details
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => restartTenant(tenant.id)}
                                        disabled={tenant.status !== 'active'}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-1" />
                                        Restart
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => deleteTenant(tenant.id)}
                                        disabled={tenant.status === 'provisioning' || tenant.status === 'stopping'}
                                    >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Empty State */}
            {filteredTenants.length === 0 && (
                <div className="text-center py-12">
                    <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No tenants found</h3>
                    <p className="text-muted-foreground mb-4">
                        {searchQuery ? 'Try adjusting your search query' : 'Create your first tenant deployment'}
                    </p>
                    {!searchQuery && (
                        <Button onClick={() => setIsCreateDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Tenant
                        </Button>
                    )}
                </div>
            )}

            {/* Tenant Details Dialog */}
            {selectedTenant && (
                <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>Tenant Details: {selectedTenant.institutionName}</DialogTitle>
                            <DialogDescription>
                                Detailed information and logs for {selectedTenant.id}
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="overview" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
                                <TabsTrigger value="logs">Logs</TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="font-medium mb-2">Configuration</h4>
                                        <div className="space-y-2 text-sm">
                                            <div><strong>Domain:</strong> {selectedTenant.config.domain}</div>
                                            <div><strong>Environment:</strong> {selectedTenant.config.nodeEnv}</div>
                                            <div><strong>Port:</strong> {selectedTenant.config.port}</div>
                                            <div><strong>Service Status:</strong> {selectedTenant.serviceStatus}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-medium mb-2">Infrastructure Status</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center">
                                                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                                ECS Cluster: {selectedTenant.infrastructure.clusterId}
                                            </div>
                                            <div className="flex items-center">
                                                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                                ECS Service: {selectedTenant.infrastructure.serviceId}
                                            </div>
                                            <div className="flex items-center">
                                                {selectedTenant.infrastructure.hasTaskDefinition ? (
                                                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                                ) : (
                                                    <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                                                )}
                                                Task Definition: {selectedTenant.infrastructure.hasTaskDefinition ? 'Active' : 'Missing'}
                                            </div>
                                            <div className="flex items-center">
                                                {selectedTenant.infrastructure.hasTargetGroup ? (
                                                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                                ) : (
                                                    <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                                                )}
                                                Target Group: {selectedTenant.infrastructure.hasTargetGroup ? 'Active' : 'Missing'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {Object.keys(selectedTenant.config.additionalEnvVars).length > 0 && (
                                    <div>
                                        <h4 className="font-medium mb-2">Additional Environment Variables</h4>
                                        <div className="bg-gray-50 p-3 rounded text-sm">
                                            {Object.entries(selectedTenant.config.additionalEnvVars).map(([key, value]) => (
                                                <div key={key}><strong>{key}:</strong> {value}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="infrastructure" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">ECS Resources</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2 text-sm">
                                                <div><strong>Cluster:</strong> {selectedTenant.infrastructure.clusterId}</div>
                                                <div><strong>Service:</strong> {selectedTenant.infrastructure.serviceId}</div>
                                                <div><strong>Task Definition:</strong> {selectedTenant.infrastructure.hasTaskDefinition ? 'Active' : 'Missing'}</div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Load Balancer</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2 text-sm">
                                                <div><strong>Target Group:</strong> {selectedTenant.infrastructure.hasTargetGroup ? 'Active' : 'Missing'}</div>
                                                <div><strong>Listener Rule:</strong> {selectedTenant.infrastructure.hasListenerRule ? 'Active' : 'Missing'}</div>
                                                <div><strong>Domain:</strong> {selectedTenant.config.domain}</div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            <TabsContent value="logs" className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium">Recent Logs</h4>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fetchTenantLogs(selectedTenant.id)}
                                        disabled={isLoadingLogs}
                                    >
                                        {isLoadingLogs ? (
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                        )}
                                        Refresh
                                    </Button>
                                </div>

                                <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
                                    {isLoadingLogs ? (
                                        <div className="text-center">Loading logs...</div>
                                    ) : tenantLogs.length > 0 ? (
                                        tenantLogs.map((log, index) => (
                                            <div key={index} className="mb-1">
                                                <span className="text-gray-500">{log.timestamp.toLocaleString()}</span> {log.message}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-gray-500">No logs available</div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
} 