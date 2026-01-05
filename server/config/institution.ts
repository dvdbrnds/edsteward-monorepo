/**
 * Single-Tenant Institution Configuration
 * Replaces multi-tenant system with environment-based configuration
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface InstitutionConfig {
  name: string;
  domain: string;
  branding: {
    logo: string;
    primaryColor: string;
    secondaryColor: string;
    favicon?: string;
  };
  authentication: {
    samlEnabled: boolean;
    samlEntityId?: string;
    samlSsoUrl?: string;
    samlCertificate?: string;
    usernamePasswordEnabled: boolean;
    allowSelfRegistration: boolean;
  };
  features: {
    maxUsers: number;
    maxRegulations: number;
    apiAccess: boolean;
    customDomain: boolean;
    ssoEnabled: boolean;
  };
  contact: {
    supportEmail: string;
    adminEmail: string;
    organizationUrl?: string;
  };
}

// Load configuration from environment variables
export const institutionConfig: InstitutionConfig = {
  name: (process.env.INSTITUTION_NAME || 'EdSteward Institution').replace(/_/g, ' '),
  domain: process.env.INSTITUTION_DOMAIN || 'localhost',
  branding: {
    logo: process.env.INSTITUTION_LOGO_URL || '/assets/es-white-on-purple-logo.png',
    primaryColor: process.env.INSTITUTION_PRIMARY_COLOR || '#0066cc',
    secondaryColor: process.env.INSTITUTION_SECONDARY_COLOR || '#336699',
    favicon: process.env.INSTITUTION_FAVICON_URL || '/favicon.ico',
  },
  authentication: {
    samlEnabled: process.env.AUTH_SAML_ENABLED === 'true',
    samlEntityId: process.env.AUTH_SAML_ENTITY_ID,
    samlSsoUrl: process.env.AUTH_SAML_SSO_URL,
    samlCertificate: process.env.AUTH_SAML_ENABLED === 'true' ? (
      process.env.AUTH_SAML_CERT || (() => {
        try {
          const certContent = readFileSync(join(__dirname, '../../certs/okta-cert.pem'), 'utf8');
          return certContent.trim();
        } catch (error) {
          console.error('Failed to read SAML certificate file:', error);
          return undefined;
        }
      })()
    ) : undefined,
    usernamePasswordEnabled: process.env.AUTH_USERNAME_PASSWORD_ENABLED !== 'false',
    allowSelfRegistration: process.env.AUTH_ALLOW_SELF_REGISTRATION === 'true',
  },
  features: {
    maxUsers: parseInt(process.env.FEATURE_MAX_USERS || '1000'),
    maxRegulations: parseInt(process.env.FEATURE_MAX_REGULATIONS || '10000'),
    apiAccess: process.env.FEATURE_API_ACCESS !== 'false',
    customDomain: process.env.FEATURE_CUSTOM_DOMAIN === 'true',
    ssoEnabled: process.env.FEATURE_SSO_ENABLED === 'true',
  },
  contact: {
    supportEmail: process.env.SUPPORT_EMAIL || 'support@localhost',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@localhost',
    organizationUrl: process.env.ORGANIZATION_URL,
  },
};

// Validation
export function validateConfig(): void {
  const errors: string[] = [];

  if (!institutionConfig.name) {
    errors.push('INSTITUTION_NAME is required');
  }

  if (institutionConfig.authentication.samlEnabled) {
    if (!institutionConfig.authentication.samlEntityId) {
      errors.push('AUTH_SAML_ENTITY_ID is required when SAML is enabled');
    }
    if (!institutionConfig.authentication.samlSsoUrl) {
      errors.push('AUTH_SAML_SSO_URL is required when SAML is enabled');
    }
    if (!institutionConfig.authentication.samlCertificate) {
      errors.push('AUTH_SAML_CERT is required when SAML is enabled');
    }
  }

  if (errors.length > 0) {
    throw new Error('Configuration validation failed:\n' + errors.join('\n'));
  }
}
