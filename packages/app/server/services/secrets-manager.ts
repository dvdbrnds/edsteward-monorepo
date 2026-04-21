/**
 * Secrets Manager Service (HECVAT INFRA-08)
 * 
 * Provides secure secrets management with support for:
 * - AWS Secrets Manager (production)
 * - Environment variables (development/fallback)
 * - Automatic rotation support
 * 
 * In production, this retrieves secrets from AWS Secrets Manager
 * instead of relying solely on environment variables.
 * This ensures secrets can be rotated without redeployment.
 */

import { syslog, LogLevel, LogFacility } from './syslog';

// Cache for retrieved secrets (with TTL)
interface CachedSecret {
  value: string;
  retrievedAt: number;
}

const secretCache = new Map<string, CachedSecret>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Secret key mappings: Maps our internal key names to 
 * AWS Secrets Manager secret IDs and env var fallbacks
 */
const SECRET_MAPPINGS: Record<string, { awsSecretId: string; envVar: string; required: boolean }> = {
  'database-url': {
    awsSecretId: 'edsteward/database-url',
    envVar: 'DATABASE_URL',
    required: true,
  },
  'session-secret': {
    awsSecretId: 'edsteward/session-secret',
    envVar: 'SESSION_SECRET',
    required: true,
  },
  'openai-api-key': {
    awsSecretId: 'edsteward/openai-api-key',
    envVar: 'OPENAI_API_KEY',
    required: false,
  },
  'smtp-password': {
    awsSecretId: 'edsteward/smtp-password',
    envVar: 'SMTP_PASSWORD',
    required: false,
  },
  'saml-cert': {
    awsSecretId: 'edsteward/saml-cert',
    envVar: 'SAML_CERT',
    required: false,
  },
};

/**
 * Check if AWS Secrets Manager is available
 * Uses dynamic import to avoid requiring aws-sdk in development
 */
async function isAwsAvailable(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }
  
  try {
    // Check if we're running in AWS (ECS sets this)
    if (process.env.AWS_REGION || process.env.ECS_CONTAINER_METADATA_URI) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Retrieve a secret from AWS Secrets Manager
 */
async function getFromAwsSecretsManager(secretId: string): Promise<string | null> {
  try {
    // Dynamic import to avoid bundling AWS SDK in development
    // @ts-ignore - AWS SDK only available in production
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
    
    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    
    const command = new GetSecretValueCommand({
      SecretId: secretId,
    });
    
    const response = await client.send(command);
    
    if (response.SecretString) {
      // Try to parse as JSON (AWS Secrets Manager supports JSON secrets)
      try {
        const parsed = JSON.parse(response.SecretString);
        // If it's a simple key-value, return the first value
        if (typeof parsed === 'object' && Object.keys(parsed).length === 1) {
          return Object.values(parsed)[0] as string;
        }
        return response.SecretString;
      } catch {
        // Not JSON, return as plain string
        return response.SecretString;
      }
    }
    
    return null;
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
      `Failed to retrieve secret from AWS Secrets Manager: ${secretId} - ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get a secret value, with caching and fallback chain:
 * 1. Check cache (if not expired)
 * 2. Try AWS Secrets Manager (production only)
 * 3. Fall back to environment variable
 */
export async function getSecret(key: string): Promise<string | null> {
  const mapping = SECRET_MAPPINGS[key];
  if (!mapping) {
    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
      `Unknown secret key requested: ${key}`);
    return null;
  }
  
  // 1. Check cache
  const cached = secretCache.get(key);
  if (cached && (Date.now() - cached.retrievedAt) < CACHE_TTL_MS) {
    return cached.value;
  }
  
  // 2. Try AWS Secrets Manager (production)
  if (await isAwsAvailable()) {
    const awsValue = await getFromAwsSecretsManager(mapping.awsSecretId);
    if (awsValue) {
      secretCache.set(key, { value: awsValue, retrievedAt: Date.now() });
      return awsValue;
    }
  }
  
  // 3. Fall back to environment variable
  const envValue = process.env[mapping.envVar];
  if (envValue) {
    secretCache.set(key, { value: envValue, retrievedAt: Date.now() });
    return envValue;
  }
  
  if (mapping.required) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      `Required secret '${key}' not found in Secrets Manager or environment`);
  }
  
  return null;
}

/**
 * Invalidate cached secret (call after rotation)
 */
export function invalidateSecret(key: string): void {
  secretCache.delete(key);
}

/**
 * Invalidate all cached secrets
 */
export function invalidateAllSecrets(): void {
  secretCache.clear();
  syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
    'All cached secrets invalidated');
}

/**
 * Get rotation status for all managed secrets
 */
export async function getSecretsStatus(): Promise<Record<string, {
  key: string;
  source: 'aws' | 'env' | 'missing';
  cached: boolean;
  required: boolean;
}>> {
  const status: Record<string, any> = {};
  
  for (const [key, mapping] of Object.entries(SECRET_MAPPINGS)) {
    const cached = secretCache.has(key);
    const hasEnv = !!process.env[mapping.envVar];
    
    status[key] = {
      key,
      source: cached ? 'aws' : hasEnv ? 'env' : 'missing',
      cached,
      required: mapping.required,
    };
  }
  
  return status;
}

export default {
  getSecret,
  invalidateSecret,
  invalidateAllSecrets,
  getSecretsStatus,
};
