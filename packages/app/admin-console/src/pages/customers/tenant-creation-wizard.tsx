import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  AlertCircle, CheckCircle, Database, ArrowLeft, ArrowRight,
  Loader2, Building2, User, Palette, Server, Rocket, Check, Landmark
} from 'lucide-react';

// API base URL
const API_BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

// ===== TYPES =====

const INSTITUTION_PRIMARY_TYPES = [
  { value: 'public-4year', label: 'Public 4-Year University' },
  { value: 'private-nonprofit-4year', label: 'Private Nonprofit 4-Year University' },
  { value: 'public-2year', label: 'Public 2-Year College' },
  { value: 'private-nonprofit-2year', label: 'Private Nonprofit 2-Year College' },
  { value: 'private-for-profit', label: 'Private For-Profit Institution' },
];

const INSTITUTION_CHARACTERISTICS = [
  { value: 'religious-affiliation', label: 'Religious Affiliation' },
  { value: 'research-intensive', label: 'Research Intensive' },
  { value: 'graduate-professional', label: 'Graduate/Professional Programs' },
  { value: 'intercollegiate-athletics', label: 'Intercollegiate Athletics' },
  { value: 'online-distance-ed', label: 'Online/Distance Education' },
  { value: 'medical-health-programs', label: 'Medical/Health Programs' },
  { value: 'residential-campus', label: 'Residential Campus' },
  { value: 'title-iv-participant', label: 'Title IV Participant' },
];

const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'staging', 'template', 'test', 'dev',
  'mail', 'smtp', 'ftp', 'ssh', 'ns1', 'ns2', 'cdn', 'assets',
  'static', 'docs', 'help', 'support', 'status', 'blog',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DC','DE','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
];

interface TenantFormData {
  // Step 1: Organization Info
  name: string;
  subdomain: string;
  contactEmail: string;
  contactName: string;
  plan: 'starter' | 'professional' | 'enterprise';
  
  // Step 2: Admin User
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  
  // Step 3: Branding
  primaryColor: string;
  logoUrl: string;

  // Step 4: Institution
  institutionType: string;
  institutionCharacteristics: string[];
  stateCode: string;
}

interface ProvisioningStep {
  step: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  data?: any;
}

type WizardStep = 'organization' | 'admin-user' | 'branding' | 'institution' | 'review' | 'provisioning' | 'complete';

const WIZARD_STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: 'organization', label: 'Organization', icon: <Building2 className="h-4 w-4" /> },
  { id: 'admin-user', label: 'Admin User', icon: <User className="h-4 w-4" /> },
  { id: 'branding', label: 'Branding', icon: <Palette className="h-4 w-4" /> },
  { id: 'institution', label: 'Institution', icon: <Landmark className="h-4 w-4" /> },
  { id: 'review', label: 'Review', icon: <Check className="h-4 w-4" /> },
  { id: 'provisioning', label: 'Setup', icon: <Server className="h-4 w-4" /> },
  { id: 'complete', label: 'Complete', icon: <Rocket className="h-4 w-4" /> },
];

// ===== COMPONENT =====

const TenantCreationWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('organization');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisioningSteps, setProvisioningSteps] = useState<ProvisioningStep[]>([]);
  const [createdTenant, setCreatedTenant] = useState<any>(null);

  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    subdomain: '',
    contactEmail: '',
    contactName: '',
    plan: 'professional',
    adminUsername: '',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: '',
    primaryColor: '#1e40af',
    logoUrl: '',
    institutionType: '',
    institutionCharacteristics: ['title-iv-participant'],
    stateCode: '',
  });

  // Auto-generate subdomain from name
  const handleNameChange = (name: string) => {
    const subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    setFormData(prev => ({ ...prev, name, subdomain }));
  };

  // Auto-fill admin email from contact email
  const handleContactEmailChange = (email: string) => {
    setFormData(prev => ({
      ...prev,
      contactEmail: email,
      adminEmail: prev.adminEmail || email,
    }));
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
    // Contact email is optional - only validate format if provided
    if (formData.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) return 'Invalid email format';
    return null;
  };

  const validateAdminUser = (): string | null => {
    if (!formData.adminUsername.trim()) return 'Admin username is required';
    if (formData.adminUsername.length < 3) return 'Username must be at least 3 characters';
    if (!formData.adminEmail.trim()) return 'Admin email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) return 'Invalid email format';
    if (!formData.adminPassword) return 'Password is required';
    if (formData.adminPassword.length < 12) return 'Password must be at least 12 characters';
    if (!formData.adminFirstName.trim()) return 'First name is required';
    if (!formData.adminLastName.trim()) return 'Last name is required';
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
      setCurrentStep('branding');
    } else if (currentStep === 'branding') {
      setCurrentStep('institution');
    } else if (currentStep === 'institution') {
      setCurrentStep('review');
    } else if (currentStep === 'review') {
      startProvisioning();
    }
  };

  const prevStep = () => {
    setError(null);
    if (currentStep === 'admin-user') setCurrentStep('organization');
    else if (currentStep === 'branding') setCurrentStep('admin-user');
    else if (currentStep === 'institution') setCurrentStep('branding');
    else if (currentStep === 'review') setCurrentStep('institution');
  };

  // ===== PROVISIONING =====

  const startProvisioning = async () => {
    setCurrentStep('provisioning');
    setIsSubmitting(true);
    setError(null);

    // Initialize steps
    setProvisioningSteps([
      { step: 1, name: 'Create Neon Database', status: 'pending' },
      { step: 2, name: 'Clone Schema', status: 'pending' },
      { step: 3, name: 'Copy Regulations & Tasks', status: 'pending' },
      { step: 4, name: 'Create Admin User', status: 'pending' },
      { step: 5, name: 'Configure Branding', status: 'pending' },
      { step: 6, name: 'Register Tenant', status: 'pending' },
      { step: 7, name: 'Finalize', status: 'pending' },
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
          contactEmail: formData.contactEmail,
          contactName: formData.contactName,
          plan: formData.plan,
          adminUser: {
            username: formData.adminUsername,
            email: formData.adminEmail,
            password: formData.adminPassword,
            firstName: formData.adminFirstName,
            lastName: formData.adminLastName,
          },
          branding: {
            primaryColor: formData.primaryColor,
            logoUrl: formData.logoUrl || undefined,
          },
          institution: {
            primaryType: formData.institutionType || undefined,
            characteristics: formData.institutionCharacteristics,
            stateCode: formData.stateCode || undefined,
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

  // ===== RENDER FUNCTIONS =====

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        {WIZARD_STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isPast = getStepIndex(currentStep) > index;
          const isFuture = getStepIndex(currentStep) < index;

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
            onChange={(e) => handleContactEmailChange(e.target.value)}
            placeholder="admin@acme.edu"
            className="bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Name</Label>
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
          <strong>Admin User:</strong> This will be the first administrator account for {formData.name || 'this organization'}.
          They will have full access to manage the tenant.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="adminFirstName">First Name *</Label>
          <Input
            id="adminFirstName"
            value={formData.adminFirstName}
            onChange={(e) => handleChange('adminFirstName', e.target.value)}
            placeholder="John"
            className="bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminLastName">Last Name *</Label>
          <Input
            id="adminLastName"
            value={formData.adminLastName}
            onChange={(e) => handleChange('adminLastName', e.target.value)}
            placeholder="Smith"
            className="bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="adminUsername">Username *</Label>
          <Input
            id="adminUsername"
            value={formData.adminUsername}
            onChange={(e) => handleChange('adminUsername', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="jsmith"
            className="bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminEmail">Email *</Label>
          <Input
            id="adminEmail"
            type="email"
            value={formData.adminEmail}
            onChange={(e) => handleChange('adminEmail', e.target.value)}
            placeholder="jsmith@acme.edu"
            className="bg-white"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="adminPassword">Initial Password *</Label>
        <Input
          id="adminPassword"
          type="password"
          value={formData.adminPassword}
          onChange={(e) => handleChange('adminPassword', e.target.value)}
          placeholder="Minimum 12 characters"
          className="bg-white"
        />
        <p className="text-xs text-gray-500">The admin should change this password after first login</p>
      </div>
    </div>
  );

  const renderBrandingStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="primaryColor">Primary Brand Color</Label>
        <div className="flex items-center gap-4">
          <input
            type="color"
            id="primaryColor"
            value={formData.primaryColor}
            onChange={(e) => handleChange('primaryColor', e.target.value)}
            className="w-16 h-10 rounded border cursor-pointer"
          />
          <Input
            value={formData.primaryColor}
            onChange={(e) => handleChange('primaryColor', e.target.value)}
            placeholder="#1e40af"
            className="max-w-[150px] bg-white font-mono"
          />
          <div 
            className="px-4 py-2 rounded text-white text-sm font-medium"
            style={{ backgroundColor: formData.primaryColor }}
          >
            Preview
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="logoUrl">Logo URL (optional)</Label>
        <Input
          id="logoUrl"
          value={formData.logoUrl}
          onChange={(e) => handleChange('logoUrl', e.target.value)}
          placeholder="https://example.com/logo.png"
          className="bg-white"
        />
        <p className="text-xs text-gray-500">Leave blank to use default EdSteward branding. Can be changed later.</p>
      </div>

      {formData.logoUrl && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Logo Preview:</p>
          <img 
            src={formData.logoUrl} 
            alt="Logo preview" 
            className="max-h-16 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
    </div>
  );

  const toggleCharacteristic = (value: string) => {
    setFormData(prev => ({
      ...prev,
      institutionCharacteristics: prev.institutionCharacteristics.includes(value)
        ? prev.institutionCharacteristics.filter(c => c !== value)
        : [...prev.institutionCharacteristics, value],
    }));
  };

  const renderInstitutionStep = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Institution Profile:</strong> This determines which regulations are shown as applicable.
          The state code determines the federal circuit court jurisdiction. These can be adjusted later in System Settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="institutionType">Institution Type</Label>
          <select
            id="institutionType"
            value={formData.institutionType}
            onChange={(e) => handleChange('institutionType', e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
          >
            <option value="">Select type...</option>
            {INSTITUTION_PRIMARY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stateCode">State</Label>
          <select
            id="stateCode"
            value={formData.stateCode}
            onChange={(e) => handleChange('stateCode', e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
          >
            <option value="">Select state...</option>
            {US_STATES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500">Determines federal circuit court jurisdiction</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Institutional Characteristics</Label>
        <p className="text-xs text-gray-500 mb-2">Select all that apply — these activate additional regulatory requirements</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {INSTITUTION_CHARACTERISTICS.map(c => (
            <label key={c.value} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.institutionCharacteristics.includes(c.value)}
                onChange={() => toggleCharacteristic(c.value)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{c.label}</span>
            </label>
          ))}
        </div>
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
          <User className="h-5 w-5 text-green-600" />
          Admin User
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Name:</span> <strong>{formData.adminFirstName} {formData.adminLastName}</strong></div>
          <div><span className="text-gray-500">Username:</span> <strong>{formData.adminUsername}</strong></div>
          <div><span className="text-gray-500">Email:</span> <strong>{formData.adminEmail}</strong></div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Palette className="h-5 w-5 text-purple-600" />
          Branding
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">Primary Color:</span>
          <div 
            className="w-6 h-6 rounded border"
            style={{ backgroundColor: formData.primaryColor }}
          />
          <strong>{formData.primaryColor}</strong>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Landmark className="h-5 w-5 text-amber-600" />
          Institution Profile
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Type:</span> <strong>{INSTITUTION_PRIMARY_TYPES.find(t => t.value === formData.institutionType)?.label || 'Not set'}</strong></div>
          <div><span className="text-gray-500">State:</span> <strong>{formData.stateCode || 'Not set'}</strong></div>
          {formData.institutionCharacteristics.length > 0 && (
            <div className="col-span-2"><span className="text-gray-500">Characteristics:</span> <strong>{formData.institutionCharacteristics.map(c => INSTITUTION_CHARACTERISTICS.find(ic => ic.value === c)?.label).join(', ')}</strong></div>
          )}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Ready to provision?</strong> This will create a new Neon database, 
          copy all regulations and compliance tasks from the template, 
          and set up the admin user. This process takes about 1-2 minutes.
        </p>
      </div>
    </div>
  );

  const renderProvisioningStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
        <h3 className="text-lg font-semibold">Provisioning {formData.name}...</h3>
        <p className="text-gray-500">Please wait while we set up your tenant</p>
      </div>

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
        className="inline-block px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold mb-8"
      >
        Open https://{formData.subdomain}.edsteward.ai
      </a>

      <div className="bg-gray-50 rounded-lg p-6 text-left max-w-lg mx-auto">
        <h4 className="font-semibold mb-3">Login Credentials (break-glass account):</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Username:</span>
            <code className="bg-white px-2 py-1 rounded">{formData.adminUsername}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Password:</span>
            <code className="bg-white px-2 py-1 rounded">{formData.adminPassword}</code>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6 text-left max-w-lg mx-auto">
        <h4 className="font-semibold text-blue-900 mb-3">SSO Setup Info (share with IT):</h4>
        <div className="space-y-2 text-sm font-mono">
          <div>
            <span className="text-blue-600 font-sans text-xs block">SP Entity ID:</span>
            <code className="bg-white px-2 py-1 rounded block mt-0.5">urn:edsteward:sp:{formData.subdomain}</code>
          </div>
          <div>
            <span className="text-blue-600 font-sans text-xs block">ACS / Callback URL:</span>
            <code className="bg-white px-2 py-1 rounded block mt-0.5">https://{formData.subdomain}.edsteward.ai/auth/saml/callback</code>
          </div>
          <div>
            <span className="text-blue-600 font-sans text-xs block">Name ID Format:</span>
            <code className="bg-white px-2 py-1 rounded block mt-0.5 text-xs">urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</code>
          </div>
        </div>
        <p className="text-xs text-blue-700 mt-3">
          Send this info to the institution's IT department to configure their IdP. 
          Once they provide the IdP metadata, configure SSO from the Customers page.
        </p>
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-6 text-left max-w-lg mx-auto">
        <h4 className="font-semibold text-amber-900 mb-3">Post-Provisioning Checklist:</h4>
        <ul className="space-y-2 text-sm text-amber-800">
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 rounded" />
            <span><strong>DNS CNAME:</strong> Create <code>{formData.subdomain}.edsteward.ai</code> CNAME pointing to the ALB (run <code>scripts/add-new-tenant.sh {formData.subdomain}</code>)</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 rounded" />
            <span><strong>Verify site:</strong> Open <code>https://{formData.subdomain}.edsteward.ai</code> and log in</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 rounded" />
            <span><strong>Engine config:</strong> Enable tenant in <code>engine/config/customers.json</code> and push regulation updates</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 rounded" />
            <span><strong>SSO:</strong> When IT responds with IdP metadata, configure via Customers → SSO</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 rounded" />
            <span><strong>Password change:</strong> Ensure the admin changes their initial password</span>
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
            adminUsername: '', adminEmail: '', adminPassword: '', adminFirstName: '', adminLastName: '',
            primaryColor: '#1e40af', logoUrl: '',
            institutionType: '', institutionCharacteristics: ['title-iv-participant'], stateCode: '',
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
          {currentStep === 'branding' && renderBrandingStep()}
          {currentStep === 'institution' && renderInstitutionStep()}
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
