/**
 * Example Component: How to Use Feature Flags in Development
 * 
 * This component demonstrates the proper way to develop new features
 * without breaking tenant configurations
 */

import React from 'react';
import { useFeatureFlag, useFeatureFlags } from '../../hooks/use-feature-flags';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export function FeatureFlagExampleComponent() {
  // Example 1: Simple feature flag check
  const hasAdvancedDashboard = useFeatureFlag('advanced_dashboard');
  const hasBulkOperations = useFeatureFlag('bulk_operations');
  const hasDocumentAI = useFeatureFlag('document_ai');
  
  // Example 2: Get all feature information
  const { getAllFeatures, getFeaturesByCategory, tenantFeatures, loading } = useFeatureFlags();

  if (loading) {
    return <div>Loading feature configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feature Flag Development Example</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              This component demonstrates how to develop new features safely using feature flags.
              Features can be enabled/disabled per tenant without code changes.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="examples" className="w-full">
            <TabsList>
              <TabsTrigger value="examples">Feature Examples</TabsTrigger>
              <TabsTrigger value="categories">By Category</TabsTrigger>
              <TabsTrigger value="tenant-config">Tenant Config</TabsTrigger>
            </TabsList>

            <TabsContent value="examples" className="space-y-4">
              <h3 className="text-lg font-semibold">Feature Flag Examples</h3>
              
              {/* Example 1: Conditional Rendering */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">1. Conditional Rendering</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Advanced Dashboard</span>
                      <Badge variant={hasAdvancedDashboard ? "default" : "secondary"}>
                        {hasAdvancedDashboard ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    
                    {hasAdvancedDashboard ? (
                      <div className="p-4 bg-green-50 border border-green-200 rounded">
                        ✅ Advanced Dashboard with charts and analytics is available!
                      </div>
                    ) : (
                      <div className="p-4 bg-background border border-border rounded">
                        📊 Basic dashboard is shown (advanced features disabled)
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Example 2: Feature-Gated Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">2. Feature-Gated Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Bulk Operations</span>
                      <Badge variant={hasBulkOperations ? "default" : "secondary"}>
                        {hasBulkOperations ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        Select Item
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={!hasBulkOperations}
                      >
                        Bulk Delete {!hasBulkOperations && "(Feature Disabled)"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={!hasBulkOperations}
                      >
                        Bulk Export {!hasBulkOperations && "(Feature Disabled)"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Example 3: Integration Features */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">3. Integration Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Document AI Analysis</span>
                      <Badge variant={hasDocumentAI ? "default" : "secondary"}>
                        {hasDocumentAI ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    
                    {hasDocumentAI ? (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                        🤖 AI-powered document analysis is available!
                        <div className="mt-2">
                          <Button size="sm">Analyze Document</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-background border border-border rounded">
                        📄 Standard document upload only (AI features disabled)
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <h3 className="text-lg font-semibold">Features by Category</h3>
              
              {Object.entries({
                ui: 'User Interface',
                api: 'API & Backend',
                integration: 'Integrations',
                compliance: 'Compliance Tools',
                admin: 'Administration'
              }).map(([category, categoryName]) => {
                const categoryFeatures = getFeaturesByCategory(category);
                
                return (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="text-base">{categoryName}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {categoryFeatures.map((feature) => (
                          <div key={feature.key} className="flex items-center justify-between p-2 border rounded">
                            <div>
                              <div className="font-medium">{feature.name}</div>
                              <div className="text-sm text-muted-foreground">{feature.description}</div>
                            </div>
                            <Badge variant={
                              tenantFeatures[feature.key] ?? feature.defaultValue ? "default" : "secondary"
                            }>
                              {tenantFeatures[feature.key] ?? feature.defaultValue ? "On" : "Off"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="tenant-config" className="space-y-4">
              <h3 className="text-lg font-semibold">Current Tenant Configuration</h3>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Feature Flags Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(getAllFeatures()).map(([key, feature]) => {
                      const isEnabled = tenantFeatures[key] ?? feature.defaultValue;
                      
                      return (
                        <div key={key} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">{feature.name}</div>
                            <div className="text-sm text-muted-foreground">{feature.description}</div>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {feature.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={isEnabled}
                              disabled={true} // Read-only in this example
                            />
                            <Badge variant={isEnabled ? "default" : "secondary"}>
                              {isEnabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Development Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <h4 className="font-semibold text-green-800 mb-2">✅ DO</h4>
                <ul className="text-sm space-y-1 text-green-700">
                  <li>• Wrap new features in feature flags</li>
                  <li>• Test with different tenant configurations</li>
                  <li>• Use default values for new features</li>
                  <li>• Make database changes backward compatible</li>
                  <li>• Document feature flag usage</li>
                </ul>
              </div>
              
              <div className="p-4 bg-red-50 border border-red-200 rounded">
                <h4 className="font-semibold text-red-800 mb-2">❌ DON'T</h4>
                <ul className="text-sm space-y-1 text-red-700">
                  <li>• Deploy features directly without flags</li>
                  <li>• Break existing tenant configurations</li>
                  <li>• Remove database columns without migration</li>
                  <li>• Assume all tenants want new features</li>
                  <li>• Forget to test multi-tenant scenarios</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 