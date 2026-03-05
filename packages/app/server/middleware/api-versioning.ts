/**
 * API Versioning Middleware
 * 
 * Provides backward-compatible API evolution with version negotiation
 * and automatic version detection from headers, query params, or URL paths.
 */

import { Request, Response, NextFunction } from 'express';

// Supported API versions
export const SUPPORTED_VERSIONS = ['1.0', '1.1', '2.0'] as const;
export type APIVersion = typeof SUPPORTED_VERSIONS[number];

// Default version for new requests
const DEFAULT_VERSION: APIVersion = '2.0';

// Version compatibility matrix
const VERSION_COMPATIBILITY: Record<APIVersion, APIVersion[]> = {
  '1.0': ['1.0'],
  '1.1': ['1.0', '1.1'],
  '2.0': ['1.0', '1.1', '2.0']
};

// Extended Request interface with version information
export interface VersionedRequest extends Request {
  apiVersion: APIVersion;
  requestedVersion?: string;
  isVersionSupported: boolean;
  compatibleVersions: APIVersion[];
}

/**
 * Extract API version from various sources
 */
function extractVersionFromRequest(req: Request): string | null {
  // 1. Check Accept header (preferred method)
  // Format: application/vnd.edsteward.v1+json
  const acceptHeader = req.get('Accept');
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/application\/vnd\.edsteward\.v(\d+\.?\d*)(\+json)?/);
    if (versionMatch) {
      return versionMatch[1];
    }
  }

  // 2. Check custom version header
  // Format: X-API-Version: 1.0
  const versionHeader = req.get('X-API-Version');
  if (versionHeader) {
    return versionHeader;
  }

  // 3. Check query parameter
  // Format: ?version=1.0
  const versionQuery = req.query.version as string;
  if (versionQuery) {
    return versionQuery;
  }

  // 4. Check URL path prefix
  // Format: /api/v1.0/regulations
  const pathMatch = req.path.match(/^\/api\/v(\d+\.?\d*)\//);
  if (pathMatch) {
    return pathMatch[1];
  }

  return null;
}

/**
 * Determine the best version to use based on request and compatibility
 */
function negotiateVersion(requestedVersion: string | null): {
  version: APIVersion;
  isSupported: boolean;
  compatibleVersions: APIVersion[];
} {
  // If no version specified, use default
  if (!requestedVersion) {
    return {
      version: DEFAULT_VERSION,
      isSupported: true,
      compatibleVersions: VERSION_COMPATIBILITY[DEFAULT_VERSION]
    };
  }

  // Check if exact version is supported
  if (SUPPORTED_VERSIONS.includes(requestedVersion as APIVersion)) {
    const version = requestedVersion as APIVersion;
    return {
      version,
      isSupported: true,
      compatibleVersions: VERSION_COMPATIBILITY[version]
    };
  }

  // Try to find compatible version
  const numericRequested = parseFloat(requestedVersion);
  const compatibleVersion = SUPPORTED_VERSIONS
    .filter(v => parseFloat(v) >= numericRequested)
    .sort((a, b) => parseFloat(a) - parseFloat(b))[0];

  if (compatibleVersion) {
    return {
      version: compatibleVersion,
      isSupported: false, // Not exact match
      compatibleVersions: VERSION_COMPATIBILITY[compatibleVersion]
    };
  }

  // Fallback to latest version
  return {
    version: DEFAULT_VERSION,
    isSupported: false,
    compatibleVersions: VERSION_COMPATIBILITY[DEFAULT_VERSION]
  };
}

/**
 * Main API versioning middleware
 */
export function apiVersioningMiddleware(req: Request, res: Response, next: NextFunction): void {
  const versionedReq = req as VersionedRequest;
  
  // Extract requested version
  const requestedVersion = extractVersionFromRequest(req);
  
  // Negotiate best version
  const negotiation = negotiateVersion(requestedVersion);
  
  // Attach version information to request
  versionedReq.apiVersion = negotiation.version;
  versionedReq.requestedVersion = requestedVersion || undefined;
  versionedReq.isVersionSupported = negotiation.isSupported;
  versionedReq.compatibleVersions = negotiation.compatibleVersions;
  
  // Set response headers
  res.set({
    'X-API-Version': negotiation.version,
    'X-API-Supported-Versions': SUPPORTED_VERSIONS.join(', '),
    'X-API-Deprecated-Versions': getDeprecatedVersions().join(', ') || 'none'
  });

  // Add version warning if not exact match
  if (requestedVersion && !negotiation.isSupported) {
    res.set('X-API-Version-Warning', 
      `Requested version ${requestedVersion} not supported. Using ${negotiation.version} instead.`
    );
  }

  // Add deprecation warning for old versions
  if (isVersionDeprecated(negotiation.version)) {
    const deprecationInfo = getDeprecationInfo(negotiation.version);
    if (deprecationInfo) {
      res.set('X-API-Deprecation-Warning', 
        `Version ${negotiation.version} is deprecated. ${deprecationInfo.message}`
      );
    }
  }

  next();
}

/**
 * Version-specific route handler wrapper
 */
export function versionedRoute(
  versions: APIVersion[],
  handler: (req: VersionedRequest, res: Response, next: NextFunction) => void
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const versionedReq = req as VersionedRequest;
    
    // Check if current version is supported by this route
    if (!versions.includes(versionedReq.apiVersion)) {
      return res.status(400).json({
        error: {
          type: 'version_not_supported',
          title: 'API Version Not Supported',
          status: 400,
          detail: `This endpoint does not support API version ${versionedReq.apiVersion}. Supported versions: ${versions.join(', ')}`,
          supportedVersions: versions,
          currentVersion: versionedReq.apiVersion
        }
      });
    }

    return handler(versionedReq, res, next);
  };
}

/**
 * Response transformer based on API version
 */
export function transformResponse<T>(
  data: T,
  version: APIVersion,
  transformers?: Partial<Record<APIVersion, (data: T) => any>>
): any {
  // Apply version-specific transformations
  if (transformers && transformers[version]) {
    return transformers[version]!(data);
  }

  // Default: return data as-is for latest version
  return data;
}

/**
 * Version deprecation management
 */
interface DeprecationInfo {
  version: APIVersion;
  deprecatedSince: string;
  removalDate: string;
  message: string;
  migrationGuide?: string;
}

const DEPRECATION_SCHEDULE: DeprecationInfo[] = [
  {
    version: '1.0',
    deprecatedSince: '2025-01-01',
    removalDate: '2025-06-01',
    message: 'Please upgrade to version 2.0. See migration guide at /docs/migration/v1-to-v2',
    migrationGuide: '/docs/migration/v1-to-v2'
  }
];

function getDeprecatedVersions(): APIVersion[] {
  return DEPRECATION_SCHEDULE.map(d => d.version);
}

function isVersionDeprecated(version: APIVersion): boolean {
  return DEPRECATION_SCHEDULE.some(d => d.version === version);
}

function getDeprecationInfo(version: APIVersion): DeprecationInfo | null {
  return DEPRECATION_SCHEDULE.find(d => d.version === version) || null;
}

/**
 * Version-aware endpoint documentation
 */
export function getVersionInfo() {
  return {
    current: DEFAULT_VERSION,
    supported: SUPPORTED_VERSIONS,
    deprecated: DEPRECATION_SCHEDULE,
    compatibility: VERSION_COMPATIBILITY,
    negotiation: {
      methods: [
        'Accept header: application/vnd.edsteward.v{version}+json',
        'X-API-Version header: {version}',
        'Query parameter: ?version={version}',
        'URL path: /api/v{version}/...'
      ],
      precedence: [
        'Accept header (highest)',
        'X-API-Version header',
        'Query parameter',
        'URL path (lowest)'
      ]
    }
  };
}

/**
 * Utility middleware for version-specific features
 */
export function requireMinVersion(minVersion: APIVersion) {
  return (req: Request, res: Response, next: NextFunction) => {
    const versionedReq = req as VersionedRequest;
    const currentVersion = parseFloat(versionedReq.apiVersion);
    const requiredVersion = parseFloat(minVersion);

    if (currentVersion < requiredVersion) {
      return res.status(400).json({
        error: {
          type: 'version_too_old',
          title: 'API Version Too Old',
          status: 400,
          detail: `This feature requires API version ${minVersion} or higher. Current version: ${versionedReq.apiVersion}`,
          minimumVersion: minVersion,
          currentVersion: versionedReq.apiVersion,
          upgradeRequired: true
        }
      });
    }

    next();
  };
}

/**
 * Backward compatibility helpers
 */
export const VersionTransformers = {
  // Transform responses for v1.0 compatibility
  toV1: (data: any) => {
    // Remove fields that didn't exist in v1.0
    if (data && typeof data === 'object') {
      const v1Data = { ...data };
      delete v1Data.metadata;
      delete v1Data.version;
      delete v1Data.tags;
      return v1Data;
    }
    return data;
  },

  // Transform responses for v1.1 compatibility
  toV1_1: (data: any) => {
    // v1.1 has most v2.0 features but different date formats
    if (data && typeof data === 'object') {
      const v1_1Data = { ...data };
      // Convert ISO dates to simple date strings
      Object.keys(v1_1Data).forEach(key => {
        if (key.includes('Date') || key.includes('At')) {
          const dateValue = v1_1Data[key];
          if (dateValue && typeof dateValue === 'string') {
            v1_1Data[key] = dateValue.split('T')[0]; // Remove time component
          }
        }
      });
      return v1_1Data;
    }
    return data;
  }
};

// Export middleware for easy setup
export default apiVersioningMiddleware; 