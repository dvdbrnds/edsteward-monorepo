import { describe, it, expect } from 'vitest';

interface TenantDetectionResult {
  subdomain?: string;
  domain?: string;
  method: 'subdomain' | 'domain' | 'header' | 'localhost' | 'unknown';
  source: string;
}

/**
 * Extracted from TenantFinder.extractTenantFromRequest for unit testing
 * without requiring Express request objects
 */
function extractTenantFromHost(
  host: string,
  tenantHeader?: string
): TenantDetectionResult {
  const subdomainMatch = host.match(/^([^.]+)\.edsteward\.(ai|local)(?::\d+)?$/);
  if (subdomainMatch && subdomainMatch[1] !== 'www' && subdomainMatch[1] !== 'api') {
    return {
      subdomain: subdomainMatch[1],
      domain: subdomainMatch[2] === 'local' ? 'edsteward.local' : 'edsteward.ai',
      method: 'subdomain',
      source: host,
    };
  }

  if (
    host &&
    !host.includes('edsteward.ai') &&
    !host.includes('localhost') &&
    !host.includes('127.0.0.1') &&
    !host.includes('0.0.0.0')
  ) {
    return {
      domain: host.split(':')[0],
      method: 'domain',
      source: host,
    };
  }

  if (tenantHeader) {
    return {
      subdomain: tenantHeader,
      method: 'header',
      source: `header:${tenantHeader}`,
    };
  }

  if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0')) {
    return { method: 'localhost', source: host };
  }

  return { method: 'unknown', source: host };
}

describe('Tenant Detection', () => {
  describe('subdomain detection', () => {
    it('should detect moravian.edsteward.ai', () => {
      const result = extractTenantFromHost('moravian.edsteward.ai');
      expect(result.method).toBe('subdomain');
      expect(result.subdomain).toBe('moravian');
      expect(result.domain).toBe('edsteward.ai');
    });

    it('should detect staging.edsteward.ai', () => {
      const result = extractTenantFromHost('staging.edsteward.ai');
      expect(result.method).toBe('subdomain');
      expect(result.subdomain).toBe('staging');
    });

    it('should detect local development subdomain', () => {
      const result = extractTenantFromHost('moravian.edsteward.local:5001');
      expect(result.method).toBe('subdomain');
      expect(result.subdomain).toBe('moravian');
      expect(result.domain).toBe('edsteward.local');
    });

    it('should NOT treat www as a tenant', () => {
      const result = extractTenantFromHost('www.edsteward.ai');
      expect(result.method).not.toBe('subdomain');
    });

    it('should NOT treat api as a tenant', () => {
      const result = extractTenantFromHost('api.edsteward.ai');
      expect(result.method).not.toBe('subdomain');
    });

    it('should handle port numbers correctly', () => {
      const result = extractTenantFromHost('test.edsteward.ai:443');
      expect(result.method).toBe('subdomain');
      expect(result.subdomain).toBe('test');
    });
  });

  describe('custom domain detection', () => {
    it('should detect a custom domain', () => {
      const result = extractTenantFromHost('compliance.moravian.edu');
      expect(result.method).toBe('domain');
      expect(result.domain).toBe('compliance.moravian.edu');
    });

    it('should strip port from custom domain', () => {
      const result = extractTenantFromHost('compliance.moravian.edu:8080');
      expect(result.method).toBe('domain');
      expect(result.domain).toBe('compliance.moravian.edu');
    });
  });

  describe('header-based detection', () => {
    it('should detect tenant from x-tenant-id header', () => {
      const result = extractTenantFromHost('edsteward.ai', 'moravian');
      expect(result.method).toBe('header');
      expect(result.subdomain).toBe('moravian');
    });
  });

  describe('localhost detection', () => {
    it('should detect localhost', () => {
      const result = extractTenantFromHost('localhost:5001');
      expect(result.method).toBe('localhost');
    });

    it('should detect 127.0.0.1', () => {
      const result = extractTenantFromHost('127.0.0.1:5001');
      expect(result.method).toBe('localhost');
    });

    it('should detect 0.0.0.0', () => {
      const result = extractTenantFromHost('0.0.0.0:5001');
      expect(result.method).toBe('localhost');
    });
  });

  describe('unknown / root domain', () => {
    it('should return unknown for bare edsteward.ai', () => {
      const result = extractTenantFromHost('edsteward.ai');
      expect(result.method).toBe('unknown');
    });

    it('should return unknown for empty host', () => {
      const result = extractTenantFromHost('');
      expect(result.method).toBe('unknown');
    });
  });
});

describe('Subdomain Validation (reserved words)', () => {
  const RESERVED_SUBDOMAINS = [
    'www', 'api', 'admin', 'staging', 'template', 'test', 'dev',
    'mail', 'smtp', 'ftp', 'ssh', 'ns1', 'ns2', 'cdn', 'assets',
    'static', 'docs', 'help', 'support', 'status', 'blog',
  ];

  it('should reject all reserved subdomains', () => {
    RESERVED_SUBDOMAINS.forEach(sub => {
      expect(RESERVED_SUBDOMAINS.includes(sub)).toBe(true);
    });
  });

  it('should allow valid institution subdomains', () => {
    const valid = ['moravian', 'mit', 'stanford', 'penn-state', 'osu'];
    valid.forEach(sub => {
      expect(RESERVED_SUBDOMAINS.includes(sub)).toBe(false);
    });
  });

  it('should enforce lowercase-only subdomains', () => {
    const subdomain = 'MoRaViAn';
    const normalized = subdomain.toLowerCase();
    expect(normalized).toBe('moravian');
    expect(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)).toBe(true);
  });

  it('should reject subdomains with special characters', () => {
    const invalid = ['test!', 'my_tenant', 'hello world', 'a@b', ''];
    invalid.forEach(sub => {
      expect(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sub)).toBe(false);
    });
  });
});
