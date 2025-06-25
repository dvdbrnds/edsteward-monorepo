import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Upload, 
  Download, 
  Mail, 
  MessageSquare, 
  Calendar,
  BarChart3,
  Users,
  Shield,
  Zap
} from 'lucide-react';
import { 
  FeatureDisabledMessage, 
  FeatureGate, 
  DisabledFeatureButton 
} from '@/components/common/feature-disabled-message';
import { useFeatureFlag } from '@/hooks/use-feature-flags';

export default function FeatureDisabledDemo() {
  // Simulate some feature flags being disabled
  const hasDocumentAI = false; // useFeatureFlag('document_ai');
  const hasBulkOperations = false; // useFeatureFlag('bulk_operations');
  const hasSMSNotifications = false; // useFeatureFlag('sms_notifications');
  const hasAdvancedAnalytics = false; // useFeatureFlag('tenant_analytics');

  return (
    <div className="space-y-6 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Feature Disabled Messaging Demo</h1>
        <p className="text-muted-foreground mb-6">
          See how disabled features are communicated to users with helpful messages and upgrade prompts.
        </p>

        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="admin">Admin Tools</TabsTrigger>
          </TabsList>

          {/* Documents Tab - Shows Document AI disabled */}
          <TabsContent value="documents" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Document Management</span>
                  </CardTitle>
                  <CardDescription>Upload and manage compliance documents</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Document
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Export All
                    </Button>
                  </div>

                  {/* Standard document upload works */}
                  <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center">
                    <FileText className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Drag and drop files here</p>
                  </div>

                  {/* AI Analysis section - disabled */}
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">AI Document Analysis</h4>
                    {hasDocumentAI ? (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-sm text-blue-800">AI analysis available!</p>
                        <Button size="sm" className="mt-2">Analyze Documents</Button>
                      </div>
                    ) : (
                      <FeatureDisabledMessage 
                        featureKey="document_ai" 
                        variant="card"
                        className="mt-2"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bulk Operations</CardTitle>
                  <CardDescription>Manage multiple documents at once</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="doc1" />
                      <label htmlFor="doc1" className="text-sm">Compliance Report 2024.pdf</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="doc2" />
                      <label htmlFor="doc2" className="text-sm">Policy Update Draft.docx</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="doc3" />
                      <label htmlFor="doc3" className="text-sm">Training Materials.pptx</label>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    {hasBulkOperations ? (
                      <>
                        <Button size="sm">Bulk Delete</Button>
                        <Button size="sm" variant="outline">Bulk Export</Button>
                      </>
                    ) : (
                      <>
                        <DisabledFeatureButton featureKey="bulk_operations" size="sm">
                          Bulk Delete
                        </DisabledFeatureButton>
                        <DisabledFeatureButton featureKey="bulk_operations" size="sm" variant="outline">
                          Bulk Export
                        </DisabledFeatureButton>
                      </>
                    )}
                  </div>

                  {!hasBulkOperations && (
                    <FeatureDisabledMessage 
                      featureKey="bulk_operations" 
                      variant="alert"
                      className="mt-4"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notifications Tab - Shows SMS disabled */}
          <TabsContent value="notifications" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Mail className="h-5 w-5" />
                    <span>Email Notifications</span>
                  </CardTitle>
                  <CardDescription>Email alerts and updates</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Deadline Reminders</span>
                      <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Regulation Updates</span>
                      <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Weekly Reports</span>
                      <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>
                  </div>
                  <Button className="w-full">
                    <Mail className="h-4 w-4 mr-2" />
                    Configure Email Settings
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5" />
                    <span>SMS Notifications</span>
                  </CardTitle>
                  <CardDescription>Text message alerts for urgent items</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasSMSNotifications ? (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Critical Deadlines</span>
                          <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">System Alerts</span>
                          <Badge className="bg-gray-100 text-gray-800">Disabled</Badge>
                        </div>
                      </div>
                      <Button className="w-full">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Configure SMS Settings
                      </Button>
                    </div>
                  ) : (
                    <FeatureDisabledMessage 
                      featureKey="sms_notifications" 
                      variant="card"
                      showContactInfo={true}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab - Shows advanced analytics disabled */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="space-y-4">
              {/* Basic analytics work */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Basic Analytics</span>
                  </CardTitle>
                  <CardDescription>Standard compliance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">87%</div>
                      <div className="text-xs text-gray-500">Compliance Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">23</div>
                      <div className="text-xs text-gray-500">Active Regulations</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">5</div>
                      <div className="text-xs text-gray-500">Upcoming Deadlines</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Advanced analytics - disabled */}
              <FeatureGate featureKey="tenant_analytics">
                <Card>
                  <CardHeader>
                    <CardTitle>Advanced Analytics Dashboard</CardTitle>
                    <CardDescription>Detailed insights and predictive analytics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>Advanced charts and insights would go here...</p>
                  </CardContent>
                </Card>
              </FeatureGate>
            </div>
          </TabsContent>

          {/* Admin Tools Tab - Shows various disabled admin features */}
          <TabsContent value="admin" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>User Management</span>
                  </CardTitle>
                  <CardDescription>Manage users and permissions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button className="w-full" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    View All Users
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    Manage Roles
                  </Button>
                  
                  {/* User impersonation - disabled */}
                  <div className="pt-4 border-t">
                    <FeatureDisabledMessage 
                      featureKey="user_impersonation" 
                      variant="inline"
                      className="mb-2"
                    />
                    <DisabledFeatureButton featureKey="user_impersonation" className="w-full">
                      <Users className="h-4 w-4 mr-2" />
                      Impersonate User
                    </DisabledFeatureButton>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feature Examples</CardTitle>
                  <CardDescription>Different ways to show disabled features</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Banner style */}
                  <FeatureDisabledMessage 
                    featureKey="calendar_integration" 
                    variant="banner"
                    customMessage="Calendar sync requires premium subscription."
                  />

                  {/* Inline style in a sentence */}
                  <p className="text-sm text-gray-600">
                    You can export data to CSV, but{' '}
                    <FeatureDisabledMessage 
                      featureKey="document_ai" 
                      variant="inline"
                      showContactInfo={false}
                    />
                    {' '}for your organization.
                  </p>

                  {/* Button with tooltip */}
                  <div className="flex gap-2">
                    <Button size="sm">
                      <Calendar className="h-4 w-4 mr-1" />
                      Basic Export
                    </Button>
                    <DisabledFeatureButton featureKey="advanced_search" size="sm">
                      <Zap className="h-4 w-4 mr-1" />
                      AI Export
                    </DisabledFeatureButton>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Summary */}
        <Alert className="mt-6">
          <Zap className="h-4 w-4" />
          <AlertDescription>
            <strong>How it works:</strong> When features are disabled via the admin panel, 
            users see contextual messages explaining why functionality is unavailable. 
            This creates transparency and can drive feature adoption conversations.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
} 