/**
 * EdSteward Platform - Comprehensive Type Definitions
 * 
 * This file provides complete type safety for the EdSteward platform,
 * covering all API responses, database entities, and system interfaces.
 */

// ============================================================================
// SYSTEM & HEALTH MONITORING TYPES
// ============================================================================

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  system: {
    memory: {
      used: number;
      free: number;
      total: number;
      percentage: number;
    };
    cpu: {
      loadAverage: number[];
    };
  };
  database: {
    status: 'connected' | 'disconnected' | 'error';
    responseTime: number;
    connections: {
      active: number;
      idle: number;
      total: number;
    };
  };
  services: {
    auth: 'operational' | 'degraded' | 'down';
    regulations: 'operational' | 'degraded' | 'down';
    notifications: 'operational' | 'degraded' | 'down';
  };
  alerts: string[];
}

export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  databaseConnections: number;
  requestsPerMinute: number;
  errorRate: number;
}

// ============================================================================
// USER MANAGEMENT & AUTHENTICATION TYPES
// ============================================================================

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: Date | null;
  emailVerified: boolean;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'user' | 'viewer' | 'compliance-officer';

export interface UserPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    deadlineReminders: boolean;
    regulationUpdates: boolean;
  };
  dashboard: {
    defaultView: 'regulations' | 'deadlines' | 'analytics';
    itemsPerPage: number;
    showCompletedDeadlines: boolean;
  };
  timezone: string;
  language: string;
}

export interface AuthSession {
  userId: number;
  tenantId: string;
  role: UserRole;
  permissions: Permission[];
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface Permission {
  resource: string;
  action: 'read' | 'write' | 'delete' | 'admin';
  conditions?: Record<string, any>;
}

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl: string;
  certificate: string;
  attributeMapping: {
    email: string;
    firstName: string;
    lastName: string;
    department?: string;
    role?: string;
  };
  domainRestrictions: string[];
  autoProvisioning: boolean;
}

// ============================================================================
// TENANT MANAGEMENT TYPES
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  subdomain: string;
  databaseUrl: string;
  samlConfig: SAMLConfig | null;
  features: TenantFeatures;
  subscription: TenantSubscription;
  customization: TenantCustomization;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantFeatures {
  samlEnabled: boolean;
  apiAccess: boolean;
  mcpIntegration: boolean;
  advancedAnalytics: boolean;
  customBranding: boolean;
  maxUsers: number;
  maxRegulations: number;
  storageLimit: number; // in MB
}

export interface TenantSubscription {
  plan: 'basic' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  billingCycle: 'monthly' | 'yearly';
  pricePerMonth: number;
  nextBillingDate: Date;
  trialEndsAt: Date | null;
}

export interface TenantCustomization {
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string | null;
  favicon: string | null;
  welcomeMessage: string | null;
}

// ============================================================================
// REGULATION MANAGEMENT TYPES
// ============================================================================

export interface Regulation {
  id: number;
  name: string;
  summary: string | null;
  content: string;
  jurisdiction: Jurisdiction;
  appliesTo: string[];
  status: RegulationStatus;
  priority: Priority;
  effectiveDate: Date | null;
  expirationDate: Date | null;
  lastReviewDate: Date | null;
  nextReviewDate: Date | null;
  tags: string[];
  metadata: RegulationMetadata;
  version: string;
  tenantId: string;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export type Jurisdiction = 'federal' | 'state' | 'local' | 'international' | 'industry';
export type RegulationStatus = 'active' | 'inactive' | 'draft' | 'deprecated' | 'under-review';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface RegulationMetadata {
  sourceUrl: string | null;
  citations: string[];
  relatedRegulations: number[];
  impactLevel: 'low' | 'medium' | 'high';
  complianceComplexity: 'simple' | 'moderate' | 'complex';
  estimatedImplementationTime: number; // in days
  costImpact: 'low' | 'medium' | 'high';
  stakeholders: string[];
}

export interface RegulationVersion {
  id: number;
  regulationId: number;
  version: string;
  content: string;
  changeDescription: string;
  changeType: 'minor' | 'major' | 'critical';
  validationLevel: ValidationLevel;
  validationStatus: 'pending' | 'approved' | 'rejected';
  validatedBy: number | null;
  validatedAt: Date | null;
  source: 'manual' | 'mcp' | 'import';
  createdBy: number;
  createdAt: Date;
}

export type ValidationLevel = 'A' | 'B' | 'C' | 'D';

export interface RegulationUpdate {
  id: number;
  regulationId: number;
  status: UpdateStatus;
  updatedContent: string;
  previousContent: string;
  changeAnalysis: ChangeAnalysis;
  submittedBy: string;
  source: string;
  description: string | null;
  signature: string | null;
  userId: number | null;
  processedAt: Date | null;
  createdAt: Date;
}

export type UpdateStatus = 'pending' | 'accepted' | 'rejected' | 'deferred';

export interface ChangeAnalysis {
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  changePercentage: number;
  significantChanges: string[];
  riskLevel: 'low' | 'medium' | 'high';
  recommendedAction: 'auto-approve' | 'review-required' | 'manual-review';
}

// ============================================================================
// DEADLINE MANAGEMENT TYPES
// ============================================================================

export interface Deadline {
  id: number;
  regulationId: number;
  title: string;
  description: string | null;
  dueDate: Date;
  priority: Priority;
  status: DeadlineStatus;
  assignedTo: number | null;
  estimatedHours: number | null;
  actualHours: number | null;
  completionPercentage: number;
  notes: string | null;
  attachments: string[];
  reminderSchedule: ReminderSchedule;
  notificationsSent: Date[];
  completedAt: Date | null;
  tenantId: string;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export type DeadlineStatus = 'pending' | 'in-progress' | 'completed' | 'overdue' | 'cancelled';

export interface ReminderSchedule {
  enabled: boolean;
  intervals: number[]; // days before due date
  methods: ('email' | 'sms' | 'in-app')[];
  customMessage: string | null;
}

export interface CreateDeadlineRequest {
  regulationId: number;
  title: string;
  description?: string;
  dueDate: Date;
  priority?: Priority;
  assignedTo?: number;
  estimatedHours?: number;
  reminderSchedule?: Partial<ReminderSchedule>;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  status: NotificationStatus;
  priority: Priority;
  channels: NotificationChannel[];
  scheduledAt: Date | null;
  sentAt: Date | null;
  readAt: Date | null;
  expiresAt: Date | null;
  tenantId: string;
  createdAt: Date;
}

export type NotificationType = 
  | 'deadline-reminder'
  | 'regulation-update'
  | 'system-alert'
  | 'user-mention'
  | 'compliance-warning'
  | 'report-ready';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled';
export type NotificationChannel = 'email' | 'sms' | 'in-app' | 'webhook';

export interface NotificationQueue {
  id: number;
  notificationId: number;
  channel: NotificationChannel;
  recipient: string;
  status: 'queued' | 'processing' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: Date | null;
  scheduledAt: Date;
  errorMessage: string | null;
  metadata: Record<string, any>;
}

// ============================================================================
// MCP INTEGRATION TYPES
// ============================================================================

export interface MCPVersionUpdate {
  content: string;
  changeDescription: string;
  validationLevel?: ValidationLevel;
  source?: string;
  metadata?: Record<string, any>;
}

export interface MCPVersionResponse {
  versionId: number;
  status: 'created' | 'conflict' | 'error';
  message: string;
  conflictDetails?: VersionConflict;
}

export interface VersionConflict {
  id: number;
  regulationId: number;
  localVersion: string;
  remoteVersion: string;
  conflictType: 'content' | 'version' | 'metadata';
  conflictDetails: string;
  resolutionStrategy: 'manual' | 'prefer-local' | 'prefer-remote' | 'merge';
  resolvedAt: Date | null;
  resolvedBy: number | null;
  createdAt: Date;
}

export interface SyncStatus {
  regulationId: number;
  lastSyncAt: Date | null;
  status: 'synced' | 'pending' | 'error' | 'conflict';
  pendingVersion: string | null;
  errorMessage: string | null;
  nextSyncAt: Date | null;
  syncFrequency: 'hourly' | 'daily' | 'weekly' | 'manual';
}

export interface SyncControl {
  id: number;
  regulationId: number;
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  lastSync: Date | null;
  nextSync: Date | null;
  errorCount: number;
  lastError: string | null;
  config: SyncConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncConfig {
  autoApprove: boolean;
  validationRequired: boolean;
  conflictResolution: 'manual' | 'prefer-local' | 'prefer-remote';
  notifyOnChanges: boolean;
  recipients: string[];
}

// ============================================================================
// EVIDENCE & FILE MANAGEMENT TYPES
// ============================================================================

export interface EvidenceFile {
  id: number;
  regulationId: number;
  deadlineId: number | null;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string | null;
  description: string | null;
  tags: string[];
  metadata: FileMetadata;
  uploadedBy: number;
  uploadedAt: Date;
  tenantId: string;
}

export interface FileMetadata {
  checksum: string;
  processingStatus: 'pending' | 'processed' | 'failed';
  extractedText: string | null;
  pageCount: number | null;
  dimensions: { width: number; height: number } | null;
  virusScanResult: 'clean' | 'infected' | 'pending';
  accessLevel: 'public' | 'internal' | 'restricted';
}

// ============================================================================
// ANALYTICS & REPORTING TYPES
// ============================================================================

export interface ComplianceMetrics {
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

export interface RegulationAnalytics {
  regulationId: number;
  views: number;
  deadlinesCreated: number;
  evidenceFiles: number;
  lastViewed: Date | null;
  averageCompletionTime: number | null; // in days
  complianceRate: number; // percentage
}

export interface TenantAnalytics {
  activeUsers: number;
  totalLogins: number;
  averageSessionDuration: number;
  topRegulations: RegulationAnalytics[];
  complianceMetrics: ComplianceMetrics;
  systemUsage: {
    storageUsed: number;
    apiCallsThisMonth: number;
    emailsSent: number;
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  message?: string;
  timestamp: Date;
  requestId: string;
}

export interface APIError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// SEARCH & FILTERING TYPES
// ============================================================================

export interface SearchQuery {
  term: string;
  filters: {
    jurisdiction?: Jurisdiction[];
    status?: RegulationStatus[];
    priority?: Priority[];
    appliesTo?: string[];
    tags?: string[];
    dateRange?: {
      field: 'createdAt' | 'updatedAt' | 'effectiveDate';
      start: Date;
      end: Date;
    };
  };
  sort: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination: {
    page: number;
    limit: number;
  };
}

export interface SearchResult<T> {
  item: T;
  score: number;
  highlights: string[];
  explanation?: string;
}

// ============================================================================
// SYSTEM CONFIGURATION TYPES
// ============================================================================

export interface SystemConfig {
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
    baseUrl: string;
    maxFileSize: number;
    allowedFileTypes: string[];
  };
  database: {
    maxConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
  };
  notifications: {
    emailProvider: 'ses' | 'sendgrid';
    smsProvider: 'twilio' | 'aws-sns';
    defaultSender: string;
    maxRetries: number;
    retryDelay: number;
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    passwordPolicy: PasswordPolicy;
  };
  features: {
    registrationEnabled: boolean;
    mcpIntegrationEnabled: boolean;
    analyticsEnabled: boolean;
    fileUploadEnabled: boolean;
  };
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  prohibitCommonPasswords: boolean;
  maxAge: number; // days
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type EntityId = number;
export type TenantId = string;
export type UserId = number;

export interface AuditLog {
  id: number;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'view';
  changes: Record<string, { old: any; new: any }>;
  userId: number | null;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  tenantId: string;
}

export interface Feature {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  enabledFor: string[]; // tenant IDs
  rolloutPercentage: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isUser(obj: any): obj is User {
  return obj && typeof obj.id === 'number' && typeof obj.email === 'string';
}

export function isRegulation(obj: any): obj is Regulation {
  return obj && typeof obj.id === 'number' && typeof obj.name === 'string';
}

export function isDeadline(obj: any): obj is Deadline {
  return obj && typeof obj.id === 'number' && typeof obj.title === 'string';
}

export function isHealthy(health: HealthCheckResponse): boolean {
  return health.status === 'healthy';
}

// ============================================================================
// EXPORTED TYPE UNIONS
// ============================================================================

export type AnyEntity = User | Regulation | Deadline | Notification | EvidenceFile;
export type SystemStatus = 'healthy' | 'degraded' | 'unhealthy';
export type EntityStatus = RegulationStatus | DeadlineStatus | NotificationStatus;

// Type utility object for runtime type information
export const TypeNames = {
  User: 'User',
  Regulation: 'Regulation', 
  Deadline: 'Deadline',
  Notification: 'Notification',
  Tenant: 'Tenant',
  HealthCheckResponse: 'HealthCheckResponse',
  APIResponse: 'APIResponse',
  PaginatedResponse: 'PaginatedResponse',
} as const; 