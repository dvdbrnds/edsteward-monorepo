/**
 * Feature Flag System for Single-Tenant Application
 * 
 * This system allows enabling/disabling features at the application level
 * Features can be controlled via environment variables or configuration
 */

// Available feature categories
export const FEATURE_CATEGORIES = {
  'core': 'Core Features',
  'ui': 'User Interface',
  'admin': 'Administration',
  'integration': 'Integrations',
  'experimental': 'Experimental',
  'analytics': 'Analytics'
} as const;

export type FeatureCategory = keyof typeof FEATURE_CATEGORIES;

// Feature flag definition
export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  category: FeatureCategory;
  defaultValue: boolean;
  requiresRestart?: boolean;
  dependencies?: string[];
}

// All available feature flags
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  'advanced_dashboard': {
    key: 'advanced_dashboard',
    name: 'Advanced Dashboard',
    description: 'Enhanced dashboard with advanced analytics and visualizations',
    category: 'core',
    defaultValue: true,
  },
  'bulk_operations': {
    key: 'bulk_operations',
    name: 'Bulk Operations',
    description: 'Allow bulk editing and management of regulations',
    category: 'core',
    defaultValue: true,
  },
  'email_notifications': {
    key: 'email_notifications',
    name: 'Email Notifications',
    description: 'Send email notifications for deadlines and updates',
    category: 'integration',
    defaultValue: true,
  },
  'advanced_search': {
    key: 'advanced_search',
    name: 'Advanced Search',
    description: 'Enhanced search capabilities with filters and faceting',
    category: 'ui',
    defaultValue: true,
  },
  'compliance_wizard': {
    key: 'compliance_wizard',
    name: 'Compliance Wizard',
    description: 'Guided compliance workflows and checklists',
    category: 'core',
    defaultValue: true,
  },
  'advanced_reporting': {
    key: 'advanced_reporting',
    name: 'Advanced Reporting',
    description: 'Comprehensive reporting and analytics dashboard',
    category: 'analytics',
    defaultValue: true,
  },
  'custom_fields': {
    key: 'custom_fields',
    name: 'Custom Fields',
    description: 'Add custom fields to regulations and compliance records',
    category: 'admin',
    defaultValue: true,
  },
  'api_access': {
    key: 'api_access',
    name: 'API Access',
    description: 'RESTful API access for third-party integrations',
    category: 'integration',
    defaultValue: true,
  },
  'audit_trails': {
    key: 'audit_trails',
    name: 'Audit Trails',
    description: 'Comprehensive audit logging and compliance tracking',
    category: 'admin',
    defaultValue: true,
  },
  'real_time_updates': {
    key: 'real_time_updates',
    name: 'Real-time Updates',
    description: 'Live updates and notifications via WebSocket',
    category: 'ui',
    defaultValue: false,
  },
  'mobile_app': {
    key: 'mobile_app',
    name: 'Mobile App Support',
    description: 'Enhanced mobile application features',
    category: 'ui',
    defaultValue: false,
  },
  'sso_integration': {
    key: 'sso_integration',
    name: 'SSO Integration',
    description: 'Single Sign-On integration with SAML/OAuth providers',
    category: 'integration',
    defaultValue: false,
  },
  'data_visualization': {
    key: 'data_visualization',
    name: 'Data Visualization',
    description: 'Interactive charts and data visualization tools',
    category: 'analytics',
    defaultValue: true,
  },
  'automated_workflows': {
    key: 'automated_workflows',
    name: 'Automated Workflows',
    description: 'Automated compliance workflows and task assignments',
    category: 'core',
    defaultValue: false,
  },
  'regulation_tracking': {
    key: 'regulation_tracking',
    name: 'Regulation Tracking',
    description: 'Track regulation changes and update notifications',
    category: 'core',
    defaultValue: true,
  },
  'deadline_management': {
    key: 'deadline_management',
    name: 'Deadline Management',
    description: 'Advanced deadline tracking and reminder system',
    category: 'core',
    defaultValue: true,
  },
  'compliance_templates': {
    key: 'compliance_templates',
    name: 'Compliance Templates',
    description: 'Pre-built compliance templates and workflows',
    category: 'core',
    defaultValue: true,
  },
  'third_party_integrations': {
    key: 'third_party_integrations',
    name: 'Third-party Integrations',
    description: 'Integrate with external compliance and regulatory systems',
    category: 'integration',
    defaultValue: false,
  },
  'advanced_permissions': {
    key: 'advanced_permissions',
    name: 'Advanced Permissions',
    description: 'Granular role-based access control and permissions',
    category: 'admin',
    defaultValue: true,
  },
  'analytics_dashboard': {
    key: 'analytics_dashboard',
    name: 'Analytics Dashboard',
    description: 'Comprehensive analytics and reporting dashboard',
    category: 'analytics',
    defaultValue: true,
  },
  'regulation_versioning': {
    key: 'regulation_versioning',
    name: 'Regulation Versioning',
    description: 'Track regulation versions and changes over time',
    category: 'core',
    defaultValue: true,
  },
  'compliance_scoring': {
    key: 'compliance_scoring',
    name: 'Compliance Scoring',
    description: 'Automated compliance scoring and risk assessment',
    category: 'analytics',
    defaultValue: true,
  },
  'document_management': {
    key: 'document_management',
    name: 'Document Management',
    description: 'Advanced document storage and management system',
    category: 'core',
    defaultValue: true,
  },
  'notification_center': {
    key: 'notification_center',
    name: 'Notification Center',
    description: 'Centralized notification management and preferences',
    category: 'ui',
    defaultValue: true,
  },
  'backup_restore': {
    key: 'backup_restore',
    name: 'Backup & Restore',
    description: 'Automated backup and restore functionality',
    category: 'admin',
    defaultValue: true,
  },
  'system_monitoring': {
    key: 'system_monitoring',
    name: 'System Monitoring',
    description: 'Real-time system health and performance monitoring',
    category: 'admin',
    defaultValue: true,
  },
} as const;

// Simple feature flag configuration for single-tenant
export interface ApplicationFeatureConfig {
  [key: string]: boolean;
}

// Default feature configuration
export const DEFAULT_FEATURE_CONFIG: ApplicationFeatureConfig = Object.fromEntries(
  Object.entries(FEATURE_FLAGS).map(([key, flag]) => [key, flag.defaultValue])
);

// Helper function to check if a feature is enabled
export function isFeatureEnabled(featureKey: string, config: ApplicationFeatureConfig = DEFAULT_FEATURE_CONFIG): boolean {
  return config[featureKey] ?? FEATURE_FLAGS[featureKey]?.defaultValue ?? false;
}

// Helper function to get feature flag configuration
export function getFeatureConfig(featureKey: string): FeatureFlag | undefined {
  return FEATURE_FLAGS[featureKey];
}

// Helper function to get all enabled features
export function getEnabledFeatures(config: ApplicationFeatureConfig = DEFAULT_FEATURE_CONFIG): string[] {
  return Object.entries(config)
    .filter(([_, enabled]) => enabled)
    .map(([key, _]) => key);
}

// Helper function to get features by category
export function getFeaturesByCategory(category: FeatureCategory): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS).filter(flag => flag.category === category);
} 