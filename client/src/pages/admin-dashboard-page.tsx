import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import {
    Users,
    Settings,
    Shield,
    Activity,
    Database,
    Cloud,
    TrendingUp,
    AlertCircle,
    Plus,
    RefreshCw,
    Download,
    Upload,
    Monitor,
    Bell,
    Search,
    Filter
} from 'lucide-react';

interface CustomerData {
    id: string;
    name: string;
    domain: string;
    status: 'active' | 'inactive' | 'pending';
    users: number;
    regulations: number;
    lastActivity: string;
    subscription: 'starter' | 'professional' | 'enterprise';
    deploymentType: 'cloud' | 'on-premises' | 'hybrid';
}

interface SystemMetrics {
    totalCustomers: number;
    activeUsers: number;
    totalRegulations: number;
    systemUptime: string;
    avgResponseTime: number;
    errorRate: number;
}

export default function AdminDashboardPage() {
    const { user } = useAuth();
    const [customers, setCustomers] = useState<CustomerData[]>([]);
    const [metrics, setMetrics] = useState<SystemMetrics>({
        totalCustomers: 0,
        activeUsers: 0,
        totalRegulations: 0,
        systemUptime: '99.9%',
        avgResponseTime: 120,
        errorRate: 0.1
    });
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        console.log('🚀 Admin Dashboard starting to fetch real data...');
        fetchCustomers();
        fetchMetrics();
    }, []);

    const fetchCustomers = async () => {
        try {
            setIsLoading(true);
            // Fetch real tenant data from backend API
            const response = await fetch('/api/admin/tenants', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch tenants: ${response.statusText}`);
            }

            const tenantStats = await response.json();
            console.log('📊 Real tenant data:', tenantStats);

            // Transform backend tenant data to frontend customer format
            const realCustomers: CustomerData[] = tenantStats.map((tenant: any) => ({
                id: tenant.id,
                name: tenant.name,
                domain: `${tenant.id}.edsteward.ai`,
                status: tenant.status,
                users: tenant.userCount || 0,
                regulations: tenant.regulationCount || 0,
                lastActivity: tenant.lastActivity,
                subscription: tenant.userCount > 20 ? 'enterprise' : tenant.userCount > 5 ? 'professional' : 'starter',
                deploymentType: 'cloud'
            }));

            setCustomers(realCustomers);
            console.log('✅ Loaded real customer data:', realCustomers);
        } catch (error) {
            console.error('❌ Error fetching real customers:', error);
            // Fallback to empty array instead of fake data
            setCustomers([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMetrics = async () => {
        try {
            // Fetch real metrics from backend API
            const response = await fetch('/api/admin/metrics', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch metrics: ${response.statusText}`);
            }

            const realMetrics = await response.json();
            console.log('📊 Real system metrics:', realMetrics);

            // Use real metrics data
            setMetrics({
                totalCustomers: realMetrics.totalTenants || 0,
                activeUsers: realMetrics.totalUsers || 0,
                totalRegulations: realMetrics.totalRegulations || 0,
                systemUptime: '99.9%', // This could come from monitoring
                avgResponseTime: 120,  // This could come from CloudWatch
                errorRate: 0.1         // This could come from application monitoring
            });

            console.log('✅ Loaded real metrics');
        } catch (error) {
            console.error('❌ Error fetching real metrics:', error);
            // Keep existing fallback metrics
            setMetrics({
                totalCustomers: 0,
                activeUsers: 0,
                totalRegulations: 0,
                systemUptime: '99.9%',
                avgResponseTime: 120,
                errorRate: 0.1
            });
        }
    };

    const filteredCustomers = customers.filter(customer => {
        const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer.domain.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleCustomerAction = (action: string, customer: CustomerData) => {
        console.log(`Performing ${action} on customer:`, customer.name);
        // Implement actual actions here
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'inactive': return 'bg-red-100 text-red-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getSubscriptionColor = (subscription: string) => {
        switch (subscription) {
            case 'starter': return 'bg-blue-100 text-blue-800';
            case 'professional': return 'bg-purple-100 text-purple-800';
            case 'enterprise': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="min-h-screen bg-red-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-red-900 mb-2">
                                EdSteward Admin Console
                            </h1>
                            <p className="text-red-700">
                                Manage customers, monitor systems, and oversee compliance operations
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Badge variant="outline" className="bg-red-100 text-red-800">
                                <Shield className="h-4 w-4 mr-2" />
                                Admin Mode
                            </Badge>
                            <Button
                                variant="outline"
                                onClick={() => window.location.reload()}
                                className="border-red-200 text-red-700 hover:bg-red-100"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </div>

                {/* System Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="border-red-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-red-900">Total Customers</CardTitle>
                            <Users className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-800">{metrics.totalCustomers}</div>
                            <p className="text-xs text-red-600">+2 from last month</p>
                        </CardContent>
                    </Card>

                    <Card className="border-red-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-red-900">Active Users</CardTitle>
                            <Activity className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-800">{metrics.activeUsers}</div>
                            <p className="text-xs text-red-600">Across all customers</p>
                        </CardContent>
                    </Card>

                    <Card className="border-red-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-red-900">Total Regulations</CardTitle>
                            <Database className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-800">{metrics.totalRegulations}</div>
                            <p className="text-xs text-red-600">Managed compliance items</p>
                        </CardContent>
                    </Card>

                    <Card className="border-red-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-red-900">System Uptime</CardTitle>
                            <Monitor className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-800">{metrics.systemUptime}</div>
                            <p className="text-xs text-red-600">Last 30 days</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content */}
                <Tabs defaultValue="customers" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-4 bg-red-100">
                        <TabsTrigger value="customers" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
                            <Users className="h-4 w-4 mr-2" />
                            Customers
                        </TabsTrigger>
                        <TabsTrigger value="deployments" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
                            <Cloud className="h-4 w-4 mr-2" />
                            Deployments
                        </TabsTrigger>
                        <TabsTrigger value="monitoring" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Monitoring
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                        </TabsTrigger>
                    </TabsList>

                    {/* Customers Tab */}
                    <TabsContent value="customers" className="space-y-6">
                        <Card className="border-red-200">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-red-900">Customer Management</CardTitle>
                                        <CardDescription>Manage all customer instances and configurations</CardDescription>
                                    </div>
                                    <Button className="bg-red-600 hover:bg-red-700">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Customer
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Search and Filter */}
                                <div className="flex items-center space-x-4 mb-6">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="Search customers..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-48">
                                            <SelectValue placeholder="Filter by status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Customer Table */}
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-red-900">Customer</TableHead>
                                            <TableHead className="text-red-900">Domain</TableHead>
                                            <TableHead className="text-red-900">Status</TableHead>
                                            <TableHead className="text-red-900">Users</TableHead>
                                            <TableHead className="text-red-900">Regulations</TableHead>
                                            <TableHead className="text-red-900">Subscription</TableHead>
                                            <TableHead className="text-red-900">Deployment</TableHead>
                                            <TableHead className="text-red-900">Last Activity</TableHead>
                                            <TableHead className="text-red-900">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCustomers.map((customer) => (
                                            <TableRow key={customer.id}>
                                                <TableCell className="font-medium">{customer.name}</TableCell>
                                                <TableCell>
                                                    <a
                                                        href={`https://${customer.domain}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800"
                                                    >
                                                        {customer.domain}
                                                    </a>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={getStatusColor(customer.status)}>
                                                        {customer.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{customer.users}</TableCell>
                                                <TableCell>{customer.regulations}</TableCell>
                                                <TableCell>
                                                    <Badge className={getSubscriptionColor(customer.subscription)}>
                                                        {customer.subscription}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {customer.deploymentType}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{customer.lastActivity}</TableCell>
                                                <TableCell>
                                                    <div className="flex space-x-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleCustomerAction('view', customer)}
                                                        >
                                                            View
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleCustomerAction('manage', customer)}
                                                        >
                                                            Manage
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Deployments Tab */}
                    <TabsContent value="deployments" className="space-y-6">
                        <Card className="border-red-200">
                            <CardHeader>
                                <CardTitle className="text-red-900">Deployment Management</CardTitle>
                                <CardDescription>Monitor and manage customer deployments</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-8">
                                    <Cloud className="h-16 w-16 text-red-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-red-900 mb-2">Deployment Console</h3>
                                    <p className="text-red-600 mb-4">
                                        Manage AWS ECS deployments, Docker containers, and infrastructure
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
                                            <Cloud className="h-4 w-4 mr-2" />
                                            AWS Console
                                        </Button>
                                        <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
                                            <Database className="h-4 w-4 mr-2" />
                                            Database Status
                                        </Button>
                                        <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
                                            <Monitor className="h-4 w-4 mr-2" />
                                            Health Checks
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Monitoring Tab */}
                    <TabsContent value="monitoring" className="space-y-6">
                        <Card className="border-red-200">
                            <CardHeader>
                                <CardTitle className="text-red-900">System Monitoring</CardTitle>
                                <CardDescription>Real-time system performance and alerts</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-red-900">Performance Metrics</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-red-700">Average Response Time</span>
                                                <span className="text-sm font-medium">{metrics.avgResponseTime}ms</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-red-700">Error Rate</span>
                                                <span className="text-sm font-medium">{metrics.errorRate}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-red-700">System Uptime</span>
                                                <span className="text-sm font-medium">{metrics.systemUptime}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-red-900">Recent Alerts</h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                                                <span className="text-sm">High memory usage on beta.edsteward.ai</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <AlertCircle className="h-4 w-4 text-green-500" />
                                                <span className="text-sm">All systems operational</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Settings Tab */}
                    <TabsContent value="settings" className="space-y-6">
                        <Card className="border-red-200">
                            <CardHeader>
                                <CardTitle className="text-red-900">System Configuration</CardTitle>
                                <CardDescription>Global settings and administrative controls</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-red-900">System Settings</h4>
                                            <div className="space-y-2">
                                                <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                                                <Select>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Disabled" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="disabled">Disabled</SelectItem>
                                                        <SelectItem value="enabled">Enabled</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-red-900">Notifications</h4>
                                            <div className="space-y-2">
                                                <Label htmlFor="alert-email">Alert Email</Label>
                                                <Input
                                                    id="alert-email"
                                                    type="email"
                                                    placeholder="admin@edsteward.ai"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex space-x-4">
                                        <Button className="bg-red-600 hover:bg-red-700">
                                            Save Settings
                                        </Button>
                                        <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
                                            Reset to Defaults
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
} 