import passport from 'passport';
import { MultiSamlStrategy } from '@node-saml/passport-saml';
import { Express, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { getTenantStorage } from '../services/multi-tenant-database';
import { attributeMappings } from '../config/saml';
import { syslog, LogLevel } from '../services/syslog';
import { mapOktaGroupsToRoles, getHighestPriorityRole } from '../config/role-mapping';

// Extend session type for SAML
declare module 'express-session' {
  interface SessionData {
    returnTo?: string;
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
  [key: string]: unknown;
}

// Extract user attributes from SAML profile based on IDP type
function extractUserAttributes(profile: SamlProfile, idpType: string): Record<string, unknown> {
  const mapping = attributeMappings[idpType as keyof typeof attributeMappings] || attributeMappings.okta;
  
  // Extract groups from SAML profile
  let groups: string[] = [];
  if (profile.groups) {
    groups = Array.isArray(profile.groups) ? profile.groups : [profile.groups];
  } else if (profile[mapping.groups]) {
    const groupData = profile[mapping.groups];
    groups = Array.isArray(groupData) ? groupData : [groupData];
  }
  
  const extractedData = {
    email: profile.email || profile[mapping.email] || profile.nameID,
    firstName: profile.firstName || profile[mapping.firstName] || '',
    lastName: profile.lastName || profile[mapping.lastName] || '',
    username: profile.username || profile[mapping.username] || profile.nameID,
    department: profile.department || profile[mapping.department] || '',
    externalId: profile.nameID,
    identityProvider: idpType,
    providerId: idpType,
    groups: groups,
    roles: [] as string[],
    role: 'viewer', // default role for backwards compatibility
    organization: ''
  };

  // Map groups to roles based on IDP type
  if (idpType === 'okta' || idpType === 'okta-demo') {
    // For Okta, use the group-to-role mapping
    const mappedRoles = mapOktaGroupsToRoles(groups);
    extractedData.roles = mappedRoles;
    extractedData.role = getHighestPriorityRole(mappedRoles);
  } else if (idpType === 'shibboleth' || idpType === 'incommon') {
    // For educational institutions (Shibboleth/InCommon)
    const affiliation = profile[mapping.affiliation] || '';
    const entitlement = profile[mapping.entitlement] || '';
    
    // Map educational roles to application roles
    const roles: string[] = ['viewer'];
    
    const affiliationStr = (affiliation || '') as string;
    const entitlementStr = (entitlement || '') as string;
    if (affiliationStr) {
      if (affiliationStr.includes('faculty') || affiliationStr.includes('staff')) {
        roles.push('compliance_officer');
      }
      if (entitlementStr && entitlementStr.includes('admin')) {
        roles.push('admin');
      }
    }
    
    extractedData.roles = Array.from(new Set(roles));
    extractedData.role = getHighestPriorityRole(extractedData.roles);
    extractedData.organization = (profile[mapping.organization] || '') as string;
  }

  return extractedData;
}

// Multi-SAML strategy for handling multiple IDPs
export function setupSamlAuth(app: Express) {
  // Configure MultiSamlStrategy for dynamic IDP selection
  passport.use('saml-multi', new MultiSamlStrategy(
    {
      passReqToCallback: true,
      getSamlOptions: async (request, done) => {
        try {
          // Extract provider from URL or query parameter - handle both string and array types
          const providerParam = request.params.provider || request.query.provider;
          const providerId = Array.isArray(providerParam) ? providerParam[0] : (providerParam || 'okta-demo');
          
          // Base configuration
          const baseConfig = {
            callbackUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/saml/callback/${providerId}`,
            issuer: process.env.SAML_SP_ENTITY_ID || 'urn:edsteward:sp',
            signatureAlgorithm: 'sha256' as const,
            digestAlgorithm: 'sha256' as const,
            skipRequestCompression: false,
            wantAssertionsSigned: true,
            wantAuthnResponseSigned: true,
            requestIdExpirationPeriodMs: 28800000, // 8 hours
          };

          // Provider-specific configurations
          let samlConfig;
          
          switch (providerId) {
            case 'okta':
            case 'okta-demo':
              samlConfig = {
                ...baseConfig,
                entryPoint: process.env.OKTA_SSO_URL || 'https://your-okta-domain.okta.com/app/your-app-id/sso/saml',
                idpCert: process.env.OKTA_CERT || '',
                logoutUrl: process.env.OKTA_SLO_URL || 'https://your-okta-domain.okta.com/app/your-app-id/slo/saml',
                identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
                disableRequestedAuthnContext: false,
              };
              break;
              
            case 'shibboleth':
            case 'shibboleth-idp':
              samlConfig = {
                ...baseConfig,
                entryPoint: process.env.SHIBBOLETH_SSO_URL || 'https://your-idp.example.edu/idp/profile/SAML2/Redirect/SSO',
                idpCert: process.env.SHIBBOLETH_CERT || '',
                logoutUrl: process.env.SHIBBOLETH_SLO_URL || 'https://your-idp.example.edu/idp/profile/SAML2/Redirect/SLO',
                identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
                disableRequestedAuthnContext: true, // Common requirement for Shibboleth
                attributeConsumingServiceIndex: '1',
              };
              break;
              
            case 'incommon':
            case 'incommon-federation':
              samlConfig = {
                ...baseConfig,
                entryPoint: process.env.INCOMMON_SSO_URL || 'https://wayf.incommonfederation.org/DS',
                idpCert: process.env.INCOMMON_CERT || '',
                logoutUrl: process.env.INCOMMON_SLO_URL || '',
                identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
                disableRequestedAuthnContext: false,
                providerName: 'EdSteward',
              };
              break;
              
            default:
              return done(new Error(`Unknown SAML provider: ${providerId}`));
          }

          done(null, samlConfig);
        } catch (error) {
          done(error instanceof Error ? error : new Error('Unknown error in getSamlOptions'));
        }
      }
    },
    async (req, profile: SamlProfile | null, done) => {
      try {
        if (!profile) {
          return done(new Error('No SAML profile received'));
        }
        const providerParam = req.params.provider || req.query.provider;
        const providerId = Array.isArray(providerParam) ? providerParam[0] : (providerParam || 'okta-demo');
        
        const idpType = typeof providerId === 'string' && providerId.includes('okta') ? 'okta' : 
                        typeof providerId === 'string' && providerId.includes('shibboleth') ? 'shibboleth' : 
                        typeof providerId === 'string' && providerId.includes('incommon') ? 'incommon' : 'okta';
        
        const userData = extractUserAttributes(profile, idpType);
        
        // Get tenant-aware storage - try to determine tenant from request or use default
        const tenantId = req.tenantId || req.tenant?.id;
        const userStorage = tenantId ? getTenantStorage(tenantId) : storage;
        
        // Check if user exists by external ID or email in this tenant
        let user = await userStorage.getUserByExternalId(userData.externalId as string);
        if (!user && userData.email) {
          user = await userStorage.getUserByEmail(userData.email as string);
        }

        if (user) {
          // Update existing user's login timestamp, SAML data, and roles
          const updateData: Record<string, unknown> = {
            lastLogin: new Date(),
            identityProvider: userData.identityProvider,
            providerId: userData.providerId,
            role: userData.role // Update primary role
          };
          
          // Add roles array if supported by storage layer
          const userRoles = userData.roles as string[];
          if (userRoles && userRoles.length > 0) {
            updateData.roles = JSON.stringify(userRoles);
          }
          
          await userStorage.updateUser(user.id, updateData);
          
          const enhancedUser = {
            ...user,
            role: userData.role,
            roles: userRoles || [userData.role],
            groups: (userData.groups as string[]) || []
          };
          
          await syslog.logAuthEvent(LogLevel.INFO, `SAML login successful via ${idpType}`, user.id, user.username, {
            tenantId,
            provider: idpType,
            roles: userData.roles,
            groups: userData.groups
          });
          return done(null, enhancedUser);
        } else {
          // Create new user from SAML profile - password is optional for SAML users
          const createUserData: Record<string, unknown> = {
            username: userData.username,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role || 'viewer',
            department: userData.department,
            externalId: userData.externalId,
            identityProvider: userData.identityProvider,
            providerId: userData.providerId,
            lastLogin: new Date()
            // Note: no password for SAML users, tenantId handled by storage layer
          };
          
          // Add roles array if supported by storage layer
          const createRoles = userData.roles as string[];
          if (createRoles && createRoles.length > 0) {
            createUserData.roles = JSON.stringify(createRoles);
          }
          
          const newUser = await userStorage.createUser(createUserData as any);
          
          // Enhance user object with roles for session
          const enhancedUser = {
            ...newUser,
            roles: createRoles || [userData.role],
            groups: (userData.groups as string[]) || []
          };
          
          await syslog.logAuthEvent(LogLevel.INFO, `New SAML user created via ${idpType}`, newUser.id, newUser.username, {
            tenantId,
            provider: idpType,
            roles: userData.roles,
            groups: userData.groups
          });
          return done(null, enhancedUser);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await syslog.logAuthEvent(LogLevel.ERROR, `SAML authentication error: ${errorMessage}`, undefined, profile?.nameID);
        return done(error instanceof Error ? error : new Error(errorMessage));
      }
    },
    async (req, profile: SamlProfile | null, done) => {
      try {
        const user = await storage.getUserByExternalId(profile?.nameID || '');
        if (user) {
          await syslog.logAuthEvent(LogLevel.INFO, 'SAML logout successful', user.id, user.username);
        }
        return done(null, user);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await syslog.logAuthEvent(LogLevel.ERROR, `SAML logout error: ${errorMessage}`, undefined, profile?.nameID);
        return done(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  ));

  // SAML authentication routes
  
  // Initiate SAML authentication for specific provider
  app.get('/auth/saml/:provider', (req: Request, res: Response, next: NextFunction) => {
    const _provider = req.params.provider;
    
    passport.authenticate('saml-multi', {
      failureRedirect: '/login?error=saml_error'
    })(req, res, next);
  });

  // SAML callback handler
  app.post('/auth/saml/callback/:provider', 
    passport.authenticate('saml-multi', {
      failureRedirect: '/login?error=saml_callback_failed'
    }), 
    (req: Request, res: Response) => {
      // Successful authentication
      const redirectTo = req.session.returnTo || '/dashboard';
      delete req.session.returnTo;
      res.redirect(redirectTo);
    }
  );

  // SAML logout initiation
  app.get('/auth/saml/logout/:provider', (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.redirect('/');
    }

    // For SAML logout, we need to initiate SLO with the IDP
    // This is provider-specific implementation
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      res.redirect('/');
    });
  });

  // Service Provider metadata endpoint
  app.get('/auth/saml/metadata/:provider?', (req: Request, res: Response) => {
    try {
      const _provider = req.params.provider || 'default';
      
      // Generate metadata based on provider
      const metadata = generateServiceProviderMetadata(_provider);
      
      res.type('application/xml');
      res.status(200).send(metadata);
    } catch {
      res.status(500).send('Error generating metadata');
    }
  });

  // Identity provider discovery page
  app.get('/auth/saml/discovery', (req: Request, res: Response) => {
    const availableProviders = [
      { id: 'okta', name: 'Okta SSO', description: 'Corporate Okta Identity Provider' },
      { id: 'shibboleth', name: 'Shibboleth IdP', description: 'University Shibboleth Identity Provider' },
      { id: 'incommon', name: 'InCommon Federation', description: 'Higher Education InCommon Federation' }
    ];

    // In a real implementation, this would render a discovery page
    // For now, return JSON list of providers
    res.json({
      message: 'Available SAML Identity Providers',
      providers: availableProviders,
      usage: 'Navigate to /auth/saml/{provider-id} to initiate authentication'
    });
  });
}

// Generate Service Provider metadata
function generateServiceProviderMetadata(_provider: string = 'default'): string {
  const spEntityId = process.env.SAML_SP_ENTITY_ID || 'urn:edsteward:sp';
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/auth/saml/callback/${_provider}`;
  const sloUrl = `${baseUrl}/auth/saml/logout/${_provider}`;

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
      <md:ServiceName xml:lang="en">EdSteward</md:ServiceName>
      <md:ServiceDescription xml:lang="en">Regulatory Compliance Tracking System</md:ServiceDescription>
      <md:RequestedAttribute Name="urn:oid:0.9.2342.19200300.100.1.3" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" FriendlyName="mail" isRequired="true"/>
      <md:RequestedAttribute Name="urn:oid:2.5.4.42" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" FriendlyName="givenName" isRequired="true"/>
      <md:RequestedAttribute Name="urn:oid:2.5.4.4" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" FriendlyName="sn" isRequired="true"/>
      <md:RequestedAttribute Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.6" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" FriendlyName="eduPersonPrincipalName" isRequired="false"/>
      <md:RequestedAttribute Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.1" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" FriendlyName="eduPersonAffiliation" isRequired="false"/>
      <md:RequestedAttribute Name="urn:oid:2.5.4.11" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" FriendlyName="ou" isRequired="false"/>
    </md:AttributeConsumingService>
  </md:SPSSODescriptor>
  <md:Organization>
    <md:OrganizationName xml:lang="en">EdSteward</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">EdSteward</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">https://edsteward.com</md:OrganizationURL>
  </md:Organization>
  <md:ContactPerson contactType="technical">
    <md:EmailAddress>support@edsteward.com</md:EmailAddress>
  </md:ContactPerson>
</md:EntityDescriptor>`;
}

export default {
  setupSamlAuth,
  generateServiceProviderMetadata
}; 