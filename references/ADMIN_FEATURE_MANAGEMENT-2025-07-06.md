# Admin Feature Management System

## Overview

The EdSteward platform now includes a comprehensive admin interface for managing feature flags across all tenants. This system allows administrators to:

- **Monitor all tenants** in real-time with health status and feature adoption metrics
- **Control feature flags** on a per-tenant basis or via bulk operations
- **Show contextual messages** to users when features are disabled
- **Track feature rollouts** and adoption analytics

## Key Components

### 1. Admin Dashboard (`admin.edsteward.ai`)

**Location**: `client/src/pages/admin-console-page.tsx`

The admin console now includes a **Feature Flags** tab with:
- Overview of total features, active features, and adoption rates
- Feature categories breakdown (UI, API, Integrations, Compliance, Admin)
- Quick actions for bulk operations
- Recent feature change history

### 2. Advanced Feature Management

**Location**: `client/src/components/admin/tenant-feature-manager.tsx`

A comprehensive dashboard with four main tabs:

#### Tenant Overview
- Real-time tenant monitoring with health status
- Feature adoption metrics per tenant
- Quick access to individual tenant management

#### Feature Management
- Complete feature flag control interface
- Category-based filtering
- Individual tenant toggles with instant updates
- Bulk enable/disable operations for all tenants

#### Rollout History
- Track feature rollouts across multiple tenants
- Progress monitoring with status indicators
- Rollout success/failure reporting

#### Real-time Monitoring
- Feature usage analytics across all tenants
- System health monitoring
- Adoption rate visualizations

### 3. Feature Disabled Messaging System

**Location**: `client/src/components/common/feature-disabled-message.tsx`

Provides multiple ways to communicate disabled features to users:

#### Message Variants
- **Alert**: Prominent notification with contact options
- **Card**: Standalone card explaining the disabled feature
- **Inline**: Subtle inline text for contextual mentions
- **Banner**: Page-wide notification for important features

#### Components
- `FeatureDisabledMessage`: Customizable disabled feature messages
- `FeatureGate`: Conditionally render content based on feature flags
- `DisabledFeatureButton`: Disabled buttons with helpful tooltips

### 4. Demo Implementation

**Location**: `client/src/components/examples/feature-disabled-demo.tsx`

Shows practical examples of how disabled features appear to users:
- Document AI analysis disabled
- Bulk operations unavailable
- SMS notifications not enabled
- Advanced analytics restricted

## Feature Flag System

### Available Features

The system includes 16 feature flags across 5 categories:

#### User Interface (4 features)
- `advanced_dashboard`: Enhanced dashboard with analytics
- `dark_mode`: Dark/light theme toggle
- `bulk_operations`: Bulk actions on regulations
- `advanced_search`: AI-powered search with filters

#### API & Backend (3 features)
- `api_rate_limiting`: Rate limiting for API endpoints
- `webhook_notifications`: Webhook notifications for updates
- `api_versioning`: API versioning support

#### Integrations (4 features)
- `email_notifications`: Email notifications for deadlines
- `sms_notifications`: SMS notifications for urgent items
- `calendar_integration`: External calendar sync
- `document_ai`: AI-powered document analysis

#### Compliance Tools (3 features)
- `automated_compliance_checks`: Automated compliance monitoring
- `risk_assessment`: Compliance risk scoring
- `audit_trail`: Enhanced audit logging

#### Administration (2 features)
- `tenant_analytics`: Advanced tenant analytics
- `user_impersonation`: Admin user impersonation
- `advanced_user_management`: Enhanced user management

### How It Works

1. **Feature Definition**: Features are defined in `shared/feature-flags.ts` with metadata
2. **Tenant Storage**: Feature states are stored in the tenant's settings JSON field
3. **Real-time Updates**: Changes are applied immediately via API calls
4. **Graceful Degradation**: Disabled features show helpful messages instead of errors

## API Endpoints

### Admin Feature Management API
**Base Path**: `/api/admin/feature-management`

- `GET /overview` - Get all tenants with feature status
- `GET /features` - Get all available feature definitions
- `PUT /tenant/:tenantId/features` - Update features for specific tenant
- `PUT /feature/:featureKey/bulk` - Bulk enable/disable feature across tenants
- `GET /analytics` - Get feature usage analytics
- `POST /rollout` - Start controlled feature rollout
- `GET /tenant/:tenantId/health` - Get tenant health and feature status

## Usage Examples

### Admin: Enable Document AI for Moravian University

```bash
curl -X PUT /api/admin/feature-management/tenant/moravian/features \
  -H "Content-Type: application/json" \
  -d '{"document_ai": true}'
```

### Admin: Bulk Enable Email Notifications

```bash
curl -X PUT /api/admin/feature-management/feature/email_notifications/bulk \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "tenantIds": ["moravian", "admin", "staging"]}'
```

### Frontend: Check Feature Status

```tsx
import { useFeatureFlag } from '@/hooks/use-feature-flags';

function DocumentUpload() {
  const hasDocumentAI = useFeatureFlag('document_ai');
  
  return (
    <div>
      <input type="file" />
      {hasDocumentAI ? (
        <button>Analyze with AI</button>
      ) : (
        <FeatureDisabledMessage featureKey="document_ai" variant="alert" />
      )}
    </div>
  );
}
```

### Frontend: Feature Gate

```tsx
import { FeatureGate } from '@/components/common/feature-disabled-message';

function AdvancedFeatures() {
  return (
    <FeatureGate featureKey="advanced_dashboard">
      <AdvancedAnalyticsDashboard />
    </FeatureGate>
  );
}
```

## User Experience

### When Features Are Enabled
- Full functionality available
- No restrictions or messages
- Seamless user experience

### When Features Are Disabled
- **Contextual Messages**: Clear explanations of why features are unavailable
- **Contact Options**: Easy ways to request feature access
- **Graceful Degradation**: Basic functionality still works
- **Transparent Communication**: Users understand the feature ecosystem

## Benefits

### For Administrators
- **Granular Control**: Enable/disable features per tenant
- **Risk Management**: Gradual rollouts and quick rollbacks
- **Analytics**: Track feature adoption and usage
- **Efficiency**: Bulk operations across multiple tenants

### For Tenants
- **Transparency**: Clear communication about available features
- **Upgrade Path**: Easy way to understand and request premium features
- **No Broken Experience**: Disabled features don't cause errors
- **Professional Presentation**: Polished messaging for unavailable features

### For Development
- **Safe Deployments**: Ship code with features disabled
- **A/B Testing**: Test features with specific tenant groups
- **Maintenance**: Disable problematic features quickly
- **Customer Success**: Drive feature adoption conversations

## Deployment Strategy

### Universal Updates (All Tenants)
1. Set `defaultValue: true` in feature definition
2. Deploy code via GitHub Actions
3. All tenants get the feature immediately

### Tenant-Specific Updates
1. Set `defaultValue: false` in feature definition
2. Deploy code (feature is hidden by default)
3. Use admin panel to enable for specific tenants
4. Monitor adoption and feedback

### Gradual Rollouts
1. Deploy with `defaultValue: false`
2. Enable for test/staging tenants first
3. Monitor for issues
4. Gradually enable for production tenants
5. Eventually set `defaultValue: true` for full rollout

## Security & Permissions

- **Admin-Only Access**: Feature management requires admin role
- **Audit Trail**: All feature changes are logged
- **Tenant Isolation**: Features are scoped per tenant
- **API Security**: Endpoints require authentication and admin permissions

## Future Enhancements

- **Scheduled Rollouts**: Time-based feature activation
- **A/B Testing Framework**: Percentage-based feature rollouts
- **Feature Dependencies**: Automatic handling of feature prerequisites
- **Usage Analytics**: Detailed feature usage tracking
- **Customer Portal**: Self-service feature management for tenant admins
- **Integration Webhooks**: Notify external systems of feature changes

## Access the System

1. **Admin Console**: Visit `https://admin.edsteward.ai` and navigate to the "Feature Flags" tab
2. **Advanced Management**: Click "Advanced Management" for the full feature management interface
3. **Demo**: View the feature disabled demo at `/admin/feature-demo` (when implemented)

The system is now live and ready for use across all EdSteward environments! 