import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Clock, Cloud, Database, Globe, Shield, Zap } from 'lucide-react';

interface TenantConfig {
  // Customer Information
  customerName: string;
  organizationDomain: string;
  customerSubdomain: string;
  contactEmail: string;
  organizationUrl: string;
  
  // AWS Infrastructure
  awsRegion: string;
  awsAccountId: string;
  clusterName: string;
  serviceName: string;
  ecrRepository: string;
  
  // Database Configuration
  databaseType: string;
  databaseUrl: string;
  
  // Branding
  primaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  
  // Features
  maxUsers: number;
  maxRegulations: number;
  samlEnabled: boolean;
  ssoProvider: string;
}

interface DeploymentStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  details?: string;
}

const TenantCreationWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);

  // Set development admin token if not already set
  React.useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      localStorage.setItem('admin_token', 'admin-token-12345');
      console.log('Development admin token set');
    }
  }, []);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig>({
    customerName: '',
    organizationDomain: '',
    customerSubdomain: '',
    contactEmail: '',
    organizationUrl: '',
    awsRegion: 'us-east-1',
    awsAccountId: '259661441422',
    clusterName: '',
    serviceName: '',
    ecrRepository: '',
    databaseType: 'neon',
    databaseUrl: '',
    primaryColor: '#3b82f6',
    logoUrl: '',
    faviconUrl: '',
    maxUsers: 1000,
    maxRegulations: 5000,
    samlEnabled: false,
    ssoProvider: ''
  });

  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'completed' | 'failed'>('idle');
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([
    { id: 'vpc', name: 'Create VPC', description: 'Setting up isolated network infrastructure', status: 'pending' },
    { id: 'ecs', name: 'Create ECS Cluster', description: 'Deploying container orchestration', status: 'pending' },
    { id: 'rds', name: 'Setup Database', description: 'Configuring PostgreSQL instance', status: 'pending' },
    { id: 'alb', name: 'Configure Load Balancer', description: 'Setting up traffic routing and SSL', status: 'pending' },
    { id: 'ecr', name: 'Create Container Registry', description: 'Setting up Docker image repository', status: 'pending' },
    { id: 'task', name: 'Deploy Application', description: 'Launching EdSteward containers', status: 'pending' },
    { id: 'dns', name: 'Configure DNS', description: 'Setting up domain routing', status: 'pending' },
    { id: 'monitoring', name: 'Setup Monitoring', description: 'Configuring health checks and logs', status: 'pending' }
  ]);

  const [websocket, setWebsocket] = useState<WebSocket | null>(null);

  // Auto-generate derived values
  useEffect(() => {
    if (tenantConfig.customerName) {
      const subdomain = tenantConfig.customerName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const clusterName = `edsteward-${subdomain}-cluster`;
      const serviceName = `edsteward-${subdomain}-service`;
      const ecrRepository = `edsteward-${subdomain}`;
      
      setTenantConfig(prev => ({
        ...prev,
        customerSubdomain: subdomain,
        clusterName,
        serviceName,
        ecrRepository
      }));
    }
  }, [tenantConfig.customerName]);

  const handleInputChange = (field: keyof TenantConfig, value: string | number | boolean) => {
    setTenantConfig(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(tenantConfig.customerName && tenantConfig.organizationDomain && tenantConfig.contactEmail);
      case 2:
        return !!(tenantConfig.awsRegion && tenantConfig.awsAccountId);
      case 3:
        return !!(tenantConfig.databaseType && tenantConfig.databaseUrl);
      case 4:
        return true; // Branding is optional
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const startDeployment = async () => {
    setDeploymentStatus('deploying');
    setDeploymentError(null);
    console.log('Deploy button clicked!');
    
    try {
      // Connect to WebSocket for real-time updates
      console.log('Connecting to WebSocket at ws://localhost:4000/ws/deployment...');
      const ws = new WebSocket(`ws://localhost:4000/ws/deployment`);
      setWebsocket(ws);

      ws.onopen = () => {
        console.log('WebSocket connection established successfully');
      };

      ws.onerror = (error) => {
        console.error('WebSocket connection error:', error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
      };

      ws.onmessage = (event) => {
        const update = JSON.parse(event.data);
        console.log('WebSocket update received:', update);
        
        if (update.type === 'step_update') {
          setDeploymentSteps(prev => 
            prev.map(step => 
              step.id === update.stepId 
                ? { ...step, status: update.status, details: update.details }
                : step
            )
          );
        } else if (update.type === 'deployment_complete') {
          setDeploymentStatus('completed');
          setDeploymentSteps(prev => 
            prev.map(step => ({ ...step, status: 'completed' }))
          );
        } else if (update.type === 'deployment_failed') {
          setDeploymentStatus('failed');
          console.error('Deployment failed:', update.error);
        }
      };

      // Start deployment via API
      console.log('Starting deployment with config:', tenantConfig);
      
      const response = await fetch('http://localhost:4000/api/tenants/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || 'admin-token-12345'}`
        },
        body: JSON.stringify(tenantConfig)
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Deployment failed to start: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Deployment started successfully:', result);

    } catch (error) {
      console.error('Deployment error:', error);
      setDeploymentStatus('failed');
      setDeploymentError(error instanceof Error ? error.message : String(error));
      
      // Close WebSocket if it exists
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'running': return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Customer Deployment Information
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Each customer gets their own subdomain: <strong>{tenantConfig.customerSubdomain || 'customer'}.edsteward.ai</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName">Customer/Organization Name *</Label>
                <Input
                  id="customerName"
                  value={tenantConfig.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  placeholder="Acme University"
                />
              </div>
              <div>
                <Label htmlFor="organizationDomain">Organization Domain *</Label>
                <Input
                  id="organizationDomain"
                  value={tenantConfig.organizationDomain}
                  onChange={(e) => handleInputChange('organizationDomain', e.target.value)}
                  placeholder="acme.edu"
                />
                <p className="text-xs text-gray-500 mt-1">Their actual domain (for reference only)</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerSubdomain">EdSteward Deployment URL</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="customerSubdomain"
                    value={tenantConfig.customerSubdomain}
                    readOnly
                    className="bg-gray-100"
                  />
                  <span className="text-sm text-gray-500">.edsteward.ai</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Auto-generated from customer name</p>
              </div>
              <div>
                <Label htmlFor="contactEmail">Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={tenantConfig.contactEmail}
                  onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                  placeholder="admin@acme.edu"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="organizationUrl">Organization Website URL</Label>
              <Input
                id="organizationUrl"
                value={tenantConfig.organizationUrl}
                onChange={(e) => handleInputChange('organizationUrl', e.target.value)}
                placeholder="https://www.acme.edu"
              />
              <p className="text-xs text-gray-500 mt-1">Link to their main website (for reference)</p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                Complete AWS Isolation
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Each customer gets their own VPC, ECS cluster, RDS instance, and Load Balancer for complete isolation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="awsRegion">AWS Region *</Label>
                <Select value={tenantConfig.awsRegion} onValueChange={(value) => handleInputChange('awsRegion', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                    <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                    <SelectItem value="us-west-1">US West (N. California)</SelectItem>
                    <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                    <SelectItem value="eu-west-1">Europe (Ireland)</SelectItem>
                    <SelectItem value="eu-central-1">Europe (Frankfurt)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="awsAccountId">AWS Account ID *</Label>
                <Input
                  id="awsAccountId"
                  value={tenantConfig.awsAccountId}
                  onChange={(e) => handleInputChange('awsAccountId', e.target.value)}
                  placeholder="123456789012"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clusterName">ECS Cluster Name</Label>
                <Input
                  id="clusterName"
                  value={tenantConfig.clusterName}
                  readOnly
                  className="bg-gray-100"
                />
              </div>
              <div>
                <Label htmlFor="serviceName">ECS Service Name</Label>
                <Input
                  id="serviceName"
                  value={tenantConfig.serviceName}
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ecrRepository">ECR Repository</Label>
              <Input
                id="ecrRepository"
                value={tenantConfig.ecrRepository}
                readOnly
                className="bg-gray-100"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Configuration
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Each customer gets their own dedicated PostgreSQL database instance.
              </p>
            </div>

            <div>
              <Label htmlFor="databaseType">Database Type</Label>
              <Select value={tenantConfig.databaseType} onValueChange={(value) => handleInputChange('databaseType', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neon">Neon PostgreSQL (Recommended)</SelectItem>
                  <SelectItem value="rds">AWS RDS PostgreSQL</SelectItem>
                  <SelectItem value="custom">Custom PostgreSQL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="databaseUrl">Database Connection URL *</Label>
              <Textarea
                id="databaseUrl"
                value={tenantConfig.databaseUrl}
                onChange={(e) => handleInputChange('databaseUrl', e.target.value)}
                placeholder="postgresql://user:password@host:5432/database?sslmode=require"
                className="font-mono text-sm"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Branding & Configuration
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Customize the appearance and limits for this customer.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={tenantConfig.primaryColor}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    value={tenantConfig.primaryColor}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={tenantConfig.logoUrl}
                  onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxUsers">Max Users</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  value={tenantConfig.maxUsers}
                  onChange={(e) => handleInputChange('maxUsers', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="maxRegulations">Max Regulations</Label>
                <Input
                  id="maxRegulations"
                  type="number"
                  value={tenantConfig.maxRegulations}
                  onChange={(e) => handleInputChange('maxRegulations', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="samlEnabled"
                  checked={tenantConfig.samlEnabled}
                  onChange={(e) => handleInputChange('samlEnabled', e.target.checked)}
                />
                <Label htmlFor="samlEnabled">Enable SAML Authentication</Label>
              </div>

              {tenantConfig.samlEnabled && (
                <div>
                  <Label htmlFor="ssoProvider">SSO Provider</Label>
                  <Select value={tenantConfig.ssoProvider} onValueChange={(value) => handleInputChange('ssoProvider', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select SSO provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="azure">Azure AD / Entra ID</SelectItem>
                      <SelectItem value="okta">Okta</SelectItem>
                      <SelectItem value="google">Google Workspace</SelectItem>
                      <SelectItem value="generic">Generic SAML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Deployment Progress
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Real-time monitoring of AWS infrastructure provisioning and application deployment.
              </p>
            </div>

            <div className="space-y-4">
              {deploymentSteps.map((step, index) => (
                <div key={step.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    {getStepIcon(step.status)}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{step.name}</h4>
                      <Badge variant={
                        step.status === 'completed' ? 'default' :
                        step.status === 'running' ? 'secondary' :
                        step.status === 'failed' ? 'destructive' : 'outline'
                      }>
                        {step.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{step.description}</p>
                    {step.details && (
                      <p className="text-xs text-gray-500 mt-1">{step.details}</p>
                    )}
                    {step.duration && (
                      <p className="text-xs text-gray-500 mt-1">Duration: {step.duration}s</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {deploymentStatus === 'idle' && (
              <Button onClick={startDeployment} className="w-full" size="lg">
                <Shield className="h-5 w-5 mr-2" />
                Deploy Isolated AWS Infrastructure
              </Button>
            )}

            {deploymentStatus === 'deploying' && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Deploying infrastructure...</p>
              </div>
            )}

            {deploymentStatus === 'completed' && (
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <h4 className="font-semibold text-green-700">Deployment Completed!</h4>
                <p className="text-sm text-green-600">
                  Customer deployment is ready at: <strong>https://{tenantConfig.customerSubdomain}.edsteward.ai</strong>
                </p>
                <p className="text-xs text-green-500 mt-1">
                  Complete AWS isolation with dedicated VPC, ECS cluster, and database
                </p>
              </div>
            )}

            {deploymentStatus === 'failed' && (
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <h4 className="font-semibold text-red-700">Deployment Failed</h4>
                <p className="text-sm text-red-600">
                  {deploymentError || 'Please check the logs and try again.'}
                </p>
                <Button 
                  onClick={() => {
                    setDeploymentStatus('idle');
                    setDeploymentError(null);
                    setDeploymentSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
                  }}
                  variant="outline"
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-6 w-6" />
            Create New Tenant - Enhanced ECS Isolation
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Progress value={(currentStep / 5) * 100} className="flex-grow" />
            <span className="text-sm text-gray-500">Step {currentStep} of 5</span>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs value={currentStep.toString()} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="1">Organization</TabsTrigger>
              <TabsTrigger value="2">AWS</TabsTrigger>
              <TabsTrigger value="3">Database</TabsTrigger>
              <TabsTrigger value="4">Branding</TabsTrigger>
              <TabsTrigger value="5">Deploy</TabsTrigger>
            </TabsList>

            {[1, 2, 3, 4, 5].map(step => (
              <TabsContent key={step} value={step.toString()}>
                {renderStepContent()}
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            
            {currentStep < 5 ? (
              <Button
                onClick={nextStep}
                disabled={!validateStep(currentStep)}
              >
                Next
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TenantCreationWizard; 