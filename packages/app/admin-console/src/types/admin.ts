export interface Customer {
    id: string;
    name: string;
    domain: string;
    subdomain: string;
    status: 'active' | 'inactive' | 'suspended' | 'trial';
    subscription: Subscription;
    users: number;
    regulations: number;
    lastActivity: Date;
    createdAt: Date;
    updatedAt: Date;
    deploymentType: 'cloud' | 'on-premises' | 'hybrid';
    region: string;
    contactEmail: string;
    supportTier: 'basic' | 'professional' | 'enterprise';
    customizations: CustomerCustomization[];
    metrics: CustomerMetrics;
}

export interface Subscription {
    id: string;
    plan: 'starter' | 'professional' | 'enterprise' | 'custom';
    status: 'active' | 'canceled' | 'past_due' | 'trialing';
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    trialEnd?: Date;
    seats: number;
    features: string[];
    billing: BillingInfo;
}

export interface BillingInfo {
    amount: number;
    currency: string;
    interval: 'month' | 'year';
    nextBillingDate: Date;
    paymentMethod: string;
}

export interface CustomerCustomization {
    id: string;
    type: 'branding' | 'feature' | 'integration';
    name: string;
    value: any;
    isActive: boolean;
}

export interface CustomerMetrics {
    dailyActiveUsers: number;
    monthlyActiveUsers: number;
    storageUsed: number;
    apiCallsToday: number;
    apiCallsThisMonth: number;
    complianceScore: number;
    lastBackup: Date;
}

export interface AuditLog {
    id: string;
    timestamp: Date;
    userId: string;
    userEmail: string;
    action: string;
    resource: string;
    resourceId?: string;
    ipAddress: string;
    userAgent: string;
    status: 'success' | 'failure';
    details: Record<string, any>;
    severity: 'low' | 'medium' | 'high' | 'critical';
    customer?: string;
}

export interface SystemMetrics {
    uptime: number;
    responseTime: number;
    errorRate: number;
    throughput: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    databaseConnections: number;
    activeUsers: number;
    totalCustomers: number;
    totalRevenue: number;
    timestamp: Date;
}

export interface Alert {
    id: string;
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    status: 'active' | 'acknowledged' | 'resolved';
    source: string;
    timestamp: Date;
    resolvedAt?: Date;
    resolvedBy?: string;
    actions: AlertAction[];
    metadata: Record<string, any>;
}

export interface AlertAction {
    id: string;
    name: string;
    type: 'email' | 'webhook' | 'auto_resolve';
    config: Record<string, any>;
}

export interface FeatureFlag {
    id: string;
    name: string;
    description: string;
    key: string;
    isActive: boolean;
    rolloutPercentage: number;
    targetCustomers: string[];
    targetUsers: string[];
    conditions: FeatureFlagCondition[];
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

export interface FeatureFlagCondition {
    id: string;
    type: 'user_attribute' | 'customer_attribute' | 'date_range' | 'random';
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
}

export interface Workflow {
    id: string;
    name: string;
    description: string;
    trigger: WorkflowTrigger;
    actions: WorkflowAction[];
    isActive: boolean;
    lastRun?: Date;
    runCount: number;
    successCount: number;
    failureCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface WorkflowTrigger {
    type: 'schedule' | 'event' | 'webhook';
    config: Record<string, any>;
}

export interface WorkflowAction {
    id: string;
    type: 'email' | 'webhook' | 'database' | 'api_call';
    name: string;
    config: Record<string, any>;
    order: number;
}

export interface Report {
    id: string;
    name: string;
    description: string;
    type: 'usage' | 'security' | 'billing' | 'compliance' | 'performance';
    schedule?: ReportSchedule;
    parameters: ReportParameter[];
    recipients: string[];
    lastGenerated?: Date;
    isActive: boolean;
    format: 'pdf' | 'csv' | 'xlsx' | 'json';
}

export interface ReportSchedule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string;
    timezone: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
}

export interface ReportParameter {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'select';
    required: boolean;
    defaultValue?: any;
    options?: string[];
}

export interface Integration {
    id: string;
    name: string;
    type: 'saml' | 'oidc' | 'ldap' | 'webhook' | 'api';
    status: 'active' | 'inactive' | 'error' | 'pending';
    configuration: Record<string, any>;
    lastSync?: Date;
    errorMessage?: string;
    customers: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface UsageStats {
    period: 'hour' | 'day' | 'week' | 'month';
    timestamp: Date;
    customers: number;
    activeUsers: number;
    apiCalls: number;
    storageUsed: number;
    bandwidthUsed: number;
    features: Record<string, number>;
}

export interface SecurityEvent {
    id: string;
    type: 'login_failure' | 'suspicious_activity' | 'data_breach' | 'policy_violation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    userId?: string;
    customerId?: string;
    ipAddress: string;
    timestamp: Date;
    status: 'open' | 'investigating' | 'resolved' | 'false_positive';
    metadata: Record<string, any>;
} 