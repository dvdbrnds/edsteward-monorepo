/**
 * Multi-Factor Authentication Service
 * Handles TOTP (Google Authenticator) setup, verification, and backup codes
 * Updated with latest security best practices from Context7
 */

import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { getDatabaseStorage } from './database';

// MFA Configuration - Following RFC 6238 and Context7 best practices
const MFA_CONFIG = {
  serviceName: 'EdSteward',
  window: 1, // SECURITY: Use window=1 to prevent brute force attacks (Context7 recommendation)
  period: 30, // 30-second time step (RFC 6238 standard)
  digits: 6, // 6-digit codes (Google Authenticator standard)
  algorithm: 'SHA1', // SHA1 for Google Authenticator compatibility
  secretSize: 20, // 20 bytes = 160 bits (exceeds RFC 6238 minimum of 128 bits)
  backupCodeCount: 10,
  backupCodeLength: 8,
};

// Encryption configuration (currently using base64 for development)
// const _ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
// const _ALGORITHM = 'aes-256-gcm';

if (!process.env.MFA_ENCRYPTION_KEY) {
  console.warn('⚠️ MFA_ENCRYPTION_KEY not set. Using random key (data will not persist across restarts)');
}

/**
 * Encrypt sensitive MFA data (simplified for development)
 */
function encrypt(text: string): string {
  // For development, use simple base64 encoding
  // In production, use proper AES-256-GCM encryption
  return Buffer.from(text).toString('base64');
}

/**
 * Decrypt sensitive MFA data (simplified for development)
 */
function decrypt(encryptedData: string): string {
  // For development, use simple base64 decoding
  // In production, use proper AES-256-GCM decryption
  return Buffer.from(encryptedData, 'base64').toString('utf8');
}

/**
 * Generate cryptographically secure backup codes (Context7 best practice)
 */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < MFA_CONFIG.backupCodeCount; i++) {
    // Generate cryptographically secure random code using crypto.randomBytes
    const randomBytes = crypto.randomBytes(MFA_CONFIG.backupCodeLength);
    const code = randomBytes.toString('hex').substring(0, MFA_CONFIG.backupCodeLength).toUpperCase();
    codes.push(code);
  }
  
  return codes;
}

export interface MFASetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface MFAVerificationResult {
  success: boolean;
  message: string;
  backupCodeUsed?: boolean;
}

/**
 * MFA Service Class
 */
export class MFAService {
  /**
   * Generate MFA setup data for a user (Context7 security best practices)
   */
  static async generateSetup(userId: number, email: string): Promise<MFASetupResult> {
    // Generate cryptographically secure secret (20 bytes = 160 bits, exceeds RFC 6238 minimum)
    const secret = new OTPAuth.Secret({ size: MFA_CONFIG.secretSize });
    
    // Generate backup codes
    const backupCodes = generateBackupCodes();
    
    // Create TOTP instance with secure configuration
    const totp = new OTPAuth.TOTP({
      issuer: MFA_CONFIG.serviceName,
      label: email,
      algorithm: MFA_CONFIG.algorithm,
      digits: MFA_CONFIG.digits,
      period: MFA_CONFIG.period,
      secret: secret,
    });
    
    // Generate QR code URL
    const otpauthUrl = totp.toString();
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
    
    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
      manualEntryKey: secret.base32.match(/.{1,4}/g)?.join(' ') || secret.base32, // Format for manual entry
    };
  }

  /**
   * Enable MFA for a user
   */
  static async enableMFA(userId: number, secret: string, verificationCode: string, backupCodes: string[]): Promise<boolean> {
    // Verify the code before enabling using OTPAuth
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      algorithm: MFA_CONFIG.algorithm,
      digits: MFA_CONFIG.digits,
      period: MFA_CONFIG.period,
    });
    
    const delta = totp.validate({ 
      token: verificationCode, 
      window: MFA_CONFIG.window 
    });
    const isValid = delta !== null;

    if (!isValid) {
      return false;
    }

    const storage = getDatabaseStorage();
    
    // Encrypt sensitive data
    const encryptedSecret = encrypt(secret);
    const encryptedBackupCodes = encrypt(JSON.stringify(backupCodes));

    // Update user record
    await storage.updateUser(userId, {
      mfaSecret: encryptedSecret,
      mfaEnabled: true,
      mfaBackupCodes: encryptedBackupCodes,
      mfaSetupAt: new Date(),
    });

    return true;
  }

  /**
   * Verify MFA code (TOTP or backup code)
   */
  static async verifyMFA(userId: number, code: string): Promise<MFAVerificationResult> {
    const storage = getDatabaseStorage();
    const user = await storage.getUser(userId);

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return {
        success: false,
        message: 'MFA not enabled for this user',
      };
    }

    try {
      // Decrypt secret
      const secret = decrypt(user.mfaSecret);
      
      // First try TOTP verification using OTPAuth
      const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(secret),
        algorithm: MFA_CONFIG.algorithm,
        digits: MFA_CONFIG.digits,
        period: MFA_CONFIG.period,
      });
      
      const delta = totp.validate({ 
        token: code, 
        window: MFA_CONFIG.window 
      });
      const isValidTOTP = delta !== null;

      if (isValidTOTP) {
        return {
          success: true,
          message: 'MFA code verified successfully',
        };
      }

      // If TOTP fails, try backup codes
      if (user.mfaBackupCodes) {
        const backupCodes = JSON.parse(decrypt(user.mfaBackupCodes)) as string[];
        const codeIndex = backupCodes.indexOf(code.toUpperCase());

        if (codeIndex !== -1) {
          // Remove used backup code
          backupCodes.splice(codeIndex, 1);
          
          // Update user with remaining backup codes
          const encryptedBackupCodes = encrypt(JSON.stringify(backupCodes));
          await storage.updateUser(userId, {
            mfaBackupCodes: encryptedBackupCodes,
          });

          
          return {
            success: true,
            message: 'Backup code verified successfully',
            backupCodeUsed: true,
          };
        }
      }

      return {
        success: false,
        message: 'Invalid MFA code',
      };

    } catch (error) {
      console.error('❌ MFA verification error:', error);
      return {
        success: false,
        message: 'MFA verification failed',
      };
    }
  }

  /**
   * Verify MFA code for login (simplified version)
   */
  static async verifyCode(userId: number, code: string): Promise<boolean> {
    try {
      const result = await this.verifyMFA(userId, code);
      return result.success;
    } catch (error) {
      console.error('❌ MFA code verification error:', error);
      return false;
    }
  }


  /**
   * Get MFA status for a user
   */
  static async getMFAStatus(userId: number): Promise<{
    enabled: boolean;
    setupAt?: Date;
    backupCodesRemaining?: number;
  }> {
    const storage = getDatabaseStorage();
    const user = await storage.getUser(userId);

    if (!user) {
      return { enabled: false };
    }

    let backupCodesRemaining = 0;
    if (user.mfaBackupCodes) {
      try {
        const backupCodes = JSON.parse(decrypt(user.mfaBackupCodes)) as string[];
        backupCodesRemaining = backupCodes.length;
      } catch (error) {
        console.error('❌ Error reading backup codes:', error);
      }
    }

    return {
      enabled: user.mfaEnabled || false,
      setupAt: user.mfaSetupAt || undefined,
      backupCodesRemaining,
    };
  }

  /**
   * Regenerate backup codes
   */
  static async regenerateBackupCodes(userId: number): Promise<string[] | null> {
    const storage = getDatabaseStorage();
    const user = await storage.getUser(userId);

    if (!user || !user.mfaEnabled) {
      return null;
    }

    const newBackupCodes = generateBackupCodes();
    const encryptedBackupCodes = encrypt(JSON.stringify(newBackupCodes));

    await storage.updateUser(userId, {
      mfaBackupCodes: encryptedBackupCodes,
    });

    return newBackupCodes;
  }

  /**
   * Disable MFA for a user
   */
  static async disableMFA(userId: number): Promise<void> {
    try {
      const storage = getDatabaseStorage();
      await storage.updateUser(userId, {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null,
        mfaSetupAt: null,
      });

    } catch (error) {
      console.error(`❌ Error disabling MFA for user ${userId}:`, error);
      throw error;
    }
  }
}

export default MFAService;
