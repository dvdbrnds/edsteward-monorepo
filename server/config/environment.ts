/**
 * Environment Configuration
 * Centralized environment variable handling with validation
 */

import 'dotenv/config';

// =============================================================================
// Validation
// =============================================================================

interface EnvVarConfig {
  required: boolean;
  default?: string;
  validate?: (value: string) => boolean;
}

const ENV_SCHEMA: Record<string, EnvVarConfig> = {
  // Required
  DATABASE_URL: { required: true },
  SESSION_SECRET: { required: true },
  
  // Required with defaults
  NODE_ENV: { required: true, default: 'development' },
  PORT: { required: true, default: '3000' },
  INSTITUTION_NAME: { required: true, default: 'EdSteward Institution' },
  
  // Optional
  MULTI_TENANT: { required: false, default: 'false' },
  BASE_URL: { required: false },
  
  // Auth
  AUTH_SAML_ENABLED: { required: false, default: 'false' },
  AUTH_SAML_ENTITY_ID: { required: false },
  AUTH_SAML_SSO_URL: { required: false },
  AUTH_SAML_CERT: { required: false },
  AUTH_USERNAME_PASSWORD_ENABLED: { required: false, default: 'true' },
  AUTH_ALLOW_SELF_REGISTRATION: { required: false, default: 'false' },
  
  // Branding
  INSTITUTION_DOMAIN: { required: false, default: 'localhost' },
  INSTITUTION_LOGO_URL: { required: false },
  INSTITUTION_FAVICON_URL: { required: false },
  INSTITUTION_PRIMARY_COLOR: { required: false, default: '#0066cc' },
  INSTITUTION_SECONDARY_COLOR: { required: false, default: '#336699' },
  
  // Email
  EMAIL_HOST: { required: false, default: 'smtp.gmail.com' },
  EMAIL_PORT: { required: false, default: '587' },
  EMAIL_USER: { required: false },
  EMAIL_PASS: { required: false },
  EMAIL_FROM: { required: false },
  
  // Features
  FEATURE_MAX_USERS: { required: false, default: '1000' },
  FEATURE_MAX_REGULATIONS: { required: false, default: '10000' },
  FEATURE_API_ACCESS: { required: false, default: 'true' },
  FEATURE_CUSTOM_DOMAIN: { required: false, default: 'false' },
  FEATURE_SSO_ENABLED: { required: false, default: 'false' },
  
  // Optional services
  OPENAI_API_KEY: { required: false },
  MFA_ENCRYPTION_KEY: { required: false },
  AWS_ACCESS_KEY_ID: { required: false },
  AWS_SECRET_ACCESS_KEY: { required: false },
  AWS_REGION: { required: false, default: 'us-east-1' },
};

/**
 * Validate all environment variables at startup
 */
export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [key, config] of Object.entries(ENV_SCHEMA)) {
    const value = process.env[key];
    
    if (config.required && !value && !config.default) {
      errors.push(`Missing required environment variable: ${key}`);
    }
    
    if (config.validate && value && !config.validate(value)) {
      errors.push(`Invalid value for ${key}`);
    }
  }

  // Conditional validation
  if (process.env.AUTH_SAML_ENABLED === 'true') {
    if (!process.env.AUTH_SAML_ENTITY_ID) {
      errors.push('AUTH_SAML_ENTITY_ID is required when SAML is enabled');
    }
    if (!process.env.AUTH_SAML_SSO_URL) {
      errors.push('AUTH_SAML_SSO_URL is required when SAML is enabled');
    }
    // Certificate is handled by institution.ts which can load from file
  }

  // Warn about missing optional but recommended vars
  if (!process.env.EMAIL_USER && process.env.NODE_ENV === 'production') {
    warnings.push('EMAIL_USER not set - email notifications will not work');
  }
  
  if (!process.env.MFA_ENCRYPTION_KEY) {
    warnings.push('MFA_ENCRYPTION_KEY not set - MFA data will not persist across restarts');
  }

  // Output warnings
  for (const warning of warnings) {
    console.warn(`⚠️ ${warning}`);
  }

  // Throw on errors
  if (errors.length > 0) {
    throw new Error(
      'Environment validation failed:\n' + 
      errors.map(e => `  ❌ ${e}`).join('\n') +
      '\n\nSee .env.example for required variables.'
    );
  }
}

// =============================================================================
// Configuration Export
// =============================================================================

function getEnv(key: string, defaultValue?: string): string {
  return process.env[key] || ENV_SCHEMA[key]?.default || defaultValue || '';
}

function getEnvBool(key: string): boolean {
  const value = getEnv(key);
  return value === 'true' || value === '1';
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = getEnv(key);
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const config = {
  // Core
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  PORT: getEnvInt('PORT', 3000),
  DATABASE_URL: process.env.DATABASE_URL!,
  SESSION_SECRET: process.env.SESSION_SECRET!,
  
  // Multi-tenant
  MULTI_TENANT: getEnvBool('MULTI_TENANT'),
  BASE_URL: getEnv('BASE_URL'),
  
  // Institution
  INSTITUTION_NAME: getEnv('INSTITUTION_NAME').replace(/_/g, ' '),
  INSTITUTION_DOMAIN: getEnv('INSTITUTION_DOMAIN'),
  
  // Branding
  INSTITUTION_LOGO_URL: getEnv('INSTITUTION_LOGO_URL', '/assets/es-white-on-purple-logo.png'),
  INSTITUTION_FAVICON_URL: getEnv('INSTITUTION_FAVICON_URL', '/favicon.ico'),
  INSTITUTION_PRIMARY_COLOR: getEnv('INSTITUTION_PRIMARY_COLOR'),
  INSTITUTION_SECONDARY_COLOR: getEnv('INSTITUTION_SECONDARY_COLOR'),
  
  // Auth
  AUTH_SAML_ENABLED: getEnvBool('AUTH_SAML_ENABLED'),
  AUTH_SAML_ENTITY_ID: getEnv('AUTH_SAML_ENTITY_ID'),
  AUTH_SAML_SSO_URL: getEnv('AUTH_SAML_SSO_URL'),
  AUTH_USERNAME_PASSWORD_ENABLED: getEnv('AUTH_USERNAME_PASSWORD_ENABLED') !== 'false',
  AUTH_ALLOW_SELF_REGISTRATION: getEnvBool('AUTH_ALLOW_SELF_REGISTRATION'),
  
  // Email
  EMAIL_HOST: getEnv('EMAIL_HOST'),
  EMAIL_PORT: getEnvInt('EMAIL_PORT', 587),
  EMAIL_USER: getEnv('EMAIL_USER'),
  EMAIL_PASS: getEnv('EMAIL_PASS'),
  EMAIL_FROM: getEnv('EMAIL_FROM'),
  
  // Features
  FEATURE_MAX_USERS: getEnvInt('FEATURE_MAX_USERS', 1000),
  FEATURE_MAX_REGULATIONS: getEnvInt('FEATURE_MAX_REGULATIONS', 10000),
  FEATURE_API_ACCESS: getEnv('FEATURE_API_ACCESS') !== 'false',
  FEATURE_CUSTOM_DOMAIN: getEnvBool('FEATURE_CUSTOM_DOMAIN'),
  FEATURE_SSO_ENABLED: getEnvBool('FEATURE_SSO_ENABLED'),
  
  // Optional services
  OPENAI_API_KEY: getEnv('OPENAI_API_KEY'),
  MFA_ENCRYPTION_KEY: getEnv('MFA_ENCRYPTION_KEY'),
  AWS_ACCESS_KEY_ID: getEnv('AWS_ACCESS_KEY_ID'),
  AWS_SECRET_ACCESS_KEY: getEnv('AWS_SECRET_ACCESS_KEY'),
  AWS_REGION: getEnv('AWS_REGION'),
} as const;

// =============================================================================
// Environment Helpers
// =============================================================================

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isStaging = config.NODE_ENV === 'staging';
export const isTest = config.NODE_ENV === 'test';

// Run validation on import
validateEnvironment();
