import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle, Database, ArrowLeft, Loader2 } from 'lucide-react';

// API base URL - use localhost in development, production URL otherwise
const API_BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

interface TenantFormData {
  name: string;
  subdomain: string;
  contact_email: string;
  database_url: string;
  plan: 'starter' | 'professional' | 'enterprise';
}

const TenantCreationWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'testing' | 'success' | 'error'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTenant, setCreatedTenant] = useState<any>(null);

  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    subdomain: '',
    contact_email: '',
    database_url: '',
    plan: 'starter'
  });

  // Auto-generate subdomain from name
  const handleNameChange = (name: string) => {
    const subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    setFormData(prev => ({ ...prev, name, subdomain }));
  };

  const handleChange = (field: keyof TenantFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Organization name is required';
    if (!formData.subdomain.trim()) return 'Subdomain is required';
    if (!/^[a-z0-9-]+$/.test(formData.subdomain)) return 'Subdomain must be lowercase letters, numbers, and hyphens only';
    if (!formData.contact_email.trim()) return 'Contact email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) return 'Invalid email format';
    if (!formData.database_url.trim()) return 'Database URL is required';
    if (!formData.database_url.startsWith('postgresql://') && !formData.database_url.startsWith('postgres://')) {
      return 'Database URL must start with postgresql:// or postgres://';
    }
    return null;
  };

  const testDatabaseConnection = async (): Promise<boolean> => {
    // For now, just return true - the backend will test on creation
    // In the future, we could add a /api/test-database endpoint
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setStep('testing');

    try {
      // Test database connection first
      const dbValid = await testDatabaseConnection();
      if (!dbValid) {
        throw new Error('Could not connect to the provided database URL');
      }

      // Create tenant
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to create tenant: ${response.status}`);
      }

      const tenant = await response.json();
      setCreatedTenant(tenant);
      setStep('success');

    } catch (err) {
      console.error('Tenant creation error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-6">
        {/* Organization Info */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">1</span>
            Organization Information
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme University"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email *</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => handleChange('contact_email', e.target.value)}
                placeholder="admin@acme.edu"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subdomain">EdSteward URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">https://</span>
              <Input
                id="subdomain"
                value={formData.subdomain}
                onChange={(e) => handleChange('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="acme"
                className="max-w-[200px]"
              />
              <span className="text-muted-foreground">.edsteward.ai</span>
            </div>
            <p className="text-xs text-muted-foreground">This will be their login URL</p>
          </div>
        </div>

        {/* Database */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm">2</span>
            Database Connection
          </h3>
          
          <div className="bg-blue-50 p-4 rounded-lg text-sm">
            <p className="font-medium text-blue-900">Create a new Neon database for this tenant:</p>
            <ol className="mt-2 list-decimal list-inside text-blue-800 space-y-1">
              <li>Go to <a href="https://console.neon.tech" target="_blank" rel="noopener noreferrer" className="underline">console.neon.tech</a></li>
              <li>Create a new project named <strong>edsteward-{formData.subdomain || 'tenant'}</strong></li>
              <li>Copy the connection string and paste below</li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label htmlFor="database_url">Database Connection URL *</Label>
            <Textarea
              id="database_url"
              value={formData.database_url}
              onChange={(e) => handleChange('database_url', e.target.value)}
              placeholder="postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
              className="font-mono text-sm"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">Neon PostgreSQL connection string</p>
          </div>
        </div>

        {/* Plan */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">3</span>
            Subscription Plan
          </h3>
          
          <div className="grid grid-cols-3 gap-4">
            {(['starter', 'professional', 'enterprise'] as const).map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => handleChange('plan', plan)}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  formData.plan === plan 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold capitalize">{plan}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {plan === 'starter' && '10 users, 100 regulations'}
                  {plan === 'professional' && '50 users, 500 regulations'}
                  {plan === 'enterprise' && 'Unlimited'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button type="button" variant="outline" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Create Tenant
            </>
          )}
        </Button>
      </CardFooter>
    </form>
  );

  const renderTesting = () => (
    <CardContent className="py-12 text-center">
      <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
      <h3 className="text-lg font-semibold">Setting Up Tenant...</h3>
      <p className="text-muted-foreground mt-2">Testing database connection and creating tenant record</p>
    </CardContent>
  );

  const renderSuccess = () => (
    <CardContent className="py-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>
      <h3 className="text-xl font-semibold text-green-800">Tenant Created Successfully!</h3>
      <p className="text-muted-foreground mt-2 mb-6">
        <strong>{createdTenant?.name}</strong> is ready to use at:
      </p>
      <a 
        href={`https://${createdTenant?.subdomain}.edsteward.ai`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        https://{createdTenant?.subdomain}.edsteward.ai
      </a>
      
      <div className="mt-8 p-4 bg-yellow-50 rounded-lg text-left max-w-md mx-auto">
        <h4 className="font-semibold text-yellow-800">Next Steps:</h4>
        <ol className="mt-2 list-decimal list-inside text-sm text-yellow-700 space-y-1">
          <li>Run database migrations on the new database</li>
          <li>Create the first admin user</li>
          <li>Configure DNS for {createdTenant?.subdomain}.edsteward.ai</li>
          <li>Set up SSO if needed</li>
        </ol>
      </div>

      <div className="mt-6 flex justify-center gap-4">
        <Button variant="outline" onClick={() => navigate('/customers')}>
          Back to Customers
        </Button>
        <Button onClick={() => {
          setStep('form');
          setFormData({
            name: '',
            subdomain: '',
            contact_email: '',
            database_url: '',
            plan: 'starter'
          });
          setCreatedTenant(null);
        }}>
          Create Another
        </Button>
      </div>
    </CardContent>
  );

  const renderError = () => (
    <CardContent className="py-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-red-600" />
      </div>
      <h3 className="text-xl font-semibold text-red-800">Creation Failed</h3>
      <p className="text-muted-foreground mt-2 mb-4">{error}</p>
      
      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={() => navigate('/customers')}>
          Back to Customers
        </Button>
        <Button onClick={() => {
          setStep('form');
          setError(null);
        }}>
          Try Again
        </Button>
      </div>
    </CardContent>
  );

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            Add New Tenant
          </CardTitle>
          <CardDescription>
            Create a new EdSteward tenant with their own isolated database
          </CardDescription>
        </CardHeader>

        {step === 'form' && renderForm()}
        {step === 'testing' && renderTesting()}
        {step === 'success' && renderSuccess()}
        {step === 'error' && renderError()}
      </Card>
    </div>
  );
};

export default TenantCreationWizard;
