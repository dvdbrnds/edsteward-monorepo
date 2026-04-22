import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function encrypt(text: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

function decrypt(encryptedData: string, key: Buffer): string {
  if (!encryptedData.includes(':')) {
    return Buffer.from(encryptedData, 'base64').toString('utf8');
  }
  const [ivHex, authTagHex, dataHex] = encryptedData.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex')) + decipher.final('utf8');
}

function generateBackupCodes(count = 10, length = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const randomBytes = crypto.randomBytes(length);
    codes.push(randomBytes.toString('hex').substring(0, length).toUpperCase());
  }
  return codes;
}

describe('MFA Encryption', () => {
  const testKey = crypto.randomBytes(32);

  describe('encrypt / decrypt round-trip', () => {
    it('should round-trip a simple string', () => {
      const plaintext = 'JBSWY3DPEHPK3PXP';
      const ciphertext = encrypt(plaintext, testKey);
      expect(decrypt(ciphertext, testKey)).toBe(plaintext);
    });

    it('should round-trip JSON (backup codes)', () => {
      const codes = ['ABCD1234', 'EFGH5678'];
      const json = JSON.stringify(codes);
      const ciphertext = encrypt(json, testKey);
      expect(JSON.parse(decrypt(ciphertext, testKey))).toEqual(codes);
    });

    it('should produce different ciphertext for the same plaintext (random IV)', () => {
      const plaintext = 'test-secret';
      const c1 = encrypt(plaintext, testKey);
      const c2 = encrypt(plaintext, testKey);
      expect(c1).not.toBe(c2);
      expect(decrypt(c1, testKey)).toBe(plaintext);
      expect(decrypt(c2, testKey)).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const ciphertext = encrypt('', testKey);
      expect(decrypt(ciphertext, testKey)).toBe('');
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Möravian Üniversity — 日本語';
      const ciphertext = encrypt(plaintext, testKey);
      expect(decrypt(ciphertext, testKey)).toBe(plaintext);
    });
  });

  describe('decrypt with wrong key', () => {
    it('should throw on wrong key', () => {
      const ciphertext = encrypt('secret', testKey);
      const wrongKey = crypto.randomBytes(32);
      expect(() => decrypt(ciphertext, wrongKey)).toThrow();
    });
  });

  describe('legacy base64 backward compatibility', () => {
    it('should decode a legacy base64 value (no colon separator)', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const legacy = Buffer.from(secret).toString('base64');
      expect(legacy).not.toContain(':');
      expect(decrypt(legacy, testKey)).toBe(secret);
    });
  });

  describe('ciphertext format', () => {
    it('should produce iv:authTag:data format', () => {
      const ciphertext = encrypt('test', testKey);
      const parts = ciphertext.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32); // 16-byte IV in hex
      expect(parts[1]).toHaveLength(32); // 16-byte auth tag in hex
      expect(parts[2].length).toBeGreaterThan(0);
    });
  });
});

describe('Backup Code Generation', () => {
  it('should generate the correct number of codes', () => {
    const codes = generateBackupCodes(10, 8);
    expect(codes).toHaveLength(10);
  });

  it('should generate codes of the correct length', () => {
    const codes = generateBackupCodes(5, 8);
    codes.forEach(code => {
      expect(code).toHaveLength(8);
    });
  });

  it('should generate uppercase hex codes', () => {
    const codes = generateBackupCodes(5, 8);
    codes.forEach(code => {
      expect(code).toMatch(/^[0-9A-F]{8}$/);
    });
  });

  it('should generate unique codes (with high probability)', () => {
    const codes = generateBackupCodes(10, 8);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(10);
  });
});
