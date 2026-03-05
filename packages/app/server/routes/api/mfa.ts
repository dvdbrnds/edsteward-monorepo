/**
 * MFA (Multi-Factor Authentication) API Routes
 * Handles TOTP setup, verification, and backup code management
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/role-based-auth';
import { MFAService } from '../../services/mfa';
import { z } from 'zod';

const router = Router();

// Validation schemas
const setupMFASchema = z.object({
  verificationCode: z.string().length(6, 'Verification code must be 6 digits'),
});

const verifyMFASchema = z.object({
  code: z.string().min(6, 'MFA code must be at least 6 characters'),
});

const disableMFASchema = z.object({
  password: z.string().min(1, 'Password is required to disable MFA'),
  confirmDisable: z.boolean().refine(val => val === true, 'Must confirm MFA disable'),
});

/**
 * GET /api/mfa/status
 * Get MFA status for current user
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const status = await MFAService.getMFAStatus(userId);
    
    
    const response = {
      success: true,
      mfa: status,
    };
    
    
    res.json(response);
  } catch (error) {
    console.error('❌ Error getting MFA status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get MFA status',
    });
  }
});

/**
 * POST /api/mfa/setup/generate
 * Generate MFA setup data (QR code, secret, backup codes)
 */
router.post('/setup/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    
    // Check if MFA is already enabled
    const currentStatus = await MFAService.getMFAStatus(user.id);
    if (currentStatus.enabled) {
      return res.status(400).json({
        success: false,
        error: 'MFA is already enabled for this account',
      });
    }

    const setupData = await MFAService.generateSetup(user.id, user.email);
    
    // Store setup data in session temporarily (don't save to DB yet)
    req.session.mfaSetup = {
      secret: setupData.secret,
      backupCodes: setupData.backupCodes,
      userId: user.id,
      generatedAt: new Date(),
    };

    res.json({
      success: true,
      setup: {
        qrCodeUrl: setupData.qrCodeUrl,
        manualEntryKey: setupData.manualEntryKey,
        backupCodes: setupData.backupCodes,
      },
    });
  } catch (error) {
    console.error('❌ Error generating MFA setup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate MFA setup',
    });
  }
});

/**
 * POST /api/mfa/setup/verify
 * Verify setup and enable MFA
 */
router.post('/setup/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { verificationCode } = setupMFASchema.parse(req.body);
    const user = req.user!;
    
    // Get setup data from session
    const mfaSetup = req.session.mfaSetup;
    if (!mfaSetup || mfaSetup.userId !== user.id) {
      return res.status(400).json({
        success: false,
        error: 'No MFA setup in progress. Please generate setup first.',
      });
    }

    // Check if setup is not too old (15 minutes max)
    const setupAge = Date.now() - new Date(mfaSetup.generatedAt).getTime();
    if (setupAge > 15 * 60 * 1000) {
      delete req.session.mfaSetup;
      return res.status(400).json({
        success: false,
        error: 'MFA setup expired. Please generate a new setup.',
      });
    }

    // Enable MFA
    const success = await MFAService.enableMFA(
      user.id,
      mfaSetup.secret,
      verificationCode,
      mfaSetup.backupCodes
    );

    if (success) {
      // Clear setup data from session
      delete req.session.mfaSetup;
      
      res.json({
        success: true,
        message: 'MFA enabled successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid verification code. Please try again.',
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }
    
    console.error('❌ Error verifying MFA setup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify MFA setup',
    });
  }
});

/**
 * POST /api/mfa/verify
 * Verify MFA code during login
 */
router.post('/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = verifyMFASchema.parse(req.body);
    const userId = req.user!.id;
    
    const result = await MFAService.verifyMFA(userId, code);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        backupCodeUsed: result.backupCodeUsed,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }
    
    console.error('❌ Error verifying MFA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify MFA code',
    });
  }
});

/**
 * POST /api/mfa/disable
 * Disable MFA for the authenticated user
 */
router.post('/disable', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Disable MFA for the user
    await MFAService.disableMFA(userId);

    res.json({
      success: true,
      message: 'MFA has been disabled for your account',
    });
  } catch (error) {
    console.error('❌ Error disabling MFA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable MFA',
    });
  }
});

/**
 * POST /api/mfa/backup-codes/regenerate
 * Regenerate backup codes
 */
router.post('/backup-codes/regenerate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const newBackupCodes = await MFAService.regenerateBackupCodes(userId);
    
    if (newBackupCodes) {
      res.json({
        success: true,
        backupCodes: newBackupCodes,
        message: 'Backup codes regenerated successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'MFA not enabled or failed to regenerate codes',
      });
    }
  } catch (error) {
    console.error('❌ Error regenerating backup codes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate backup codes',
    });
  }
});

/**
 * POST /api/mfa/disable
 * Disable MFA for current user
 */
router.post('/disable', requireAuth, async (req: Request, res: Response) => {
  try {
    const { password } = disableMFASchema.parse(req.body);
    const user = req.user!;
    
    // Verify password before disabling MFA
    const { verifyPassword } = await import('../../auth');
    const isValidPassword = await verifyPassword(password, user.password);
    
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password',
      });
    }

    const success = await MFAService.disableMFA(user.id);
    
    if (success) {
      res.json({
        success: true,
        message: 'MFA disabled successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to disable MFA',
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }
    
    console.error('❌ Error disabling MFA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable MFA',
    });
  }
});

/**
 * DELETE /api/mfa/setup/cancel
 * Cancel MFA setup in progress
 */
router.delete('/setup/cancel', requireAuth, (req: Request, res: Response) => {
  try {
    delete req.session.mfaSetup;
    
    res.json({
      success: true,
      message: 'MFA setup cancelled',
    });
  } catch (error) {
    console.error('❌ Error cancelling MFA setup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel MFA setup',
    });
  }
});

export default router;
