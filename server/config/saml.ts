import { SamlConfig } from '@node-saml/passport-saml';
import { readFileSync } from 'fs';
import { join } from 'path';

// SAML cache interface
interface SamlCache {
  saveAsync(key: string, value: string): Promise<string>;
  getAsync(key: string): Promise<string | null>;
  removeAsync(key: string): Promise<string | null>;
}

// Declare global type for SAML cache
declare global {
  var samlCache: Map<string, string> | undefined;
}

export interface IdentityProviderConfig {
  id: string;
  name: string;
  description: string;
  type: 'okta' | 'shibboleth' | 'incommon' | 'generic';
  enabled: boolean;
  config: SamlConfig;
  metadata?: {
    entityId: string;
    ssoUrl: string;
    sloUrl?: string;
    certificate: string;
  };
}

// Generate or load your service provider's private key and certificate
// In production, these should be stored securely (e.g., Azure Key Vault, AWS Secrets Manager)
const getServiceProviderCert = (): string => {
  try {
    return readFileSync(join(process.cwd(), 'certs', 'sp-cert.pem'), 'utf8');
  } catch (error) {
    console.warn('Service Provider certificate not found. Using placeholder for development.');
    return process.env.SAML_SP_CERT || '';
  }
};

const getServiceProviderKey = (): string => {
  try {
    return readFileSync(join(process.cwd(), 'certs', 'sp-key.pem'), 'utf8');
  } catch (error) {
    console.warn('Service Provider private key not found. Using placeholder for development.');
    return process.env.SAML_SP_PRIVATE_KEY || '';
  }
};

// Create SAML cache implementation
const createSamlCache = (): SamlCache => {
  return {
    saveAsync: async function(key: string, value: string): Promise<string> {
      // In production, use Redis or database
      // For now, use in-memory storage (not recommended for production)
      if (!globalThis.samlCache) {
        globalThis.samlCache = new Map();
      }
      globalThis.samlCache.set(key, value);
      return Promise.resolve(value);
    },
    getAsync: async function(key: string): Promise<string | null> {
      if (!globalThis.samlCache) {
        globalThis.samlCache = new Map();
      }
      return Promise.resolve(globalThis.samlCache.get(key) || null);
    },
    removeAsync: async function(key: string): Promise<string | null> {
      if (!globalThis.samlCache) {
        globalThis.samlCache = new Map();
      }
      const value = globalThis.samlCache.get(key);
      globalThis.samlCache.delete(key);
      return Promise.resolve(value || null);
    }
  };
};

// Base configuration for the Service Provider
const baseServiceProviderConfig = {
  callbackUrl: process.env.SAML_CALLBACK_URL || 'http://localhost:3000/auth/saml/callback',
  entryPoint: '', // Will be overridden by each IDP
  issuer: process.env.SAML_SP_ENTITY_ID || 'urn:regulatorytrackr:sp',
  idpCert: '', // Will be set by each IDP
  privateCert: getServiceProviderKey(),
  decryptionPvk: getServiceProviderKey(),
  signatureAlgorithm: 'sha256' as const,
  digestAlgorithm: 'sha256' as const,
  authnRequestBinding: 'HTTP-Redirect' as const,
  skipRequestCompression: false,
  disableRequestedAuthnContext: false,
  requestedAuthnContext: ['urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport'],
  validateInResponseTo: 'always' as const,
  requestIdExpirationPeriodMs: 28800000, // 8 hours
  cacheProvider: createSamlCache()
};

// Identity Provider configurations
export const identityProviders: IdentityProviderConfig[] = [
  {
    id: 'okta-demo',
    name: 'Okta',
    description: 'Okta Identity Provider',
    type: 'okta',
    enabled: true,
    config: {
      ...baseServiceProviderConfig,
      entryPoint: process.env.OKTA_SSO_URL || 'https://your-okta-domain.okta.com/app/your-app-id/sso/saml',
      idpCert: process.env.OKTA_CERT || '',
      logoutUrl: process.env.OKTA_SLO_URL || 'https://your-okta-domain.okta.com/app/your-app-id/slo/saml',
      additionalParams: {
        RelayState: 'okta'
      },
      additionalAuthorizeParams: {
        response_type: 'id_token',
        scope: 'openid email profile'
      }
    },
    metadata: {
      entityId: process.env.OKTA_ENTITY_ID || 'http://www.okta.com/your-app-id',
      ssoUrl: process.env.OKTA_SSO_URL || '',
      sloUrl: process.env.OKTA_SLO_URL || '',
      certificate: process.env.OKTA_CERT || ''
    }
  },
  {
    id: 'shibboleth-idp',
    name: 'Shibboleth IdP',
    description: 'Shibboleth Identity Provider',
    type: 'shibboleth',
    enabled: true,
    config: {
      ...baseServiceProviderConfig,
      entryPoint: process.env.SHIBBOLETH_SSO_URL || 'https://your-idp.example.edu/idp/profile/SAML2/Redirect/SSO',
      idpCert: process.env.SHIBBOLETH_CERT || '',
      logoutUrl: process.env.SHIBBOLETH_SLO_URL || 'https://your-idp.example.edu/idp/profile/SAML2/Redirect/SLO',
      additionalParams: {
        RelayState: 'shibboleth'
      },
      // Shibboleth specific attribute mappings
      attributeConsumingServiceIndex: '1',
      disableRequestedAuthnContext: true, // Shibboleth often requires this
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      forceAuthn: false,
      passive: false
    },
    metadata: {
      entityId: process.env.SHIBBOLETH_ENTITY_ID || 'https://your-idp.example.edu/idp/shibboleth',
      ssoUrl: process.env.SHIBBOLETH_SSO_URL || '',
      sloUrl: process.env.SHIBBOLETH_SLO_URL || '',
      certificate: process.env.SHIBBOLETH_CERT || ''
    }
  },
  {
    id: 'incommon-federation',
    name: 'InCommon Federation',
    description: 'InCommon Federation for Higher Education',
    type: 'incommon',
    enabled: true,
    config: {
      ...baseServiceProviderConfig,
      entryPoint: process.env.INCOMMON_SSO_URL || 'https://wayf.incommonfederation.org/DS',
      idpCert: process.env.INCOMMON_CERT || '',
      logoutUrl: process.env.INCOMMON_SLO_URL || '',
      additionalParams: {
        RelayState: 'incommon'
      },
      // InCommon Federation specific settings
      disableRequestedAuthnContext: false,
      requestedAuthnContext: [
        'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
        'urn:oasis:names:tc:SAML:2.0:ac:classes:TimeSyncToken'
      ],
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      // InCommon typically uses discovery service
      providerName: 'RegulatoryTrackr',
      skipRequestCompression: false,
      authnRequestBinding: 'HTTP-Redirect' as const,
      // Support for multiple institution discovery
      additionalAuthorizeParams: {
        entityID: '', // Will be set dynamically based on user selection
        return: process.env.SAML_CALLBACK_URL || 'http://localhost:3000/auth/saml/callback'
      }
    },
    metadata: {
      entityId: process.env.INCOMMON_ENTITY_ID || 'https://wayf.incommonfederation.org',
      ssoUrl: process.env.INCOMMON_SSO_URL || '',
      sloUrl: process.env.INCOMMON_SLO_URL || '',
      certificate: process.env.INCOMMON_CERT || ''
    }
  }
];

// Dynamic IDP configuration based on tenant/domain
export function getIdentityProviderConfig(providerId: string): IdentityProviderConfig | null {
  return identityProviders.find(idp => idp.id === providerId && idp.enabled) || null;
}

// Get all enabled identity providers
export function getEnabledIdentityProviders(): IdentityProviderConfig[] {
  return identityProviders.filter(idp => idp.enabled);
}

// Attribute mapping configuration for different IDPs
export const attributeMappings = {
  okta: {
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    username: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
    role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    department: 'http://schemas.xmlsoap.org/claims/Department',
    affiliation: 'http://schemas.xmlsoap.org/claims/Affiliation',
    entitlement: 'http://schemas.xmlsoap.org/claims/Entitlement',
    organization: 'http://schemas.xmlsoap.org/claims/Organization'
  },
  shibboleth: {
    email: 'urn:oid:0.9.2342.19200300.100.1.3', // mail
    firstName: 'urn:oid:2.5.4.42', // givenName
    lastName: 'urn:oid:2.5.4.4', // sn (surname)
    username: 'urn:oid:0.9.2342.19200300.100.1.1', // uid
    displayName: 'urn:oid:2.16.840.1.113730.3.1.241', // displayName
    affiliation: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.1', // eduPersonAffiliation
    entitlement: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.7', // eduPersonEntitlement
    scopedAffiliation: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.9', // eduPersonScopedAffiliation
    principalName: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6', // eduPersonPrincipalName
    department: 'urn:oid:2.5.4.11', // ou (organizationalUnit)
    groups: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.1', // eduPersonAffiliation (fallback)
    role: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.7', // eduPersonEntitlement (fallback)
    organization: 'urn:oid:2.5.4.10' // o (organization)
  },
  incommon: {
    email: 'urn:oid:0.9.2342.19200300.100.1.3', // mail
    firstName: 'urn:oid:2.5.4.42', // givenName
    lastName: 'urn:oid:2.5.4.4', // sn
    username: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6', // eduPersonPrincipalName
    displayName: 'urn:oid:2.16.840.1.113730.3.1.241', // displayName
    affiliation: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.1', // eduPersonAffiliation
    entitlement: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.7', // eduPersonEntitlement
    scopedAffiliation: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.9', // eduPersonScopedAffiliation
    organization: 'urn:oid:2.5.4.10', // o (organization)
    department: 'urn:oid:2.5.4.11', // ou
    employeeNumber: 'urn:oid:2.16.840.1.113730.3.1.3', // employeeNumber
    groups: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.1', // eduPersonAffiliation (fallback)
    role: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.7' // eduPersonEntitlement (fallback)
  }
};

// Service Provider metadata generation
export function generateServiceProviderMetadata(): string {
  const spEntityId = process.env.SAML_SP_ENTITY_ID || 'urn:regulatorytrackr:sp';
  const spCert = getServiceProviderCert();
  const callbackUrl = process.env.SAML_CALLBACK_URL || 'http://localhost:3000/auth/saml/callback';
  const sloUrl = process.env.SAML_SLO_URL || 'http://localhost:3000/auth/saml/logout';

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${spEntityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
                      WantAssertionsSigned="true"
                      AuthnRequestsSigned="true">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${spCert.replace(/-----BEGIN CERTIFICATE-----\n?/, '').replace(/\n?-----END CERTIFICATE-----/, '').replace(/\n/g, '')}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:KeyDescriptor use="encryption">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${spCert.replace(/-----BEGIN CERTIFICATE-----\n?/, '').replace(/\n?-----END CERTIFICATE-----/, '').replace(/\n/g, '')}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
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
    <md:OrganizationName xml:lang="en">EdSteward</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">EdSteward</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">https://edsteward.ai</md:OrganizationURL>
  </md:Organization>
  <md:ContactPerson contactType="technical">
    <md:EmailAddress>support@edsteward.ai</md:EmailAddress>
  </md:ContactPerson>
</md:EntityDescriptor>`;
}

export default {
  identityProviders,
  getIdentityProviderConfig,
  getEnabledIdentityProviders,
  attributeMappings,
  generateServiceProviderMetadata
}; 