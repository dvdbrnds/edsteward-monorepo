/**
 * Unified SSO Authentication Router
 * 
 * Provides a single entry point for SSO authentication that routes to the
 * correct provider (SAML, OIDC, CAS) based on tenant configuration.
 * 
 * Routes:
 *   /auth/sso/login    - Initiates SSO based on tenant's configured provider
 *   /auth/sso/logout   - Logs out from SSO provider
 *   /auth/sso/info     - Returns SSO configuration info for the tenant
 * 
 * This is ADDITIVE - existing direct routes (/auth/saml/*, /auth/oidc/*, /auth/cas/*)
 * continue to work for backward compatibility.
 */

import { Express, Request, Response, NextFunction } from 'express';
import { TenantService } from '../middleware/tenant';

// Import individual auth setup functions
import { setupTenantSamlAuth } from './tenant-saml';
import { setupTenantOIDCAuth } from './tenant-oidc';
import { setupTenantCASAuth } from './tenant-cas';

// SSO Provider types
export type SSOProviderType = 'saml' | 'oidc' | 'cas' | 'local';

/**
 * Get the SSO provider type for a tenant
 */
async function getTenantSSOProvider(tenantId: string): Promise<{
  provider: SSOProviderType;
  enabled: boolean;
  config: any;
}> {
  const tenant = await TenantService.getTenantById(tenantId);
  
  if (!tenant) {
    return { provider: 'local', enabled: false, config: null };
  }

  // Check new ssoConfig structure first
  if (tenant.ssoConfig?.provider) {
    return {
      provider: tenant.ssoConfig.provider as SSOProviderType,
      enabled: true,
      config: tenant.ssoConfig,
    };
  }

  // Fall back to legacy samlConfig
  if (tenant.samlConfig && tenant.samlConfig.ssoUrl) {
    return {
      provider: 'saml',
      enabled: true,
      config: tenant.samlConfig,
    };
  }

  // Default to local authentication
  return { provider: 'local', enabled: false, config: null };
}

/**
 * Setup unified SSO router
 * This sets up all individual auth strategies and provides unified routing
 */
export function setupUnifiedSSOAuth(app: Express) {
  // Setup individual auth strategies (these add their own direct routes)
  setupTenantSamlAuth(app);
  setupTenantOIDCAuth(app);
  setupTenantCASAuth(app);

  /**
   * Unified SSO Login
   * Automatically routes to the correct provider based on tenant configuration
   */
  app.get('/auth/sso/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ensure we have tenant context
      const tenantId = req.tenantId || req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant context required for SSO authentication',
          code: 'TENANT_REQUIRED',
          hint: 'Access the application via your organization\'s subdomain'
        });
      }

      // Get tenant's SSO provider
      const { provider, enabled, config } = await getTenantSSOProvider(tenantId);

      if (!enabled) {
        return res.status(400).json({
          error: 'SSO not configured for this tenant',
          code: 'SSO_NOT_CONFIGURED',
          hint: 'Contact your administrator to configure SSO, or use username/password login'
        });
      }

      // Build return URL
      const returnTo = req.query.returnTo as string || '/dashboard';

      // Route to appropriate provider
      switch (provider) {
        case 'saml':
          return res.redirect(`/auth/saml/login?returnTo=${encodeURIComponent(returnTo)}`);
        
        case 'oidc':
          return res.redirect(`/auth/oidc/login?returnTo=${encodeURIComponent(returnTo)}`);
        
        case 'cas':
          return res.redirect(`/auth/cas/login?returnTo=${encodeURIComponent(returnTo)}`);
        
        case 'local':
        default:
          return res.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      }

    } catch (error) {
      console.error('SSO login routing error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.redirect(`/login?error=sso_error&message=${encodeURIComponent(message)}`);
    }
  });

  /**
   * Unified SSO Logout
   * Logs out from the appropriate provider
   */
  app.get('/auth/sso/logout', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId || req.tenant?.id;
      
      if (!tenantId) {
        // No tenant context, just do local logout
        req.logout((err) => {
          if (err) console.error('Logout error:', err);
          res.redirect('/');
        });
        return;
      }

      const { provider, enabled } = await getTenantSSOProvider(tenantId);

      // Route to appropriate logout endpoint
      if (enabled) {
        switch (provider) {
          case 'saml':
            return res.redirect('/auth/saml/logout');
          case 'oidc':
            // OIDC typically just needs local logout (IdP manages its own session)
            req.logout((err) => {
              if (err) console.error('Logout error:', err);
              res.redirect('/');
            });
            return;
          case 'cas':
            return res.redirect('/auth/cas/logout');
        }
      }

      // Default: local logout
      req.logout((err) => {
        if (err) console.error('Logout error:', err);
        res.redirect('/');
      });

    } catch (error) {
      console.error('SSO logout error:', error);
      req.logout((err) => {
        if (err) console.error('Logout error:', err);
        res.redirect('/');
      });
    }
  });

  /**
   * SSO Configuration Info
   * Returns information about the tenant's SSO configuration
   * Useful for the login page to show appropriate options
   */
  app.get('/auth/sso/info', async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId || req.tenant?.id;
      
      if (!tenantId) {
        return res.json({
          ssoEnabled: false,
          provider: null,
          localLoginEnabled: true,
          message: 'No tenant context'
        });
      }

      const tenant = await TenantService.getTenantById(tenantId);
      if (!tenant) {
        return res.json({
          ssoEnabled: false,
          provider: null,
          localLoginEnabled: true,
          message: 'Tenant not found'
        });
      }

      const { provider, enabled, config } = await getTenantSSOProvider(tenantId);
      
      // Determine if local login is also enabled
      const localLoginEnabled = tenant.settings?.enableLocalAuth !== false;
      
      res.json({
        tenant: tenant.name,
        ssoEnabled: enabled,
        provider: enabled ? provider : null,
        providerName: enabled ? getProviderDisplayName(provider, config) : null,
        localLoginEnabled,
        ssoLoginUrl: enabled ? '/auth/sso/login' : null,
        // For SAML, include metadata URL for IT admins
        metadataUrl: enabled && provider === 'saml' ? '/auth/saml/metadata' : null,
        // Discovery URLs for IT admins
        discoveryUrls: enabled ? {
          saml: provider === 'saml' ? '/auth/saml/metadata' : null,
          oidc: provider === 'oidc' ? '/auth/oidc/discovery' : null,
          cas: provider === 'cas' ? '/auth/cas/discovery' : null,
        } : null,
      });

    } catch (error) {
      console.error('SSO info error:', error);
      res.status(500).json({
        error: 'Failed to get SSO information',
        ssoEnabled: false,
        localLoginEnabled: true
      });
    }
  });

  /**
   * SSO Status endpoint
   * Quick check if SSO is configured (for login page logic)
   */
  app.get('/auth/sso/status', async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId || req.tenant?.id;
      
      if (!tenantId) {
        return res.json({ ssoEnabled: false });
      }

      const { enabled, provider } = await getTenantSSOProvider(tenantId);
      
      res.json({
        ssoEnabled: enabled,
        provider: enabled ? provider : null,
      });

    } catch (error) {
      res.json({ ssoEnabled: false });
    }
  });

  console.log('✅ Unified SSO authentication router configured');
  console.log('   Routes: /auth/sso/login, /auth/sso/logout, /auth/sso/info, /auth/sso/status');
}

/**
 * Get human-readable provider name
 */
function getProviderDisplayName(provider: SSOProviderType, config: any): string {
  if (provider === 'oidc' && config?.oidc?.preset) {
    const presets: Record<string, string> = {
      'azure-ad': 'Microsoft Entra ID (Azure AD)',
      'google': 'Google Workspace',
      'okta': 'Okta',
      'auth0': 'Auth0',
      'custom': 'OpenID Connect',
    };
    return presets[config.oidc.preset] || 'OpenID Connect';
  }

  const names: Record<SSOProviderType, string> = {
    'saml': 'SAML 2.0 Single Sign-On',
    'oidc': 'OpenID Connect',
    'cas': 'CAS (Central Authentication Service)',
    'local': 'Local Authentication',
  };

  return names[provider] || provider;
}

export default {
  setupUnifiedSSOAuth,
  getTenantSSOProvider,
};
