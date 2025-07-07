/**
 * Feature Flag System for Multi-Tenant Application
 * 
 * This system allows enabling/disabling features per tenant without code changes
 * Features can be controlled at the tenant level via the database
 */

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  category: 'ui' | 'api' | 'integration' | 'compliance' | 'admin';
  defaultValue: boolean;
  requiresRestart?: boolean;
  dependencies?: string[]; // Other features this depends on
}

// Define all available features
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // UI Features
  'advanced_dashboard': {
    key: 'advanced_dashboard',
    name: 'Advanced Dashboard',
    description: 'Enhanced dashboard with advanced analytics and charts',
    category: 'ui',
    defaultValue: true
  },
  'dark_mode': {
    key: 'dark_mode',
    name: 'Dark Mode',
    description: 'Allow users to toggle dark/light theme',
    category: 'ui',
    defaultValue: true
  },
  'bulk_operations': {
    key: 'bulk_operations',
    name: 'Bulk Operations',
    description: 'Enable bulk actions on regulations and deadlines',
    category: 'ui',
    defaultValue: false
  },
  'advanced_search': {
    key: 'advanced_search',
    name: 'Advanced Search',
    description: 'Enhanced search with filters and AI-powered suggestions',
    category: 'ui',
    defaultValue: true
  },
  
  // API Features
  'api_rate_limiting': {
    key: 'api_rate_limiting',
    name: 'API Rate Limiting',
    description: 'Enable rate limiting for API endpoints',
    category: 'api',
    defaultValue: true
  },
  'webhook_notifications': {
    key: 'webhook_notifications',
    name: 'Webhook Notifications',
    description: 'Send webhook notifications for regulation updates',
    category: 'api',
    defaultValue: false
  },
  'api_versioning': {
    key: 'api_versioning',
    name: 'API Versioning',
    description: 'Enable API versioning support',
    category: 'api',
    defaultValue: true
  },
  
  // Integration Features
  'email_notifications': {
    key: 'email_notifications',
    name: 'Email Notifications',
    description: 'Send email notifications for deadlines and updates',
    category: 'integration',
    defaultValue: true
  },
  'sms_notifications': {
    key: 'sms_notifications',
    name: 'SMS Notifications',
    description: 'Send SMS notifications for urgent deadlines',
    category: 'integration',
    defaultValue: false
  },
  'calendar_integration': {
    key: 'calendar_integration',
    name: 'Calendar Integration',
    description: 'Sync deadlines with external calendar systems',
    category: 'integration',
    defaultValue: false
  },
  'document_ai': {
    key: 'document_ai',
    name: 'Document AI Analysis',
    description: 'AI-powered document analysis and summarization',
    category: 'integration',
    defaultValue: false
  },
  
  // Compliance Features
  'automated_compliance_checks': {
    key: 'automated_compliance_checks',
    name: 'Automated Compliance Checks',
    description: 'Automatically check compliance status against regulations',
    category: 'compliance',
    defaultValue: true
  },
  'risk_assessment': {
    key: 'risk_assessment',
    name: 'Risk Assessment',
    description: 'Calculate and display compliance risk scores',
    category: 'compliance',
    defaultValue: false
  },
  'audit_trail': {
    key: 'audit_trail',
    name: 'Enhanced Audit Trail',
    description: 'Detailed audit logging for all compliance activities',
    category: 'compliance',
    defaultValue: true
  },
  
  // Admin Features
  'tenant_analytics': {
    key: 'tenant_analytics',
    name: 'Tenant Analytics',
    description: 'Advanced analytics and reporting for tenant administrators',
    category: 'admin',
    defaultValue: false
  },
  'user_impersonation': {
    key: 'user_impersonation',
    name: 'User Impersonation',
    description: 'Allow admins to impersonate users for support',
    category: 'admin',
    defaultValue: false
  },
  'advanced_user_management': {
    key: 'advanced_user_management',
    name: 'Advanced User Management',
    description: 'Enhanced user management with roles and permissions',
    category: 'admin',
    defaultValue: true
  }
};

// Feature categories for organization
export const FEATURE_CATEGORIES = {
  ui: 'User Interface',
  api: 'API & Backend',
  integration: 'Integrations',
  compliance: 'Compliance Tools',
  admin: 'Administration'
};

// Helper function to get features by category
export function getFeaturesByCategory(category: string): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS).filter(flag => flag.category === category);
}

// Helper function to check if a feature has dependencies
export function hasFeatureDependencies(featureKey: string): boolean {
  const feature = FEATURE_FLAGS[featureKey];
  return feature?.dependencies ? feature.dependencies.length > 0 : false;
}

// Helper function to get feature dependencies
export function getFeatureDependencies(featureKey: string): string[] {
  const feature = FEATURE_FLAGS[featureKey];
  return feature?.dependencies || [];
}

// Type for tenant feature configuration
export interface TenantFeatureConfig {
  tenantId: string;
  features: Record<string, boolean>;
  updatedAt: Date;
  updatedBy: string;
} 