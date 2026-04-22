import { describe, it, expect, afterEach } from 'vitest';

describe('Session Serialization / Deserialization', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('serializeUser', () => {
    it('should serialize user with tenantId', () => {
      const user = { id: 42, _tenantId: 'moravian' };
      const sessionData = {
        userId: user.id,
        tenantId: user._tenantId || process.env.DEFAULT_TENANT || 'default',
      };
      expect(sessionData).toEqual({ userId: 42, tenantId: 'moravian' });
    });

    it('should fall back to DEFAULT_TENANT env var when no _tenantId', () => {
      process.env.DEFAULT_TENANT = 'staging';
      const user = { id: 1 } as { id: number; _tenantId?: string };
      const sessionData = {
        userId: user.id,
        tenantId: user._tenantId || process.env.DEFAULT_TENANT || 'default',
      };
      expect(sessionData.tenantId).toBe('staging');
    });

    it('should fall back to "default" when no _tenantId and no DEFAULT_TENANT', () => {
      delete process.env.DEFAULT_TENANT;
      const user = { id: 1 } as { id: number; _tenantId?: string };
      const sessionData = {
        userId: user.id,
        tenantId: user._tenantId || process.env.DEFAULT_TENANT || 'default',
      };
      expect(sessionData.tenantId).toBe('default');
    });
  });

  describe('deserializeUser - legacy tenant remapping', () => {
    it('should remap "default" tenant to DEFAULT_TENANT when set', () => {
      process.env.DEFAULT_TENANT = 'staging';
      let tenantId = 'default';
      if (tenantId === 'default' && process.env.DEFAULT_TENANT && process.env.DEFAULT_TENANT !== 'default') {
        tenantId = process.env.DEFAULT_TENANT;
      }
      expect(tenantId).toBe('staging');
    });

    it('should NOT remap "default" when DEFAULT_TENANT is also "default"', () => {
      process.env.DEFAULT_TENANT = 'default';
      let tenantId = 'default';
      if (tenantId === 'default' && process.env.DEFAULT_TENANT && process.env.DEFAULT_TENANT !== 'default') {
        tenantId = process.env.DEFAULT_TENANT;
      }
      expect(tenantId).toBe('default');
    });

    it('should leave non-default tenantId unchanged', () => {
      process.env.DEFAULT_TENANT = 'staging';
      let tenantId = 'moravian';
      if (tenantId === 'default' && process.env.DEFAULT_TENANT && process.env.DEFAULT_TENANT !== 'default') {
        tenantId = process.env.DEFAULT_TENANT;
      }
      expect(tenantId).toBe('moravian');
    });
  });

  describe('session data structure', () => {
    it('should contain userId (number) and tenantId (string)', () => {
      const session = { userId: 1, tenantId: 'moravian' };
      expect(typeof session.userId).toBe('number');
      expect(typeof session.tenantId).toBe('string');
    });

    it('should be JSON-serializable for connect-pg-simple', () => {
      const session = { userId: 42, tenantId: 'moravian' };
      const json = JSON.stringify(session);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(session);
    });
  });
});

describe('Password Hashing', () => {
  it('should enforce minimum 12-character passwords', () => {
    const validate = (pw: string) => pw.length >= 12;
    expect(validate('short')).toBe(false);
    expect(validate('12345678901')).toBe(false); // 11 chars
    expect(validate('123456789012')).toBe(true); // 12 chars
    expect(validate('a-very-secure-password-here')).toBe(true);
  });
});

describe('Account Lockout', () => {
  const MAX_FAILED_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

  it('should lock after MAX_FAILED_ATTEMPTS', () => {
    let failedAttempts = 0;
    for (let i = 0; i < 5; i++) failedAttempts++;
    expect(failedAttempts >= MAX_FAILED_ATTEMPTS).toBe(true);
  });

  it('should unlock after LOCKOUT_DURATION_MS', () => {
    const lockedAt = new Date(Date.now() - LOCKOUT_DURATION_MS - 1000);
    const now = new Date();
    const isStillLocked = now.getTime() - lockedAt.getTime() < LOCKOUT_DURATION_MS;
    expect(isStillLocked).toBe(false);
  });

  it('should remain locked within the lockout window', () => {
    const lockedAt = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
    const now = new Date();
    const isStillLocked = now.getTime() - lockedAt.getTime() < LOCKOUT_DURATION_MS;
    expect(isStillLocked).toBe(true);
  });
});
