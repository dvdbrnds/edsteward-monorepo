/**
 * Multi-Tenant CAS Authentication
 * Supports CAS 2.0 and 3.0 protocols for legacy university systems
 * 
 * This file is ADDITIVE - existing SAML auth continues to work unchanged.
 * New routes: /auth/cas/login, /auth/cas/callback, /auth/cas/logout
 */

import passport from 'passport';
import CasStrategy from 'passport-cas2';
import { Express, Request, Response, NextFunction } from 'express';
import { TenantService } from '../middleware/tenant';
import { getDatabaseStorage } from '../services/database';
import { syslog, LogLevel } from '../services/syslog';

// Extend session type for tenant-aware CAS
declare module 'express-session' {
  interface SessionData {
    casTenantId?: string;
    casReturnTo?: string;
  }
}

// CAS user profile interface
interface CASProfile {
  user?: string;
  attributes?: Record<string, any>;
}

// CAS configuration for a tenant
interface TenantCASConfig {
  serverUrl: string;
  serviceValidateUrl?: string;
  version: '2.0' | '3.0';
  attributeMapping?: Record<string, string>;
}

/**
 * Get CAS configuration for a tenant
 */
async function getTenantCASConfig(tenantId: string, serviceUrl: string): Promise<{
  casURL: string;
  propertyMap: Record<string, string>;
  version: '2.0' | '3.0';
}> {
  const tenant = await TenantService.getTenantById(tenantId);
  
  if (!tenant || !tenant.ssoConfig?.cas) {
    throw new Error(`CAS configuration not found for tenant: ${tenantId}`);
  }

  const casConfig = tenant.ssoConfig.cas;
  
  // Default property mapping for common CAS attributes
  const defaultPropertyMap = {
    id: 'uid',
    givenName: 'givenName',
    familyName: 'sn',
    emails: 'mail',
    displayName: 'displayName',
    department: 'department',
    memberOf: 'memberOf',
  };

  return {
    casURL: casConfig.serverUrl,
    propertyMap: casConfig.attributeMapping || defaultPropertyMap,
    version: casConfig.version || '2.0',
  };
}

/**
 * Extract user attributes from CAS profile based on tenant configuration
 */
function extractCASUserAttributes(username: string, profile: CASProfile, tenant: any): any {
  const defaultMapping = {
    email: 'mail',
    firstName: 'givenName',
    lastName: 'sn',
    displayName: 'displayName',
    department: 'department',
    groups: 'memberOf',
  };

  // Use tenant-specific mapping if available
  const mapping = tenant.ssoConfig?.cas?.attributeMapping || defaultMapping;
  const attrs = profile.attributes || {};
  
  // Try to extract email from various sources
  let email = attrs[mapping.email] || attrs.mail || attrs.email;
  if (Array.isArray(email)) email = email[0];
  // If no email, construct from username if it looks like a domain pattern
  if (!email && username.includes('@')) {
    email = username;
  } else if (!email && tenant.ssoConfig?.allowedDomains?.length > 0) {
    // Construct email from username + domain
    email = `${username}@${tenant.ssoConfig.allowedDomains[0]}`;
  }
  
  let firstName = attrs[mapping.firstName] || attrs.givenName || '';
  let lastName = attrs[mapping.lastName] || attrs.sn || attrs.surname || '';
  
  // If we have displayName but not first/last, try to parse it
  if (!firstName && !lastName && (attrs.displayName || attrs[mapping.displayName])) {
    const displayName = attrs.displayName || attrs[mapping.displayName];
    const parts = displayName.split(' ');
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }
  
  const extractedData = {
    email: email || `${username}@unknown.edu`,
    firstName: Array.isArray(firstName) ? firstName[0] : firstName,
    lastName: Array.isArray(lastName) ? lastName[0] : lastName,
    username: username,
    department: attrs[mapping.department] || attrs.department || '',
    externalId: username,
    identityProvider: 'cas',
    providerId: tenant.id,
    tenantId: tenant.id,
    role: tenant.ssoConfig?.defaultRole || 'user',
    organization: attrs.organization || tenant.name,
  };

  // Role mapping based on groups/memberOf
  const groups = attrs[mapping.groups] || attrs.memberOf || attrs.groups || [];
  const groupList = Array.isArray(groups) ? groups : [groups];
  
  if (groupList.length > 0) {
    const groupsLower = groupList.map((g: string) => (g || '').toLowerCase());
    if (groupsLower.some((g: string) => g.includes('admin'))) {
      extractedData.role = 'admin';
    } else if (groupsLower.some((g: string) => 
      g.includes('compliance') || 
      g.includes('officer') ||
      g.includes('faculty') ||
      g.includes('staff')
    )) {
      extractedData.role = 'compliance_officer';
    }
  }

  return extractedData;
}

/**
 * Setup multi-tenant CAS authentication
 * This is ADDITIVE - does not modify existing auth
 */
export function setupTenantCASAuth(app: Express) {
  
  /**
   * CAS Login initiation
   * Dynamically configures CAS based on tenant
   */
  app.get('/auth/cas/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ensure we have tenant context
      const tenantId = req.tenantId || req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant context required for CAS authentication',
          code: 'TENANT_REQUIRED'
        });
      }

      const tenant = await TenantService.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Store tenant and return URL in session
      if (req.session) {
        req.session.casTenantId = tenantId;
        req.session.casReturnTo = req.query.returnTo as string || '/dashboard';
      }

      // Get tenant's CAS configuration
      const baseUrl = `https://${tenant.subdomain}.${process.env.BASE_DOMAIN || 'edsteward.ai'}`;
      const serviceUrl = `${baseUrl}/auth/cas/callback`;
      const casConfig = await getTenantCASConfig(tenantId, serviceUrl);
      
      // Create a tenant-specific CAS strategy
      const strategy = new CasStrategy(
        {
          casURL: casConfig.casURL,
          passReqToCallback: true,
          propertyMap: casConfig.propertyMap,
        },
        async (
          req: Request,
          username: string,
          profile: CASProfile,
          done: (err: any, user?: any, info?: any) => void
        ) => {
          try {
            const storedTenantId = req.session?.casTenantId;
            if (!storedTenantId) {
              throw new Error('Tenant context lost during CAS authentication');
            }

            const currentTenant = await TenantService.getTenantById(storedTenantId);
            if (!currentTenant) {
              throw new Error(`Tenant not found: ${storedTenantId}`);
            }

            const userData = extractCASUserAttributes(username, profile, currentTenant);
            
            // Verify user belongs to this tenant (domain validation)
            if (userData.email && currentTenant.ssoConfig?.allowedDomains?.length > 0) {
              const emailDomain = userData.email.split('@')[1];
              if (!currentTenant.ssoConfig.allowedDomains.includes(emailDomain)) {
                throw new Error(`User domain ${emailDomain} not allowed for tenant ${currentTenant.name}`);
              }
            }
            
            // CRITICAL: Use tenant-specific storage for database isolation
            const tenantStorage = getDatabaseStorage(storedTenantId);
            
            // Check if user exists in this tenant
            let user = await tenantStorage.getUserByExternalId(userData.externalId, storedTenantId);
            if (!user && userData.email) {
              user = await tenantStorage.getUserByEmail(userData.email, storedTenantId);
            }
            if (!user) {
              user = await tenantStorage.getUserByUsername(userData.username, storedTenantId);
            }

            if (user) {
              // Update existing user
              await tenantStorage.updateUser(user.id, {
                lastLogin: new Date(),
                identityProvider: userData.identityProvider,
                providerId: userData.providerId,
                firstName: userData.firstName || user.firstName,
                lastName: userData.lastName || user.lastName,
              }, storedTenantId);
              
              await syslog.logAuthEvent(
                LogLevel.INFO, 
                `Tenant CAS login successful for ${currentTenant.name}`, 
                user.id, 
                user.username,
                { tenantId: storedTenantId, provider: 'cas' }
              );
              return done(null, user);
            } else if (currentTenant.ssoConfig?.autoProvisioning) {
              // Create new user for this tenant
              const newUser = await tenantStorage.createUser({
                ...userData,
                lastLogin: new Date()
              }, storedTenantId);
              
              await syslog.logAuthEvent(
                LogLevel.INFO, 
                `New tenant CAS user created for ${currentTenant.name}`, 
                newUser.id, 
                newUser.username,
                { tenantId: storedTenantId, provider: 'cas' }
              );
              return done(null, newUser);
            } else {
              throw new Error(`Auto-provisioning disabled for tenant ${currentTenant.name}. Contact administrator.`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await syslog.logAuthEvent(
              LogLevel.ERROR, 
              `Tenant CAS authentication error: ${errorMessage}`, 
              undefined, 
              username,
              { tenantId: req.session?.casTenantId, provider: 'cas' }
            );
            return done(error instanceof Error ? error : new Error(errorMessage));
          }
        }
      );

      // Register the strategy with a tenant-specific name
      passport.use(`cas-${tenantId}`, strategy);
      
      // Authenticate
      passport.authenticate(`cas-${tenantId}`, {
        failureRedirect: '/login?error=cas_auth_failed',
      })(req, res, next);

    } catch (error) {
      console.error('CAS login initiation error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.redirect(`/login?error=cas_config_error&message=${encodeURIComponent(message)}`);
    }
  });

  /**
   * CAS Callback handler
   * CAS redirects back here with a ticket
   */
  app.get('/auth/cas/callback', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get tenant from session
      const tenantId = req.session?.casTenantId;
      if (!tenantId) {
        return res.redirect('/login?error=cas_session_lost');
      }

      // Check if we have a ticket
      if (!req.query.ticket) {
        return res.redirect('/login?error=cas_no_ticket');
      }

      // Use the same strategy that was configured during login
      const strategyName = `cas-${tenantId}`;
      
      passport.authenticate(strategyName, {
        failureRedirect: '/login?error=cas_auth_failed',
      })(req, res, (err: any) => {
        if (err) {
          console.error('CAS callback error:', err);
          return res.redirect(`/login?error=cas_error&message=${encodeURIComponent(err.message)}`);
        }

        // Successful authentication
        const redirectTo = req.session?.casReturnTo || '/dashboard';
        
        // Clean up session
        delete req.session?.casTenantId;
        delete req.session?.casReturnTo;
        
        // Unregister temporary strategy
        try {
          passport.unuse(strategyName);
        } catch (e) {
          // Strategy may already be unregistered
        }
        
        res.redirect(redirectTo);
      });

    } catch (error) {
      console.error('CAS callback error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.redirect(`/login?error=cas_callback_error&message=${encodeURIComponent(message)}`);
    }
  });

  /**
   * CAS Logout - Single Sign-Out
   */
  app.get('/auth/cas/logout', async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId || req.tenant?.id;
      if (!tenantId) {
        return res.redirect('/');
      }

      const tenant = await TenantService.getTenantById(tenantId);
      if (!tenant || !tenant.ssoConfig?.cas) {
        // No CAS config, just do local logout
        req.logout(() => {
          res.redirect('/');
        });
        return;
      }

      // Get CAS server URL for logout
      const casConfig = tenant.ssoConfig.cas;
      const baseUrl = `https://${tenant.subdomain}.${process.env.BASE_DOMAIN || 'edsteward.ai'}`;
      
      // Log out locally first
      req.logout(() => {
        // Redirect to CAS logout with service URL to return to
        const logoutUrl = `${casConfig.serverUrl}/logout?service=${encodeURIComponent(baseUrl)}`;
        res.redirect(logoutUrl);
      });

    } catch (error) {
      console.error('CAS logout error:', error);
      req.logout(() => {
        res.redirect('/');
      });
    }
  });

  /**
   * CAS Discovery endpoint - helps IT admins configure their CAS server
   */
  app.get('/auth/cas/discovery', async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId || req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant context required',
          code: 'TENANT_REQUIRED'
        });
      }

      const tenant = await TenantService.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const baseUrl = `https://${tenant.subdomain}.${process.env.BASE_DOMAIN || 'edsteward.ai'}`;
      
      res.json({
        tenant: tenant.name,
        serviceUrl: `${baseUrl}/auth/cas/callback`,
        supportedVersions: ['2.0', '3.0'],
        requiredAttributes: ['uid', 'mail'],
        optionalAttributes: ['givenName', 'sn', 'displayName', 'department', 'memberOf'],
        attributeMapping: {
          uid: 'Username/NetID (required)',
          mail: 'Email address (required)',
          givenName: 'First name',
          sn: 'Last name (surname)',
          displayName: 'Full display name',
          department: 'Department',
          memberOf: 'Group membership (for role mapping)',
        },
        notes: [
          'CAS server must return user attributes via serviceValidate response',
          'For CAS 2.0, ensure SAML validation is enabled if attribute release is needed',
          'For CAS 3.0, attributes are returned in the standard response',
          'Group/memberOf attribute is used for automatic role assignment',
        ],
      });
    } catch (error) {
      console.error('CAS discovery error:', error);
      res.status(500).json({ error: 'Failed to generate discovery info' });
    }
  });

  console.log('✅ Tenant CAS authentication routes configured');
  console.log('   Routes: /auth/cas/login, /auth/cas/callback, /auth/cas/logout, /auth/cas/discovery');
}

export default {
  setupTenantCASAuth,
};
