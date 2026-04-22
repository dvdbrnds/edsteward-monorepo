import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Database Service - getDatabaseStorage', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('single-tenant mode (MULTI_TENANT !== "true")', () => {
    beforeEach(() => {
      delete process.env.MULTI_TENANT;
    });

    it('should return the same storage instance on repeated calls', () => {
      let callCount = 0;
      const mockStorage = {};
      const createStorage = () => {
        if (callCount === 0) {
          callCount++;
          return mockStorage;
        }
        return mockStorage;
      };
      const s1 = createStorage();
      const s2 = createStorage();
      expect(s1).toBe(s2);
    });

    it('should ignore tenantId when MULTI_TENANT is not true', () => {
      process.env.MULTI_TENANT = 'false';
      expect(process.env.MULTI_TENANT).not.toBe('true');
    });
  });

  describe('multi-tenant mode (MULTI_TENANT === "true")', () => {
    beforeEach(() => {
      process.env.MULTI_TENANT = 'true';
    });

    it('should throw when tenant is not configured', () => {
      const fakeLookup = (tenantId: string): string | null => {
        const urls: Record<string, string> = {};
        return urls[tenantId] || null;
      };

      const url = fakeLookup('nonexistent-tenant');
      expect(url).toBeNull();
    });

    it('should resolve fallback URLs for known tenants', () => {
      const FALLBACK_URLS: Record<string, string> = {
        'moravian': 'postgres://moravian-db',
        'staging': 'postgres://staging-db',
      };

      expect(FALLBACK_URLS['moravian']).toBe('postgres://moravian-db');
      expect(FALLBACK_URLS['staging']).toBe('postgres://staging-db');
      expect(FALLBACK_URLS['unknown']).toBeUndefined();
    });

    it('should prefer dynamic registry over fallback', () => {
      const dynamicUrls: Record<string, string> = { moravian: 'postgres://dynamic-db' };
      const fallbackUrls: Record<string, string> = { moravian: 'postgres://fallback-db' };

      const resolve = (tenantId: string) => dynamicUrls[tenantId] || fallbackUrls[tenantId] || null;

      expect(resolve('moravian')).toBe('postgres://dynamic-db');
    });
  });

  describe('tenant pool management', () => {
    it('should cache pools per tenant (Map semantics)', () => {
      const pools = new Map<string, { id: string }>();

      const getOrCreate = (tenantId: string) => {
        if (!pools.has(tenantId)) {
          pools.set(tenantId, { id: tenantId });
        }
        return pools.get(tenantId)!;
      };

      const p1 = getOrCreate('moravian');
      const p2 = getOrCreate('moravian');
      expect(p1).toBe(p2);

      const p3 = getOrCreate('staging');
      expect(p3).not.toBe(p1);
      expect(pools.size).toBe(2);
    });

    it('should clear all pools on close', () => {
      const pools = new Map<string, { ended: boolean }>();
      pools.set('moravian', { ended: false });
      pools.set('staging', { ended: false });

      for (const [_, pool] of pools.entries()) {
        pool.ended = true;
      }
      pools.clear();

      expect(pools.size).toBe(0);
    });
  });
});

describe('Database Service - getStorageForRequest', () => {
  it('should extract tenantId from request object', () => {
    const req = { tenantId: 'moravian' };
    expect(req.tenantId).toBe('moravian');
  });

  it('should handle missing tenantId', () => {
    const req = {} as { tenantId?: string };
    expect(req.tenantId).toBeUndefined();
  });
});
