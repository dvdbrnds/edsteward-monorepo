import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Shield, Key, Server, Globe, CheckCircle, XCircle, AlertCircle,
  Loader2, Copy, ExternalLink, RefreshCw
} from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

// SSO Provider types
type SSOProvider = 'saml' | 'oidc' | 'cas';

interface SSOConfigurationProps {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  onClose?: () => void;
  onSave?: () => void;
}

interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  eduPersonEnabled?: boolean;
}

interface OIDCConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  preset?: 'azure-ad' | 'google' | 'auth0' | 'okta' | 'custom';
}

interface CASConfig {
  serverUrl: string;
  serviceValidateUrl?: string;
  version: '2.0' | '3.0';
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message?: string;
  error?: string;
}

const SSOConfiguration: React.FC<SSOConfigurationProps> = ({
  tenantId,
  tenantName,
  subdomain,
  onClose,
  onSave,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // SSO state
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<SSOProvider>('saml');
  const [autoProvisioning, setAutoProvisioning] = useState(true);
  const [defaultRole, setDefaultRole] = useState('user');
  const [allowedDomains, setAllowedDomains] = useState('');
  
  // Provider configs
  const [samlConfig, setSamlConfig] = useState<SAMLConfig>({
    entityId: '',
    ssoUrl: '',
    sloUrl: '',
    certificate: '',
    eduPersonEnabled: false,
  });
  
  const [oidcConfig, setOidcConfig] = useState<OIDCConfig>({
    issuerUrl: '',
    clientId: '',
    clientSecret: '',
    scopes: ['openid', 'profile', 'email'],
    preset: 'custom',
  });
  
  const [casConfig, setCasConfig] = useState<CASConfig>({
    serverUrl: '',
    serviceValidateUrl: '',
    version: '2.0',
  });
  
  // Test results
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Load existing config
  useEffect(() => {
    loadSSOConfig();
  }, [tenantId]);

  const loadSSOConfig = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/api/customers/${tenantId}/sso`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to load SSO configuration');
      
      const data = await response.json();
      
      setEnabled(data.ssoEnabled || false);
      setProvider(data.ssoProvider || 'saml');
      
      if (data.config) {
        setAutoProvisioning(data.config.autoProvisioning ?? true);
        setDefaultRole(data.config.defaultRole || 'user');
        setAllowedDomains((data.config.allowedDomains || []).join(', '));
        
        if (data.config.saml) {
          setSamlConfig({
            entityId: data.config.saml.entityId || data.saml?.entityId || '',
            ssoUrl: data.config.saml.ssoUrl || data.saml?.ssoUrl || '',
            sloUrl: data.config.saml.sloUrl || '',
            certificate: '', // Don't load certificate (security)
            eduPersonEnabled: data.config.saml.eduPersonEnabled || false,
          });
        }
        
        if (data.config.oidc) {
          setOidcConfig({
            issuerUrl: data.config.oidc.issuerUrl || '',
            clientId: data.config.oidc.clientId || '',
            clientSecret: '', // Don't load secret (security)
            scopes: data.config.oidc.scopes || ['openid', 'profile', 'email'],
            preset: data.config.oidc.preset || 'custom',
          });
        }
        
        if (data.config.cas) {
          setCasConfig({
            serverUrl: data.config.cas.serverUrl || '',
            serviceValidateUrl: data.config.cas.serviceValidateUrl || '',
            version: data.config.cas.version || '2.0',
          });
        }
      }
      
      // Also handle legacy SAML config
      if (data.saml && !data.config?.saml) {
        setSamlConfig({
          entityId: data.saml.entityId || '',
          ssoUrl: data.saml.ssoUrl || '',
          sloUrl: data.saml.sloUrl || '',
          certificate: '',
          eduPersonEnabled: data.saml.eduPersonEnabled || false,
        });
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const token = localStorage.getItem('admin_token');
      
      // Build config based on provider
      const config: any = {
        autoProvisioning,
        defaultRole,
        allowedDomains: allowedDomains.split(',').map(d => d.trim()).filter(Boolean),
      };
      
      if (provider === 'saml') {
        config.saml = {
          entityId: samlConfig.entityId,
          ssoUrl: samlConfig.ssoUrl,
          sloUrl: samlConfig.sloUrl || undefined,
          certificate: samlConfig.certificate,
          eduPersonEnabled: samlConfig.eduPersonEnabled,
        };
      } else if (provider === 'oidc') {
        config.oidc = {
          issuerUrl: oidcConfig.issuerUrl,
          clientId: oidcConfig.clientId,
          clientSecret: oidcConfig.clientSecret,
          scopes: oidcConfig.scopes,
          preset: oidcConfig.preset,
        };
      } else if (provider === 'cas') {
        config.cas = {
          serverUrl: casConfig.serverUrl,
          serviceValidateUrl: casConfig.serviceValidateUrl || undefined,
          version: casConfig.version,
        };
      }
      
      const response = await fetch(`${API_BASE}/api/customers/${tenantId}/sso`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ provider, enabled, config }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save configuration');
      }
      
      setSuccess('SSO configuration saved successfully!');
      onSave?.();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResults([]);
    
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/api/customers/${tenantId}/sso/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const result = await response.json();
      setTestResults(result.tests || []);
      
    } catch (err) {
      setTestResults([{ name: 'Connection', status: 'failed', error: 'Failed to run tests' }]);
    } finally {
      setTesting(false);
    }
  };

  const handleDisableSSO = async () => {
    if (!confirm('Are you sure you want to disable SSO for this tenant? Users will need to use username/password login.')) {
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/api/customers/${tenantId}/sso`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to disable SSO');
      
      setEnabled(false);
      setSuccess('SSO disabled successfully');
      onSave?.();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable SSO');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const baseUrl = `https://${subdomain}.edsteward.ai`;

  if (loading) {
    return (
      <Card className="max-w-4xl">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-blue-500" />
          <p className="mt-4 text-gray-500">Loading SSO configuration...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            SSO Configuration for {tenantName}
          </CardTitle>
          <CardDescription>
            Configure Single Sign-On for your organization. Supports SAML 2.0 (Okta, Azure AD, Shibboleth), 
            OpenID Connect (Azure AD, Google), and CAS.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">SSO Status</h3>
              <p className="text-sm text-gray-500">
                {enabled ? 'SSO is enabled for this tenant' : 'SSO is disabled'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className={enabled ? 'text-green-600 font-medium' : 'text-gray-500'}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identity Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: 'saml', name: 'SAML 2.0', desc: 'Okta, Azure AD, Shibboleth, PingFederate' },
              { id: 'oidc', name: 'OpenID Connect', desc: 'Azure AD, Google, Auth0, Okta' },
              { id: 'cas', name: 'CAS', desc: 'Central Authentication Service (legacy)' },
            ].map((p) => (
              <div
                key={p.id}
                onClick={() => setProvider(p.id as SSOProvider)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  provider === p.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <h4 className="font-medium">{p.name}</h4>
                <p className="text-sm text-gray-500 mt-1">{p.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Provider-Specific Configuration */}
      {provider === 'saml' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              SAML 2.0 Configuration
            </CardTitle>
            <CardDescription>
              Your SP Metadata URL: 
              <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-sm">
                {baseUrl}/auth/saml/metadata
              </code>
              <button onClick={() => copyToClipboard(`${baseUrl}/auth/saml/metadata`)} className="ml-2 text-blue-500 hover:text-blue-700">
                <Copy className="h-4 w-4 inline" />
              </button>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="saml-entity-id">IdP Entity ID *</Label>
                <Input
                  id="saml-entity-id"
                  value={samlConfig.entityId}
                  onChange={(e) => setSamlConfig({ ...samlConfig, entityId: e.target.value })}
                  placeholder="https://idp.example.com/saml"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saml-sso-url">IdP SSO URL *</Label>
                <Input
                  id="saml-sso-url"
                  value={samlConfig.ssoUrl}
                  onChange={(e) => setSamlConfig({ ...samlConfig, ssoUrl: e.target.value })}
                  placeholder="https://idp.example.com/sso/saml"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="saml-slo-url">IdP Single Logout URL (optional)</Label>
              <Input
                id="saml-slo-url"
                value={samlConfig.sloUrl}
                onChange={(e) => setSamlConfig({ ...samlConfig, sloUrl: e.target.value })}
                placeholder="https://idp.example.com/sso/saml/logout"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="saml-cert">IdP Certificate (PEM format) *</Label>
              <Textarea
                id="saml-cert"
                value={samlConfig.certificate}
                onChange={(e) => setSamlConfig({ ...samlConfig, certificate: e.target.value })}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500">Paste the X.509 certificate from your Identity Provider</p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="eduperson"
                checked={samlConfig.eduPersonEnabled}
                onChange={(e) => setSamlConfig({ ...samlConfig, eduPersonEnabled: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="eduperson" className="cursor-pointer">
                Enable eduPerson attributes (InCommon/Shibboleth)
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      {provider === 'oidc' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              OpenID Connect Configuration
            </CardTitle>
            <CardDescription>
              Your Callback URL: 
              <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-sm">
                {baseUrl}/auth/oidc/callback
              </code>
              <button onClick={() => copyToClipboard(`${baseUrl}/auth/oidc/callback`)} className="ml-2 text-blue-500 hover:text-blue-700">
                <Copy className="h-4 w-4 inline" />
              </button>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provider Preset</Label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'azure-ad', name: 'Azure AD' },
                  { id: 'google', name: 'Google' },
                  { id: 'okta', name: 'Okta' },
                  { id: 'auth0', name: 'Auth0' },
                  { id: 'custom', name: 'Custom' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setOidcConfig({ ...oidcConfig, preset: preset.id as any })}
                    className={`px-3 py-2 text-sm rounded border ${
                      oidcConfig.preset === preset.id 
                        ? 'bg-blue-500 text-white border-blue-500' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="oidc-issuer">Issuer URL / Discovery URL *</Label>
              <Input
                id="oidc-issuer"
                value={oidcConfig.issuerUrl}
                onChange={(e) => setOidcConfig({ ...oidcConfig, issuerUrl: e.target.value })}
                placeholder={
                  oidcConfig.preset === 'azure-ad' 
                    ? 'https://login.microsoftonline.com/{tenant-id}/v2.0'
                    : oidcConfig.preset === 'google'
                    ? 'https://accounts.google.com'
                    : 'https://your-idp.com'
                }
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="oidc-client-id">Client ID *</Label>
                <Input
                  id="oidc-client-id"
                  value={oidcConfig.clientId}
                  onChange={(e) => setOidcConfig({ ...oidcConfig, clientId: e.target.value })}
                  placeholder="your-client-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oidc-client-secret">Client Secret *</Label>
                <Input
                  id="oidc-client-secret"
                  type="password"
                  value={oidcConfig.clientSecret}
                  onChange={(e) => setOidcConfig({ ...oidcConfig, clientSecret: e.target.value })}
                  placeholder="your-client-secret"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="flex flex-wrap gap-2">
                {['openid', 'profile', 'email', 'groups', 'offline_access'].map((scope) => (
                  <label key={scope} className="flex items-center gap-1 px-3 py-1 border rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={oidcConfig.scopes.includes(scope)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setOidcConfig({ ...oidcConfig, scopes: [...oidcConfig.scopes, scope] });
                        } else {
                          setOidcConfig({ ...oidcConfig, scopes: oidcConfig.scopes.filter(s => s !== scope) });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {provider === 'cas' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5" />
              CAS Configuration
            </CardTitle>
            <CardDescription>
              Your Service URL: 
              <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-sm">
                {baseUrl}/auth/cas/callback
              </code>
              <button onClick={() => copyToClipboard(`${baseUrl}/auth/cas/callback`)} className="ml-2 text-blue-500 hover:text-blue-700">
                <Copy className="h-4 w-4 inline" />
              </button>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cas-server">CAS Server URL *</Label>
              <Input
                id="cas-server"
                value={casConfig.serverUrl}
                onChange={(e) => setCasConfig({ ...casConfig, serverUrl: e.target.value })}
                placeholder="https://cas.university.edu/cas"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cas-validate">Service Validate URL (optional)</Label>
                <Input
                  id="cas-validate"
                  value={casConfig.serviceValidateUrl}
                  onChange={(e) => setCasConfig({ ...casConfig, serviceValidateUrl: e.target.value })}
                  placeholder="/serviceValidate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cas-version">CAS Version</Label>
                <select
                  id="cas-version"
                  value={casConfig.version}
                  onChange={(e) => setCasConfig({ ...casConfig, version: e.target.value as '2.0' | '3.0' })}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                >
                  <option value="2.0">CAS 2.0</option>
                  <option value="3.0">CAS 3.0 (with attributes)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Common Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Provisioning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto-provision"
              checked={autoProvisioning}
              onChange={(e) => setAutoProvisioning(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="auto-provision" className="cursor-pointer">
              Automatically create users on first login (Just-In-Time provisioning)
            </Label>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default-role">Default Role for New Users</Label>
              <select
                id="default-role"
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
              >
                <option value="user">User (View Only)</option>
                <option value="compliance_officer">Compliance Officer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="allowed-domains">Allowed Email Domains</Label>
              <Input
                id="allowed-domains"
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
                placeholder="university.edu, school.edu"
              />
              <p className="text-xs text-gray-500">Comma-separated. Leave empty to allow all domains.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuration Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div 
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded ${
                    result.status === 'passed' ? 'bg-green-50' :
                    result.status === 'failed' ? 'bg-red-50' :
                    result.status === 'warning' ? 'bg-yellow-50' :
                    'bg-gray-50'
                  }`}
                >
                  {result.status === 'passed' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  {result.status === 'failed' && <XCircle className="h-5 w-5 text-red-600" />}
                  {result.status === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-600" />}
                  {result.status === 'skipped' && <div className="h-5 w-5 rounded-full border-2 border-gray-300" />}
                  
                  <div className="flex-1">
                    <span className="font-medium">{result.name}</span>
                    {(result.message || result.error) && (
                      <p className="text-sm text-gray-600">{result.message || result.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardFooter className="flex justify-between pt-6">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTest} disabled={testing || !enabled}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Test Configuration
            </Button>
            {enabled && (
              <Button variant="outline" onClick={handleDisableSSO} disabled={saving} className="text-red-600 hover:text-red-700">
                Disable SSO
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
              Save Configuration
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SSOConfiguration;
