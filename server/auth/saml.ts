import passport from 'passport';
import { Strategy as SamlStrategy, MultiSamlStrategy } from '@node-saml/passport-saml';
import { Express, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { attributeMappings } from '../config/saml';
import { syslog, LogLevel } from '../services/syslog';

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
  [key: string]: any;
}

// Extract user attributes from SAML profile based on IDP type
function extractUserAttributes(profile: SamlProfile, idpType: string): any {
  const mapping = attributeMappings[idpType as keyof typeof attributeMappings] || attributeMappings.okta;
  
  const extractedData = {
    email: profile.email || profile[mapping.email] || profile.nameID,
    firstName: profile.firstName || profile[mapping.firstName] || '',
    lastName: profile.lastName || profile[mapping.lastName] || '',
    username: profile.username || profile[mapping.username] || profile.nameID,
    department: profile.department || profile[mapping.department] || '',
    externalId: profile.nameID,
    identityProvider: idpType,
    providerId: idpType,
    role: 'user', // default role
    organization: ''
  };

  // For educational institutions (Shibboleth/InCommon)
  if (idpType === 'shibboleth' || idpType === 'incommon') {
    // Extract affiliation information for role mapping
    const affiliation = profile[mapping.affiliation] || '';
    const entitlement = profile[mapping.entitlement] || '';
    
    // Map educational roles to application roles
    let role = 'user'; // default role
    if (affiliation) {
      if (affiliation.includes('faculty') || affiliation.includes('staff')) {
        role = 'compliance_officer';
      }
      if (entitlement && entitlement.includes('admin')) {
        role = 'admin';
      }
    }
    
    extractedData.role = role;
    extractedData.organization = profile[mapping.organization] || '';
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
            issuer: process.env.SAML_SP_ENTITY_ID || 'urn:regulatorytrackr:sp',
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
                providerName: 'RegulatoryTrackr',
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
    async (req, profile: SamlProfile, done) => {
      try {
        const providerParam = req.params.provider || req.query.provider;
        const providerId = Array.isArray(providerParam) ? providerParam[0] : (providerParam || 'okta-demo');
        
        const idpType = typeof providerId === 'string' && providerId.includes('okta') ? 'okta' : 
                        typeof providerId === 'string' && providerId.includes('shibboleth') ? 'shibboleth' : 
                        typeof providerId === 'string' && providerId.includes('incommon') ? 'incommon' : 'okta';
        
        const userData = extractUserAttributes(profile, idpType);
        
        // Check if user exists by external ID or email
        let user = await storage.getUserByExternalId(userData.externalId);
        if (!user && userData.email) {
          user = await storage.getUserByEmail(userData.email);
        }

        if (user) {
          // Update existing user's login timestamp and SAML data
          await storage.updateUser(user.id, {
            lastLogin: new Date(),
            identityProvider: userData.identityProvider,
            providerId: userData.providerId
          });
          
          await syslog.logAuthEvent(LogLevel.INFO, `SAML login successful via ${idpType}`, user.id, user.username);
          return done(null, user);
        } else {
          // Create new user from SAML profile - password is optional for SAML users
          const newUser = await storage.createUser({
            username: userData.username,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role || 'user',
            department: userData.department,
            externalId: userData.externalId,
            identityProvider: userData.identityProvider,
            providerId: userData.providerId,
            lastLogin: new Date()
            // Note: no password for SAML users
          });
          
          await syslog.logAuthEvent(LogLevel.INFO, `New SAML user created via ${idpType}`, newUser.id, newUser.username);
          return done(null, newUser);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await syslog.logAuthEvent(LogLevel.ERROR, `SAML authentication error: ${errorMessage}`, undefined, profile.nameID);
        return done(error instanceof Error ? error : new Error(errorMessage));
      }
    },
    async (req, profile: SamlProfile, done) => {
      // Logout callback - handle SAML logout
      try {
        // Find user by nameID for logout
        const user = await storage.getUserByExternalId(profile.nameID || '');
        if (user) {
          await syslog.logAuthEvent(LogLevel.INFO, 'SAML logout successful', user.id, user.username);
        }
        return done(null, user);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await syslog.logAuthEvent(LogLevel.ERROR, `SAML logout error: ${errorMessage}`, undefined, profile.nameID);
        return done(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  ));

  // SAML authentication routes
  
  // Initiate SAML authentication for specific provider
  app.get('/auth/saml/:provider', (req: Request, res: Response, next: NextFunction) => {
    const provider = req.params.provider;
    
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
      const provider = req.params.provider || 'default';
      
      // Generate metadata based on provider
      const metadata = generateServiceProviderMetadata(provider);
      
      res.type('application/xml');
      res.status(200).send(metadata);
    } catch (error) {
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
function generateServiceProviderMetadata(provider: string = 'default'): string {
  const spEntityId = process.env.SAML_SP_ENTITY_ID || 'urn:regulatorytrackr:sp';
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/auth/saml/callback/${provider}`;
  const sloUrl = `${baseUrl}/auth/saml/logout/${provider}`;

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
      <md:ServiceName xml:lang="en">RegulatoryTrackr</md:ServiceName>
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
    <md:OrganizationName xml:lang="en">RegulatoryTrackr</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">RegulatoryTrackr</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">https://regulatorytrackr.com</md:OrganizationURL>
  </md:Organization>
  <md:ContactPerson contactType="technical">
    <md:EmailAddress>support@regulatorytrackr.com</md:EmailAddress>
  </md:ContactPerson>
</md:EntityDescriptor>`;
}

export default {
  setupSamlAuth,
  generateServiceProviderMetadata
}; 