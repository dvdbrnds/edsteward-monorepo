import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Lock, 
  AlertCircle, 
  Info, 
  Zap, 
  Crown, 
  Settings, 
  Mail,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { FEATURE_FLAGS } from '@shared/feature-flags';

interface FeatureDisabledMessageProps {
  featureKey: string;
  variant?: 'alert' | 'card' | 'inline' | 'banner';
  showContactInfo?: boolean;
  customMessage?: string;
  className?: string;
}

interface FeatureGateProps {
  featureKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showMessage?: boolean;
}

export function FeatureDisabledMessage({ 
  featureKey, 
  variant = 'alert', 
  showContactInfo = true,
  customMessage,
  className = ''
}: FeatureDisabledMessageProps) {
  const feature = FEATURE_FLAGS[featureKey];
  
  if (!feature) {
    console.warn(`Unknown feature key: ${featureKey}`);
    return null;
  }

  const getFeatureIcon = (category: string) => {
    switch (category) {
      case 'ui': return <Settings className="h-4 w-4" />;
      case 'integration': return <Zap className="h-4 w-4" />;
      case 'admin': return <Crown className="h-4 w-4" />;
      case 'compliance': return <Lock className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getUpgradeMessage = (category: string) => {
    switch (category) {
      case 'integration':
        return 'This integration feature is available with premium plans.';
      case 'admin':
        return 'Advanced administration features require additional permissions.';
      case 'compliance':
        return 'Enhanced compliance tools are part of our professional package.';
      default:
        return 'This feature is currently disabled for your organization.';
    }
  };

  const defaultMessage = customMessage || getUpgradeMessage(feature.category);

  const contactSection = showContactInfo && (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <p className="text-sm text-muted-foreground mb-2">
        Interested in enabling this feature?
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline">
          <Mail className="h-3 w-3 mr-1" />
          Contact Support
        </Button>
        <Button size="sm" variant="outline">
          <MessageCircle className="h-3 w-3 mr-1" />
          Request Demo
        </Button>
      </div>
    </div>
  );

  if (variant === 'alert') {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <strong>{feature.name} is disabled</strong>
              <p className="text-sm mt-1">{defaultMessage}</p>
            </div>
            <Badge variant="outline" className="ml-2">
              {feature.category}
            </Badge>
          </div>
          {contactSection}
        </AlertDescription>
      </Alert>
    );
  }

  if (variant === 'card') {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            {getFeatureIcon(feature.category)}
            <CardTitle className="text-base">{feature.name}</CardTitle>
            <Badge variant="secondary">Disabled</Badge>
          </div>
          <CardDescription>{feature.description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-3">{defaultMessage}</p>
          {contactSection}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center space-x-2 text-sm text-muted-foreground ${className}`}>
        <Lock className="h-3 w-3" />
        <span>{feature.name} is disabled</span>
        <Badge variant="outline" className="text-xs">
          {feature.category}
        </Badge>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-yellow-800">
              {feature.name} Feature Unavailable
            </h4>
            <p className="text-sm text-yellow-700 mt-1">{defaultMessage}</p>
            {showContactInfo && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="text-yellow-800 border-yellow-300">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Learn More
                </Button>
                <Button size="sm" variant="outline" className="text-yellow-800 border-yellow-300">
                  <Mail className="h-3 w-3 mr-1" />
                  Contact Us
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Feature Gate Component - wraps content and shows/hides based on feature flag
export function FeatureGate({ 
  featureKey, 
  children, 
  fallback, 
  showMessage = true 
}: FeatureGateProps) {
  // This would normally use the useFeatureFlag hook
  // For now, we'll simulate the check
  const isEnabled = false; // Replace with: useFeatureFlag(featureKey);
  
  if (isEnabled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showMessage) {
    return <FeatureDisabledMessage featureKey={featureKey} />;
  }

  return null;
}

// Disabled Button Component - shows a disabled button with tooltip
interface DisabledFeatureButtonProps {
  featureKey: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

export function DisabledFeatureButton({ 
  featureKey, 
  children, 
  className = '',
  variant = 'default',
  size = 'default'
}: DisabledFeatureButtonProps) {
  const feature = FEATURE_FLAGS[featureKey];
  
  return (
    <div className="relative group">
      <Button 
        disabled 
        variant={variant} 
        size={size}
        className={`${className} cursor-not-allowed opacity-50`}
      >
        <Lock className="h-3 w-3 mr-1" />
        {children}
      </Button>
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        {feature?.name || 'Feature'} is disabled
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
}

// Example usage components for demonstration
export function FeatureDisabledExamples() {
  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Feature Disabled Message Examples</h2>
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Alert Variant</h3>
        <FeatureDisabledMessage featureKey="document_ai" variant="alert" />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Card Variant</h3>
        <FeatureDisabledMessage featureKey="sms_notifications" variant="card" />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Banner Variant</h3>
        <FeatureDisabledMessage featureKey="user_impersonation" variant="banner" />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Inline Usage</h3>
        <div className="p-4 border rounded">
          <p>Some content here...</p>
          <FeatureDisabledMessage featureKey="bulk_operations" variant="inline" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Feature Gate Example</h3>
        <FeatureGate featureKey="advanced_dashboard">
          <div className="p-4 bg-green-100 border border-green-300 rounded">
            <p>This content is only shown when the feature is enabled!</p>
          </div>
        </FeatureGate>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Disabled Button Examples</h3>
        <div className="flex gap-2">
          <DisabledFeatureButton featureKey="document_ai">
            Upload Document
          </DisabledFeatureButton>
          <DisabledFeatureButton featureKey="bulk_operations" variant="outline">
            Bulk Export
          </DisabledFeatureButton>
          <DisabledFeatureButton featureKey="sms_notifications" variant="ghost" size="sm">
            Send SMS
          </DisabledFeatureButton>
        </div>
      </div>
    </div>
  );
} 