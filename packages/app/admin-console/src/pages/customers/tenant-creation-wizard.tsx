import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  AlertCircle, CheckCircle, Database, ArrowLeft, ArrowRight,
  Loader2, Building2, User, Server, Rocket, Check, KeyRound, Copy, RefreshCw
} from 'lucide-react';

const PASSPHRASE_WORDS = [
  'apple','arrow','badge','beach','bell','bird','bloom','board','bonus','brave',
  'brick','bridge','bright','brook','cabin','camel','candy','cedar','chain','chair',
  'chalk','charm','chase','chess','chief','claim','clash','clean','cliff','climb',
  'clock','cloud','coach','coral','crane','creek','crest','crown','crush','dance',
  'delta','dream','drift','eagle','earth','ember','fence','field','flame','flash',
  'fleet','flint','flora','forge','frost','giant','glade','gleam','globe','grace',
  'grain','grape','grass','green','grove','guard','haven','hazel','heart','heron',
  'honey','ivory','jewel','knoll','larch','lemon','light','lilac','linen','lunar',
  'maple','marsh','mason','melon','mirth','moose','noble','north','ocean','olive',
  'onyx','orbit','otter','pansy','patch','peach','pearl','petal','pilot','plume',
  'polar','poppy','prism','quail','quart','quest','raven','ridge','river','robin',
  'royal','sable','sage','scout','shade','shell','shore','sigma','slate','solar',
  'spark','spire','stag','steam','steel','stone','storm','stove','swamp','swift',
  'thorn','tiger','torch','tower','trace','trail','tulip','umbra','unity','valor',
  'velvet','vigor','viola','vivid','waltz','watch','wheat','willow','wren','zenith',
];

function generatePassphrase(): string {
  const words: string[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * PASSPHRASE_WORDS.length);
    words.push(PASSPHRASE_WORDS[idx]);
  }
  return words.join('');
}

const API_BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'staging', 'template', 'test', 'dev',
  'mail', 'smtp', 'ftp', 'ssh', 'ns1', 'ns2', 'cdn', 'assets',
  'static', 'docs', 'help', 'support', 'status', 'blog',
];

interface TenantFormData {
  name: string;
  subdomain: string;
  contactEmail: string;
  contactName: string;
  plan: 'starter' | 'professional' | 'enterprise';
  adminUsername: string;
  adminPassword: string;
}

interface ProvisioningStep {
  step: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  data?: any;
}

type WizardStep = 'organization' | 'admin-user' | 'review' | 'provisioning' | 'complete';

const WIZARD_STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: 'organization', label: 'Organization', icon: <Building2 className="h-4 w-4" /> },
  { id: 'admin-user', label: 'Admin Credentials', icon: <KeyRound className="h-4 w-4" /> },
  { id: 'review', label: 'Review', icon: <Check className="h-4 w-4" /> },
  { id: 'provisioning', label: 'Setup', icon: <Server className="h-4 w-4" /> },
  { id: 'complete', label: 'Complete', icon: <Rocket className="h-4 w-4" /> },
];

const TenantCreationWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('organization');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisioningSteps, setProvisioningSteps] = useState<ProvisioningStep[]>([]);
  const [_createdTenant, setCreatedTenant] = useState<any>(null);

  const [formData, setFormData] = useState<TenantFormData>(() => ({
    name: '',
    subdomain: '',
    contactEmail: '',
    contactName: '',
    plan: 'professional',
    adminUsername: 'admin',
    adminPassword: generatePassphrase(),
  }));

  const handleNameChange = (name: string) => {
    const subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    setFormData(prev => ({ ...prev, name, subdomain }));
  };

  const handleChange = (field: keyof TenantFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getStepIndex = (step: WizardStep) => WIZARD_STEPS.findIndex(s => s.id === step);
  const progress = ((getStepIndex(currentStep) + 1) / WIZARD_STEPS.length) * 100;

  // ===== VALIDATION =====

  const validateOrganization = (): string | null => {
    if (!formData.name.trim()) return 'Organization name is required';
    if (!formData.subdomain.trim()) return 'Subdomain is required';
    if (!/^[a-z0-9-]+$/.test(formData.subdomain)) return 'Subdomain must be lowercase letters, numbers, and hyphens only';
    if (formData.subdomain.length < 3) return 'Subdomain must be at least 3 characters';
    if (RESERVED_SUBDOMAINS.includes(formData.subdomain)) return `"${formData.subdomain}" is a reserved subdomain and cannot be used`;
    if (formData.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) return 'Invalid email format';
    return null;
  };

  const validateAdminUser = (): string | null => {
    if (!formData.adminUsername.trim()) return 'Username is required';
    if (formData.adminUsername.length < 3) return 'Username must be at least 3 characters';
    if (!formData.adminPassword) return 'Temporary password is required';
    if (formData.adminPassword.length < 12) return 'Password must be at least 12 characters';
    return null;
  };

  // ===== NAVIGATION =====

  const nextStep = () => {
    setError(null);
    
    if (currentStep === 'organization') {
      const err = validateOrganization();
      if (err) { setError(err); return; }
      setCurrentStep('admin-user');
    } else if (currentStep === 'admin-user') {
      const err = validateAdminUser();
      if (err) { setError(err); return; }
      setCurrentStep('review');
    } else if (currentStep === 'review') {
      startProvisioning();
    }
  };

  const prevStep = () => {
    setError(null);
    if (currentStep === 'admin-user') setCurrentStep('organization');
    else if (currentStep === 'review') setCurrentStep('admin-user');
  };

  // ===== PROVISIONING =====

  const startProvisioning = async () => {
    setCurrentStep('provisioning');
    setIsSubmitting(true);
    setError(null);

    setProvisioningSteps([
      { step: 1, name: 'Create Neon Database', status: 'pending' },
      { step: 2, name: 'Clone Schema', status: 'pending' },
      { step: 3, name: 'Copy Regulations & Tasks', status: 'pending' },
      { step: 4, name: 'Create Admin User', status: 'pending' },
      { step: 5, name: 'Register Tenant', status: 'pending' },
      { step: 6, name: 'Finalize', status: 'pending' },
    ]);

    try {
      const token = localStorage.getItem('admin_token');
      
      const response = await fetch(`${API_BASE}/api/provisioning/full`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          subdomain: formData.subdomain,
          contactEmail: formData.contactEmail || undefined,
          contactName: formData.contactName || undefined,
          plan: formData.plan,
          adminUser: {
            username: formData.adminUsername,
            password: formData.adminPassword,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setProvisioningSteps(result.steps);
        setCreatedTenant(result);
        setCurrentStep('complete');
      } else {
        setProvisioningSteps(result.steps || []);
        setError(result.error || 'Provisioning failed');
      }
    } catch (err) {
      console.error('Provisioning error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // ===== RENDER FUNCTIONS =====

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        {WIZARD_STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isPast = getStepIndex(currentStep) > index;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' :
                isPast ? 'text-green-600' :
                'text-gray-400'
              }`}
            >
              {isPast ? <CheckCircle className="h-4 w-4" /> : step.icon}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          );
        })}
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );

  const renderOrganizationStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Organization Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Acme University"
            className="bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan">Subscription Plan</Label>
          <select
            id="plan"
            value={formData.plan}
            onChange={(e) => handleChange('plan', e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
          >
            <option value="starter">Starter (10 users, 100 regulations)</option>
            <option value="professional">Professional (100 users, 1000 regulations)</option>
            <option value="enterprise">Enterprise (Unlimited)</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subdomain">EdSteward URL</Label>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">https://</span>
          <Input
            id="subdomain"
            value={formData.subdomain}
            onChange={(e) => handleChange('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="acme"
            className="max-w-[200px] bg-white"
          />
          <span className="text-gray-500 text-sm">.edsteward.ai</span>
        </div>
        <p className="text-xs text-gray-500">This will be their login URL</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Contact Email (optional)</Label>
          <Input
            id="contactEmail"
            type="email"
            value={formData.contactEmail}
            onChange={(e) => handleChange('contactEmail', e.target.value)}
            placeholder="admin@acme.edu"
            className="bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Name (optional)</Label>
          <Input
            id="contactName"
            value={formData.contactName}
            onChange={(e) => handleChange('contactName', e.target.value)}
            placeholder="John Smith"
            className="bg-white"
          />
        </div>
      </div>
    </div>
  );

  const renderAdminUserStep = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Admin Credentials:</strong> This creates the initial login for {formData.name || 'this organization'}.
          The admin will be <strong>required to change their password</strong> on first login.
          They can then configure branding, institution profile, and add other users from inside the app.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="adminUsername">Username *</Label>
        <Input
          id="adminUsername"
          value={formData.adminUsername}
          onChange={(e) => handleChange('adminUsername', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="admin"
          className="bg-white max-w-sm"
        />
        <p className="text-xs text-gray-500">Lowercase letters, numbers, and underscores only</p>
      </div>

      <div className="space-y-2">
        <Label>Temporary Password</Label>
        <div className="flex items-center gap-2 max-w-sm">
          <code className="flex-1 bg-gray-100 border rounded-md px-3 py-2 text-sm font-mono tracking-wide select-all">
            {formData.adminPassword}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleChange('adminPassword', generatePassphrase())}
            title="Generate new passphrase"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(formData.adminPassword)}
            title="Copy to clipboard"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500">Auto-generated passphrase. The admin will be forced to change this on first login.</p>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          Organization
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Name:</span> <strong>{formData.name}</strong></div>
          <div><span className="text-gray-500">Plan:</span> <strong className="capitalize">{formData.plan}</strong></div>
          <div><span className="text-gray-500">URL:</span> <strong>https://{formData.subdomain}.edsteward.ai</strong></div>
          {formData.contactEmail && (
            <div><span className="text-gray-500">Contact:</span> <strong>{formData.contactEmail}</strong></div>
          )}
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-green-600" />
          Admin Credentials
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Username:</span> <strong>{formData.adminUsername}</strong></div>
          <div><span className="text-gray-500">Password reset:</span> <strong>Required on first login</strong></div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-6 space-y-2">
        <h3 className="font-semibold text-blue-900">What happens next</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>A new isolated Neon database will be created</li>
          <li>All regulations and compliance tasks will be copied from the template</li>
          <li>The admin user will be created with a forced password reset</li>
          <li>EdSteward default branding will be applied (the admin can customize later)</li>
        </ul>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Ready to provision?</strong> This process takes about 1-2 minutes. 
          The tenant admin will configure branding, institution profile, and other settings themselves.
        </p>
      </div>
    </div>
  );

  const renderProvisioningStep = () => (
    <div className="space-y-6">
      {!error && (
        <div className="text-center mb-8">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
          <h3 className="text-lg font-semibold">Provisioning {formData.name}...</h3>
          <p className="text-gray-500">Please wait while we set up the tenant</p>
        </div>
      )}

      <div className="space-y-3">
        {provisioningSteps.map((step) => (
          <div 
            key={step.step}
            className={`flex items-center gap-3 p-3 rounded-lg ${
              step.status === 'completed' ? 'bg-green-50' :
              step.status === 'in_progress' ? 'bg-blue-50' :
              step.status === 'failed' ? 'bg-red-50' :
              'bg-gray-50'
            }`}
          >
            {step.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-600" />}
            {step.status === 'in_progress' && <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />}
            {step.status === 'failed' && <AlertCircle className="h-5 w-5 text-red-600" />}
            {step.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-gray-300" />}
            
            <div className="flex-1">
              <p className={`font-medium ${
                step.status === 'completed' ? 'text-green-700' :
                step.status === 'in_progress' ? 'text-blue-700' :
                step.status === 'failed' ? 'text-red-700' :
                'text-gray-500'
              }`}>
                Step {step.step}: {step.name}
              </p>
              {step.message && (
                <p className="text-sm text-gray-600">{step.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Provisioning Failed</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center py-8">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      
      <h2 className="text-2xl font-bold text-green-800 mb-2">
        Tenant Created Successfully!
      </h2>
      
      <p className="text-gray-600 mb-6">
        <strong>{formData.name}</strong> is ready to use
      </p>

      <a 
        href={`https://${formData.subdomain}.edsteward.ai`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-8 py-4 bg-[#2e1b68] text-white rounded-lg hover:opacity-90 transition-opacity text-lg font-semibold mb-8"
      >
        Open https://{formData.subdomain}.edsteward.ai
      </a>

      <div className="bg-gray-50 rounded-lg p-6 text-left max-w-lg mx-auto">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Login Credentials (share with tenant admin)
        </h4>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">URL:</span>
            <div className="flex items-center gap-2">
              <code className="bg-white px-2 py-1 rounded">https://{formData.subdomain}.edsteward.ai</code>
              <button onClick={() => copyToClipboard(`https://${formData.subdomain}.edsteward.ai`)} className="text-gray-400 hover:text-gray-600">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Username:</span>
            <div className="flex items-center gap-2">
              <code className="bg-white px-2 py-1 rounded">{formData.adminUsername}</code>
              <button onClick={() => copyToClipboard(formData.adminUsername)} className="text-gray-400 hover:text-gray-600">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Temp Password:</span>
            <div className="flex items-center gap-2">
              <code className="bg-white px-2 py-1 rounded">{formData.adminPassword}</code>
              <button onClick={() => copyToClipboard(formData.adminPassword)} className="text-gray-400 hover:text-gray-600">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="mt-3 p-2 bg-amber-50 rounded text-xs text-amber-700">
          The admin will be required to set a new password on first login.
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6 text-left max-w-lg mx-auto">
        <h4 className="font-semibold text-blue-900 mb-3">What the tenant admin should do after first login:</h4>
        <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
          <li>Change their password (forced on first login)</li>
          <li>Go to <strong>System Settings</strong> to configure institution type and state</li>
          <li>Go to <strong>System Settings &gt; Branding</strong> to set their logo and colors</li>
          <li>Go to <strong>User Management</strong> to add other users</li>
        </ol>
      </div>

      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-6 text-left max-w-lg mx-auto">
        <h4 className="font-semibold text-gray-900 mb-3">EdSteward Admin Checklist:</h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 rounded" />
            <span><strong>DNS CNAME:</strong> Run <code className="bg-white px-1 rounded text-xs">scripts/add-new-tenant.sh {formData.subdomain}</code></span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 rounded" />
            <span><strong>Verify site:</strong> Open the URL above and confirm it loads</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 rounded" />
            <span><strong>Send credentials:</strong> Share the login details with the tenant admin</span>
          </li>
        </ul>
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <Button variant="outline" onClick={() => navigate('/customers')}>
          Back to Customers
        </Button>
        <Button onClick={() => {
          setCurrentStep('organization');
          setFormData({
            name: '', subdomain: '', contactEmail: '', contactName: '', plan: 'professional',
            adminUsername: 'admin', adminPassword: generatePassphrase(),
          });
          setCreatedTenant(null);
          setProvisioningSteps([]);
          setError(null);
        }}>
          Create Another Tenant
        </Button>
      </div>
    </div>
  );

  // ===== MAIN RENDER =====

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            Create New Tenant
          </CardTitle>
          <CardDescription>
            Provision a new EdSteward tenant with their own isolated database
          </CardDescription>
        </CardHeader>

        <CardContent>
          {renderStepIndicator()}

          {error && currentStep !== 'provisioning' && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {currentStep === 'organization' && renderOrganizationStep()}
          {currentStep === 'admin-user' && renderAdminUserStep()}
          {currentStep === 'review' && renderReviewStep()}
          {currentStep === 'provisioning' && renderProvisioningStep()}
          {currentStep === 'complete' && renderCompleteStep()}
        </CardContent>

        {currentStep !== 'provisioning' && currentStep !== 'complete' && (
          <CardFooter className="flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={currentStep === 'organization' ? () => navigate('/customers') : prevStep}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {currentStep === 'organization' ? 'Cancel' : 'Back'}
            </Button>
            
            <Button onClick={nextStep} disabled={isSubmitting}>
              {currentStep === 'review' ? (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Start Provisioning
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default TenantCreationWizard;
