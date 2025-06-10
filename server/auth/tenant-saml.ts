import passport from 'passport';
import { MultiSamlStrategy } from '@node-saml/passport-saml';
import { Express, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { TenantService, extractTenantFromSAML } from '../middleware/tenant';
import { syslog, LogLevel } from '../services/syslog';

// Extend session type for tenant-aware SAML
declare module 'express-session' {
  interface SessionData {
    returnTo?: string;
    tenantId?: string;
    samlRequestId?: string;
  }
}

// SAML user profile interface
interface SamlProfile {
  nameID?: string;
  nameIDFormat?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  groups?: string[];
  department?: string;
  organization?: string;
  issuer?: string;
  [key: string]: any;
}

// Dynamic SAML configuration based on tenant
async function getTenantSamlConfig(tenantId: string, req: Request) {
  const tenant = await TenantService.getTenantById(tenantId);
  
  if (!tenant || !tenant.samlConfig) {
    throw new Error(`SAML configuration not found for tenant: ${tenantId}`);
  }

  const baseUrl = `https://${tenant.subdomain}.${process.env.BASE_DOMAIN || 'edsteward.ai'}`;
  
  return {
    callbackUrl: `${baseUrl}/auth/saml/callback`,
    entryPoint: tenant.samlConfig.ssoUrl,
    issuer: `urn:regulatorytrackr:sp:${tenant.id}`,
    idpCert: tenant.samlConfig.certificate,
    logoutUrl: tenant.samlConfig.sloUrl || tenant.samlConfig.ssoUrl,
    identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    signatureAlgorithm: 'sha256' as const,
    digestAlgorithm: 'sha256' as const,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    disableRequestedAuthnContext: false,
    // Tenant-specific metadata
    providerName: `RegulatoryTrackr - ${tenant.name}`,
    additionalParams: {
      RelayState: tenant.id
    }
  };
}

// Extract and map user attributes based on tenant configuration
function extractTenantUserAttributes(profile: SamlProfile, tenant: any): any {
  const defaultMapping = {
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    username: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    department: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/department',
    groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
  };

  // Use tenant-specific mapping if available
  const mapping = tenant.samlConfig?.attributeMapping || defaultMapping;
  
  const extractedData = {
    email: profile.email || profile[mapping.email] || profile.nameID,
    firstName: profile.firstName || profile[mapping.firstName] || '',
    lastName: profile.lastName || profile[mapping.lastName] || '',
    username: profile.username || profile[mapping.username] || profile.nameID,
    department: profile.department || profile[mapping.department] || '',
    externalId: profile.nameID,
    identityProvider: 'saml',
    providerId: tenant.id,
    tenantId: tenant.id,
    role: tenant.settings.defaultRole || 'user',
    organization: profile.organization || tenant.name
  };

  // Role mapping based on groups or attributes
  const groups = profile[mapping.groups] || profile.groups || [];
  if (Array.isArray(groups)) {
    if (groups.some(group => group.toLowerCase().includes('admin'))) {
      extractedData.role = 'admin';
    } else if (groups.some(group => 
      group.toLowerCase().includes('compliance') || 
      group.toLowerCase().includes('officer') ||
      group.toLowerCase().includes('faculty') ||
      group.toLowerCase().includes('staff')
    )) {
      extractedData.role = 'compliance_officer';
    }
  }

  return extractedData;
}

// Multi-tenant SAML strategy setup
export function setupTenantSamlAuth(app: Express) {
  // Configure MultiSamlStrategy with tenant-aware configuration
  passport.use('tenant-saml', new MultiSamlStrategy(
    {
      passReqToCallback: true,
      getSamlOptions: async (request, done) => {
        try {
          // Get tenant from request context or SAML RelayState
          let tenantId = request.tenantId || request.session?.tenantId;
          
          if (!tenantId) {
            // Try to extract from query/body (RelayState)
            tenantId = request.query.RelayState as string || request.body.RelayState;
          }

          if (!tenantId) {
            // Try to identify tenant from request
            const tenantInfo = TenantService.extractTenantFromRequest(request);
            if (tenantInfo.subdomain) {
              const tenant = await TenantService.getTenantBySubdomain(tenantInfo.subdomain);
              tenantId = tenant?.id;
            }
          }

          if (!tenantId) {
            return done(new Error('Cannot identify tenant for SAML authentication'));
          }

          // Store tenant ID in session for callback
          if (request.session) {
            request.session.tenantId = tenantId;
          }

          const samlConfig = await getTenantSamlConfig(tenantId, request);
          done(null, samlConfig);
        } catch (error) {
          done(error instanceof Error ? error : new Error('Error configuring SAML'));
        }
      }
    },
    // Sign-on verify callback
    async (req, profile: SamlProfile, done) => {
      try {
        const tenantId = req.session?.tenantId || req.tenantId;
        
        if (!tenantId) {
          throw new Error('Tenant context lost during SAML authentication');
        }

        const tenant = await TenantService.getTenantById(tenantId);
        if (!tenant) {
          throw new Error(`Tenant not found: ${tenantId}`);
        }

        // Verify user belongs to this tenant (domain validation)
        const userEmail = profile.email || profile.nameID;
        if (userEmail && tenant.settings.allowedDomains.length > 0) {
          const emailDomain = userEmail.split('@')[1];
          if (!tenant.settings.allowedDomains.includes(emailDomain)) {
            throw new Error(`User domain ${emailDomain} not allowed for tenant ${tenant.name}`);
          }
        }

        const userData = extractTenantUserAttributes(profile, tenant);
        
        // Check if user exists in this tenant
        let user = await storage.getUserByExternalId(userData.externalId, tenantId);
        if (!user && userData.email) {
          user = await storage.getUserByEmail(userData.email, tenantId);
        }

        if (user) {
          // Update existing user
          await storage.updateUser(user.id, {
            lastLogin: new Date(),
            identityProvider: userData.identityProvider,
            providerId: userData.providerId
          }, tenantId);
          
          await syslog.logAuthEvent(
            LogLevel.INFO, 
            `Tenant SAML login successful for ${tenant.name}`, 
            user.id, 
            user.username,
            { tenantId }
          );
          return done(null, user);
        } else if (tenant.settings.enableAutoProvisioning) {
          // Create new user for this tenant
          const newUser = await storage.createUser({
            ...userData,
            lastLogin: new Date()
          }, tenantId);
          
          await syslog.logAuthEvent(
            LogLevel.INFO, 
            `New tenant SAML user created for ${tenant.name}`, 
            newUser.id, 
            newUser.username,
            { tenantId }
          );
          return done(null, newUser);
        } else {
          throw new Error(`Auto-provisioning disabled for tenant ${tenant.name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await syslog.logAuthEvent(
          LogLevel.ERROR, 
          `Tenant SAML authentication error: ${errorMessage}`, 
          undefined, 
          profile.nameID,
          { tenantId: req.tenantId }
        );
        return done(error instanceof Error ? error : new Error(errorMessage));
      }
    },
    // Logout verify callback
    async (req, profile: SamlProfile, done) => {
      try {
        const tenantId = req.session?.tenantId || req.tenantId;
        if (tenantId) {
          const user = await storage.getUserByExternalId(profile.nameID || '', tenantId);
          if (user) {
            await syslog.logAuthEvent(
              LogLevel.INFO, 
              'Tenant SAML logout successful', 
              user.id, 
              user.username,
              { tenantId }
            );
          }
          return done(null, user);
        }
        return done(null, null);
      } catch (error) {
        return done(error instanceof Error ? error : new Error('Logout error'));
      }
    }
  ));

  // Tenant-aware SAML routes

  // Initiate SAML authentication for tenant
  app.get('/auth/saml/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ensure we have tenant context
      if (!req.tenantId && !req.tenant) {
        return res.status(400).json({
          error: 'Tenant context required for SAML authentication',
          code: 'TENANT_REQUIRED'
        });
      }

      // Store return URL in session
      if (req.query.returnTo && req.session) {
        req.session.returnTo = req.query.returnTo as string;
      }

      passport.authenticate('tenant-saml', {
        failureRedirect: '/login?error=saml_error'
      })(req, res, next);
    } catch (error) {
      console.error('SAML login initiation error:', error);
      res.status(500).json({ error: 'SAML authentication failed' });
    }
  });

  // SAML callback handler
  app.post('/auth/saml/callback', 
    passport.authenticate('tenant-saml', {
      failureRedirect: '/login?error=saml_callback_failed'
    }), 
    (req: Request, res: Response) => {
      // Successful authentication
      const redirectTo = req.session?.returnTo || '/dashboard';
      delete req.session?.returnTo;
      delete req.session?.tenantId; // Clean up session
      
      res.redirect(redirectTo);
    }
  );

  // Tenant-specific metadata endpoint
  app.get('/auth/saml/metadata', async (req: Request, res: Response) => {
    try {
      if (!req.tenantId && !req.tenant) {
        return res.status(400).json({
          error: 'Tenant context required',
          code: 'TENANT_REQUIRED'
        });
      }

      const tenantId = req.tenantId || req.tenant?.id;
      const tenant = await TenantService.getTenantById(tenantId!);
      
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const metadata = generateTenantServiceProviderMetadata(tenant);
      
      res.type('application/xml');
      res.status(200).send(metadata);
    } catch (error) {
      console.error('Error generating tenant metadata:', error);
      res.status(500).send('Error generating metadata');
    }
  });

  // SAML logout
  app.get('/auth/saml/logout', (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.redirect('/');
    }

    req.logout((err) => {
      if (err) {
        return next(err);
      }
      res.redirect('/');
    });
  });
}

// Generate tenant-specific service provider metadata
function generateTenantServiceProviderMetadata(tenant: any): string {
  const spEntityId = `urn:regulatorytrackr:sp:${tenant.id}`;
  const baseUrl = `https://${tenant.subdomain}.${process.env.BASE_DOMAIN || 'edsteward.ai'}`;
  const callbackUrl = `${baseUrl}/auth/saml/callback`;
  const sloUrl = `${baseUrl}/auth/saml/logout`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${spEntityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
                      WantAssertionsSigned="true"
                      AuthnRequestsSigned="false">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                 Location="${callbackUrl}"
                                 index="0"
                                 isDefault="true"/>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                           Location="${sloUrl}"/>
    <md:AttributeConsumingService index="1" isDefault="true">
      <md:ServiceName xml:lang="en">RegulatoryTrackr - ${tenant.name}</md:ServiceName>
      <md:ServiceDescription xml:lang="en">Regulatory Compliance Tracking System for ${tenant.name}</md:ServiceDescription>
      <md:RequestedAttribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="email" isRequired="true"/>
      <md:RequestedAttribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="firstName" isRequired="true"/>
      <md:RequestedAttribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="lastName" isRequired="true"/>
      <md:RequestedAttribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/department" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="department" isRequired="false"/>
      <md:RequestedAttribute Name="http://schemas.microsoft.com/ws/2008/06/identity/claims/groups" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="groups" isRequired="false"/>
    </md:AttributeConsumingService>
  </md:SPSSODescriptor>
  <md:Organization>
    <md:OrganizationName xml:lang="en">${tenant.name}</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">${tenant.name}</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">${baseUrl}</md:OrganizationURL>
  </md:Organization>
  <md:ContactPerson contactType="technical">
    <md:EmailAddress>support@edsteward.ai</md:EmailAddress>
  </md:ContactPerson>
</md:EntityDescriptor>`;
}

export default {
  setupTenantSamlAuth,
  generateTenantServiceProviderMetadata
}; 