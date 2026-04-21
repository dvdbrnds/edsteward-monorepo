import passport from 'passport';
import { MultiSamlStrategy } from '@node-saml/passport-saml';
import { Express, Request, Response, NextFunction } from 'express';
import { TenantService, extractTenantFromSAML } from '../middleware/tenant';
import { getDatabaseStorage } from '../services/database';
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
  // eduPerson attributes (InCommon/Shibboleth)
  eduPersonPrincipalName?: string;        // ePPN - unique identifier
  eduPersonAffiliation?: string[];        // faculty, staff, student, etc.
  eduPersonScopedAffiliation?: string[];  // affiliation@scope
  eduPersonEntitlement?: string[];        // authorization entitlements
  eduPersonTargetedID?: string;           // privacy-preserving identifier
  eduPersonOrgDN?: string;                // organization DN
  eduPersonOrgUnitDN?: string;            // organizational unit DN
  eduPersonPrimaryAffiliation?: string;   // primary affiliation
  displayName?: string;
  givenName?: string;
  sn?: string;                            // surname
  cn?: string;                            // common name
  uid?: string;
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
    issuer: `urn:edsteward:sp:${tenant.id}`,
    idpCert: tenant.samlConfig.certificate,
    logoutUrl: tenant.samlConfig.sloUrl || tenant.samlConfig.ssoUrl,
    identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    signatureAlgorithm: 'sha256' as const,
    digestAlgorithm: 'sha256' as const,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    disableRequestedAuthnContext: false,
    // Tenant-specific metadata
    providerName: `EdSteward - ${tenant.name}`,
    additionalParams: {
      RelayState: tenant.id
    }
  };
}

// eduPerson attribute URIs (InCommon/Shibboleth standard)
const EDUPERSON_ATTRIBUTES = {
  eduPersonPrincipalName: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6',
  eduPersonAffiliation: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.1',
  eduPersonScopedAffiliation: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.9',
  eduPersonEntitlement: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.7',
  eduPersonTargetedID: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.10',
  eduPersonPrimaryAffiliation: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.5',
  eduPersonOrgDN: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.3',
  eduPersonOrgUnitDN: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.4',
  // Common LDAP attributes used with Shibboleth
  mail: 'urn:oid:0.9.2342.19200300.100.1.3',
  givenName: 'urn:oid:2.5.4.42',
  sn: 'urn:oid:2.5.4.4',  // surname
  cn: 'urn:oid:2.5.4.3',  // common name
  displayName: 'urn:oid:2.16.840.1.113730.3.1.241',
  uid: 'urn:oid:0.9.2342.19200300.100.1.1',
  o: 'urn:oid:2.5.4.10',  // organization
  ou: 'urn:oid:2.5.4.11', // organizational unit
};

// Extract and map user attributes based on tenant configuration
// Supports: Microsoft/Azure AD claims, Okta, Shibboleth/InCommon eduPerson
function extractTenantUserAttributes(profile: SamlProfile, tenant: any): any {
  // Check if eduPerson mode is enabled (for InCommon/Shibboleth)
  const eduPersonEnabled = tenant.ssoConfig?.saml?.eduPersonEnabled || tenant.samlConfig?.eduPersonEnabled;
  
  // Default mapping for Microsoft/Azure AD style claims
  const defaultMapping = {
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    username: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    department: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/department',
    groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
  };

  // eduPerson/Shibboleth mapping
  const eduPersonMapping = {
    email: EDUPERSON_ATTRIBUTES.mail,
    firstName: EDUPERSON_ATTRIBUTES.givenName,
    lastName: EDUPERSON_ATTRIBUTES.sn,
    username: EDUPERSON_ATTRIBUTES.eduPersonPrincipalName,
    department: EDUPERSON_ATTRIBUTES.ou,
    groups: EDUPERSON_ATTRIBUTES.eduPersonAffiliation,
    entitlements: EDUPERSON_ATTRIBUTES.eduPersonEntitlement,
  };

  // Use tenant-specific mapping, or auto-detect based on available attributes
  let mapping = tenant.samlConfig?.attributeMapping || tenant.ssoConfig?.saml?.attributeMapping;
  
  // Auto-detect eduPerson attributes if not explicitly configured
  if (!mapping) {
    const hasEduPerson = profile.eduPersonPrincipalName || 
                         profile[EDUPERSON_ATTRIBUTES.eduPersonPrincipalName] ||
                         profile.eduPersonAffiliation ||
                         profile[EDUPERSON_ATTRIBUTES.eduPersonAffiliation];
    
    mapping = (eduPersonEnabled || hasEduPerson) ? eduPersonMapping : defaultMapping;
  }
  
  // Helper to get attribute value from profile (handles OID and friendly name)
  const getAttr = (attrName: string, oidUri?: string): any => {
    // Try direct property name first
    if (profile[attrName] !== undefined) return profile[attrName];
    // Try OID URI
    if (oidUri && profile[oidUri] !== undefined) return profile[oidUri];
    // Try from mapping
    if (mapping[attrName] && profile[mapping[attrName]] !== undefined) {
      return profile[mapping[attrName]];
    }
    return undefined;
  };

  // Extract email - try multiple sources
  let email = getAttr('email', EDUPERSON_ATTRIBUTES.mail) ||
              profile.email ||
              profile.mail ||
              profile[defaultMapping.email] ||
              profile[eduPersonMapping.email];
  
  // For eduPerson, email might be in eduPersonPrincipalName
  if (!email && profile.eduPersonPrincipalName) {
    email = profile.eduPersonPrincipalName;
  }
  if (!email && profile[EDUPERSON_ATTRIBUTES.eduPersonPrincipalName]) {
    email = profile[EDUPERSON_ATTRIBUTES.eduPersonPrincipalName];
  }
  // Fallback to nameID if it looks like an email
  if (!email && profile.nameID && profile.nameID.includes('@')) {
    email = profile.nameID;
  }

  // Extract name
  let firstName = getAttr('firstName', EDUPERSON_ATTRIBUTES.givenName) ||
                  profile.firstName ||
                  profile.givenName ||
                  profile[defaultMapping.firstName] ||
                  '';
  
  let lastName = getAttr('lastName', EDUPERSON_ATTRIBUTES.sn) ||
                 profile.lastName ||
                 profile.sn ||
                 profile[defaultMapping.lastName] ||
                 '';

  // If no first/last name but have displayName, try to parse it
  if (!firstName && !lastName) {
    const displayName = profile.displayName || 
                        profile[EDUPERSON_ATTRIBUTES.displayName] ||
                        profile.cn ||
                        profile[EDUPERSON_ATTRIBUTES.cn];
    if (displayName) {
      const parts = displayName.split(' ');
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
  }

  // Extract username
  let username = getAttr('username', EDUPERSON_ATTRIBUTES.eduPersonPrincipalName) ||
                 profile.username ||
                 profile.uid ||
                 profile[EDUPERSON_ATTRIBUTES.uid] ||
                 profile.eduPersonPrincipalName ||
                 profile[EDUPERSON_ATTRIBUTES.eduPersonPrincipalName] ||
                 email ||
                 profile.nameID;

  // Extract external ID (use targeted ID for privacy-preserving identifier)
  const externalId = profile.eduPersonTargetedID ||
                     profile[EDUPERSON_ATTRIBUTES.eduPersonTargetedID] ||
                     profile.nameID;
  
  const extractedData = {
    email: email || profile.nameID,
    firstName: Array.isArray(firstName) ? firstName[0] : firstName,
    lastName: Array.isArray(lastName) ? lastName[0] : lastName,
    username: Array.isArray(username) ? username[0] : username,
    department: getAttr('department', EDUPERSON_ATTRIBUTES.ou) ||
                profile.department ||
                profile[defaultMapping.department] ||
                '',
    externalId: externalId,
    identityProvider: 'saml',
    providerId: tenant.id,
    tenantId: tenant.id,
    role: tenant.settings?.defaultRole || tenant.ssoConfig?.defaultRole || 'user',
    organization: profile.organization || 
                  profile[EDUPERSON_ATTRIBUTES.o] ||
                  tenant.name,
    // Store eduPerson metadata for reference
    eduPersonAffiliation: profile.eduPersonAffiliation ||
                          profile[EDUPERSON_ATTRIBUTES.eduPersonAffiliation],
    eduPersonEntitlement: profile.eduPersonEntitlement ||
                          profile[EDUPERSON_ATTRIBUTES.eduPersonEntitlement],
  };

  // Role mapping based on groups, affiliations, or entitlements
  const groups = profile[mapping.groups] || profile.groups || [];
  const affiliations = profile.eduPersonAffiliation || 
                       profile[EDUPERSON_ATTRIBUTES.eduPersonAffiliation] ||
                       profile.eduPersonScopedAffiliation ||
                       profile[EDUPERSON_ATTRIBUTES.eduPersonScopedAffiliation] ||
                       [];
  const entitlements = profile.eduPersonEntitlement ||
                       profile[EDUPERSON_ATTRIBUTES.eduPersonEntitlement] ||
                       [];

  // Combine all sources for role determination
  const allRoleIndicators = [
    ...(Array.isArray(groups) ? groups : [groups]),
    ...(Array.isArray(affiliations) ? affiliations : [affiliations]),
    ...(Array.isArray(entitlements) ? entitlements : [entitlements]),
  ].filter(Boolean).map(s => (s || '').toLowerCase());

  if (allRoleIndicators.length > 0) {
    // Admin role detection
    if (allRoleIndicators.some(indicator => 
      indicator.includes('admin') ||
      indicator.includes('administrator') ||
      indicator.includes('superuser')
    )) {
      extractedData.role = 'admin';
    } 
    // Compliance officer role detection
    else if (allRoleIndicators.some(indicator => 
      indicator.includes('compliance') || 
      indicator.includes('officer') ||
      indicator.includes('faculty') ||
      indicator.includes('staff') ||
      indicator.includes('employee')
    )) {
      extractedData.role = 'compliance_officer';
    }
    // Student/viewer role (lower privilege)
    else if (allRoleIndicators.some(indicator =>
      indicator.includes('student') ||
      indicator.includes('alum')
    )) {
      extractedData.role = 'viewer';
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
    async (req, profile: SamlProfile | null, done) => {
      try {
        if (!profile) {
          return done(new Error('No SAML profile received'));
        }
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
        
        // CRITICAL: Use tenant-specific storage for database isolation
        const tenantStorage = getDatabaseStorage(tenantId);
        
        // Check if user exists in this tenant
        let user = await tenantStorage.getUserByExternalId(userData.externalId, tenantId);
        if (!user && userData.email) {
          user = await tenantStorage.getUserByEmail(userData.email, tenantId);
        }

        if (user) {
          // Update existing user
          await tenantStorage.updateUser(user.id, {
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
          const newUser = await tenantStorage.createUser({
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
          profile?.nameID,
          { tenantId: req.tenantId }
        );
        return done(error instanceof Error ? error : new Error(errorMessage));
      }
    },
    async (req, profile: SamlProfile | null, done) => {
      try {
        const tenantId = req.session?.tenantId || req.tenantId;
        if (tenantId) {
          const tenantStorage = getDatabaseStorage(tenantId);
          const user = await tenantStorage.getUserByExternalId(profile?.nameID || '', tenantId);
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
        return done(null, undefined);
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
// Includes both standard SAML claims AND eduPerson attributes for InCommon/Shibboleth
function generateTenantServiceProviderMetadata(tenant: any): string {
  const spEntityId = `urn:edsteward:sp:${tenant.id}`;
  const baseUrl = `https://${tenant.subdomain}.${process.env.BASE_DOMAIN || 'edsteward.ai'}`;
  const callbackUrl = `${baseUrl}/auth/saml/callback`;
  const sloUrl = `${baseUrl}/auth/saml/logout`;
  
  // Check if eduPerson mode is enabled
  const eduPersonEnabled = tenant.ssoConfig?.saml?.eduPersonEnabled || tenant.samlConfig?.eduPersonEnabled;

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
    
    <!-- Standard SAML Claims (Microsoft/Azure AD, Okta) -->
    <md:AttributeConsumingService index="1" isDefault="true">
      <md:ServiceName xml:lang="en">EdSteward - ${tenant.name}</md:ServiceName>
      <md:ServiceDescription xml:lang="en">Regulatory Compliance Tracking System for ${tenant.name}</md:ServiceDescription>
      
      <!-- Microsoft/Azure AD style claims -->
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
      
      <!-- eduPerson attributes (InCommon/Shibboleth) -->
      <md:RequestedAttribute Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.6" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="eduPersonPrincipalName" isRequired="false"/>
      <md:RequestedAttribute Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.1" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="eduPersonAffiliation" isRequired="false"/>
      <md:RequestedAttribute Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.9" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="eduPersonScopedAffiliation" isRequired="false"/>
      <md:RequestedAttribute Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.7" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="eduPersonEntitlement" isRequired="false"/>
      <md:RequestedAttribute Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.10" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="eduPersonTargetedID" isRequired="false"/>
      
      <!-- Common LDAP attributes used by Shibboleth -->
      <md:RequestedAttribute Name="urn:oid:0.9.2342.19200300.100.1.3" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="mail" isRequired="false"/>
      <md:RequestedAttribute Name="urn:oid:2.5.4.42" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="givenName" isRequired="false"/>
      <md:RequestedAttribute Name="urn:oid:2.5.4.4" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="sn" isRequired="false"/>
      <md:RequestedAttribute Name="urn:oid:2.16.840.1.113730.3.1.241" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="displayName" isRequired="false"/>
      <md:RequestedAttribute Name="urn:oid:0.9.2342.19200300.100.1.1" 
                            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" 
                            FriendlyName="uid" isRequired="false"/>
    </md:AttributeConsumingService>
  </md:SPSSODescriptor>
  
  <md:Organization>
    <md:OrganizationName xml:lang="en">${tenant.name}</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">${tenant.name}</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">${baseUrl}</md:OrganizationURL>
  </md:Organization>
  
  <md:ContactPerson contactType="technical">
    <md:GivenName>Technical Support</md:GivenName>
    <md:EmailAddress>support@edsteward.ai</md:EmailAddress>
  </md:ContactPerson>
  
  <md:ContactPerson contactType="administrative">
    <md:GivenName>EdSteward Administration</md:GivenName>
    <md:EmailAddress>admin@edsteward.ai</md:EmailAddress>
  </md:ContactPerson>
</md:EntityDescriptor>`;
}

export default {
  setupTenantSamlAuth,
  generateTenantServiceProviderMetadata
}; 