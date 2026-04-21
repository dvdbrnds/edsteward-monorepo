/**
 * Single-Tenant Institution Configuration
 * Uses centralized environment config
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './environment';

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

/**
 * Load SAML certificate from env or file
 */
function loadSamlCertificate(): string | undefined {
  if (!config.AUTH_SAML_ENABLED) {
    return undefined;
  }

  // Try environment variable first
  const envCert = process.env.AUTH_SAML_CERT;
  if (envCert) {
    return envCert.trim();
  }

  // Fall back to file
  try {
    const certPath = join(__dirname, '../../certs/okta-cert.pem');
    const certContent = readFileSync(certPath, 'utf8');
    return certContent.trim();
  } catch {
    console.warn('⚠️ SAML certificate not found in env or certs/okta-cert.pem');
    return undefined;
  }
}

// Build institution config from environment
export const institutionConfig: InstitutionConfig = {
  name: config.INSTITUTION_NAME,
  domain: config.INSTITUTION_DOMAIN,
  branding: {
    logo: config.INSTITUTION_LOGO_URL,
    primaryColor: config.INSTITUTION_PRIMARY_COLOR,
    secondaryColor: config.INSTITUTION_SECONDARY_COLOR,
    favicon: config.INSTITUTION_FAVICON_URL,
  },
  authentication: {
    samlEnabled: config.AUTH_SAML_ENABLED,
    samlEntityId: config.AUTH_SAML_ENTITY_ID || undefined,
    samlSsoUrl: config.AUTH_SAML_SSO_URL || undefined,
    samlCertificate: loadSamlCertificate(),
    usernamePasswordEnabled: config.AUTH_USERNAME_PASSWORD_ENABLED,
    allowSelfRegistration: config.AUTH_ALLOW_SELF_REGISTRATION,
  },
  features: {
    maxUsers: config.FEATURE_MAX_USERS,
    maxRegulations: config.FEATURE_MAX_REGULATIONS,
    apiAccess: config.FEATURE_API_ACCESS,
    customDomain: config.FEATURE_CUSTOM_DOMAIN,
    ssoEnabled: config.FEATURE_SSO_ENABLED,
  },
  contact: {
    supportEmail: process.env.SUPPORT_EMAIL || 'support@localhost',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@localhost',
    organizationUrl: process.env.ORGANIZATION_URL,
  },
};

/**
 * Validate institution-specific configuration
 * Called after environment validation
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (institutionConfig.authentication.samlEnabled) {
    if (!institutionConfig.authentication.samlCertificate) {
      errors.push('SAML certificate is required when SAML is enabled. Set AUTH_SAML_CERT or place cert in certs/okta-cert.pem');
    }
  }

  if (errors.length > 0) {
    throw new Error('Institution configuration validation failed:\n' + errors.join('\n'));
  }
}
