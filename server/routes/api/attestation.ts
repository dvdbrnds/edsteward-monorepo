/**
 * Email Attestation API Routes
 * 
 * Handles one-click email attestation for low-risk regulations.
 * Field compliance officers can click a link in an email to attest
 * to compliance without logging into the system.
 */

import { Router, Request, Response } from 'express';
import { getDbForRequest } from '../../services/database';
import { attestationTokens, regulations, users } from '@shared/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import crypto from 'crypto';
import { emailService } from '../../services/email';
import { requireAuth, requireAdmin } from '../../middleware/role-based-auth';

const router = Router();

// Token validity period (14 days)
const TOKEN_VALIDITY_DAYS = 14;

/**
 * Generate a secure random token
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Get the base URL for attestation links
 */
function getBaseUrl(): string {
  return process.env.BASE_URL || process.env.VITE_API_URL || 'http://localhost:3000';
}

/**
 * POST /api/attestation/send
 * Send an attestation request email to a field officer
 * Requires admin authentication
 */
router.post('/send', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    const { 
      regulationId, 
      userId, 
      email: manualEmail,
      attestationType = 'quarterly',
      attestationStatement,
      attestationPeriod 
    } = req.body;

    // Validate required fields
    if (!regulationId || (!userId && !manualEmail) || !attestationStatement) {
      return res.status(400).json({ 
        error: 'Missing required fields: regulationId, (userId or email), attestationStatement' 
      });
    }

    // Get the regulation
    const regulation = await db.select().from(regulations).where(eq(regulations.id, regulationId)).limit(1);
    if (!regulation.length) {
      return res.status(404).json({ error: 'Regulation not found' });
    }

    let targetUser: { id: number; email: string; firstName?: string | null; lastName?: string | null; username: string } | null = null;
    let targetEmail: string;
    let targetUserId: number | null = null;

    if (userId) {
      // Get user from database
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) {
        return res.status(404).json({ error: 'User not found' });
      }
      targetUser = user[0];
      targetEmail = targetUser.email;
      targetUserId = targetUser.id;
    } else {
      // Use manual email - check if user exists with this email
      targetEmail = manualEmail;
      const existingUser = await db.select().from(users).where(eq(users.email, manualEmail)).limit(1);
      if (existingUser.length) {
        targetUser = existingUser[0];
        targetUserId = targetUser.id;
      }
    }

    if (!targetEmail) {
      return res.status(400).json({ error: 'No valid email address provided' });
    }

    const reg = regulation[0];

    // Check if regulation is eligible for email attestation
    // Only block if riskLevel is explicitly set to critical or high
    const riskLevel = (reg as any).riskLevel;
    if (riskLevel === 'critical' || riskLevel === 'high') {
      return res.status(400).json({ 
        error: 'High-risk and critical regulations cannot use email attestation. User must log in to attest.' 
      });
    }

    // Generate secure token
    const token = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_VALIDITY_DAYS);

    // Create attestation token record
    const [tokenRecord] = await db.insert(attestationTokens).values({
      token,
      regulationId,
      userId: targetUserId, // Can be null for manual email
      email: targetEmail, // Required target email
      attestationType,
      attestationStatement,
      attestationPeriod,
      expiresAt,
      sentBy: (req as any).user?.id,
    }).returning();

    // Generate attestation URL
    const attestationUrl = `${getBaseUrl()}/attest/${token}`;

    // Send email
    const emailSubject = `Action Required: ${reg.name} Compliance Attestation`;
    const recipientName = targetUser?.firstName || targetEmail.split('@')[0];
    const emailBody = generateAttestationEmailForRecipient(reg, recipientName, attestationStatement, attestationPeriod, attestationUrl);
    
    const emailSent = await emailService.sendEmail(targetEmail, emailSubject, emailBody);

    // Email already stored in token record, no need to update

    res.json({
      success: true,
      tokenId: tokenRecord.id,
      emailSent,
      expiresAt,
      attestationUrl, // Include for testing/admin purposes
    });

  } catch (error) {
    console.error('Error sending attestation request:', error);
    res.status(500).json({ error: 'Failed to send attestation request' });
  }
});

/**
 * GET /api/attestation/verify/:token
 * Verify a token and return the attestation details for the confirmation page
 * NO AUTHENTICATION REQUIRED - token is the auth
 */
router.get('/verify/:token', async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    const { token } = req.params;

    // Find the token
    const [tokenRecord] = await db.select()
      .from(attestationTokens)
      .where(eq(attestationTokens.token, token))
      .limit(1);

    if (!tokenRecord) {
      return res.status(404).json({ 
        error: 'Invalid attestation link',
        code: 'TOKEN_NOT_FOUND'
      });
    }

    // Check if already used
    if (tokenRecord.completedAt) {
      return res.status(400).json({ 
        error: 'This attestation has already been completed',
        code: 'TOKEN_ALREADY_USED',
        completedAt: tokenRecord.completedAt
      });
    }

    // Check if expired
    if (new Date() > tokenRecord.expiresAt) {
      return res.status(400).json({ 
        error: 'This attestation link has expired. Please contact your compliance administrator for a new link.',
        code: 'TOKEN_EXPIRED',
        expiredAt: tokenRecord.expiresAt
      });
    }

    // Get regulation details
    const [regulation] = await db.select()
      .from(regulations)
      .where(eq(regulations.id, tokenRecord.regulationId))
      .limit(1);

    // Get user details
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
      .from(users)
      .where(eq(users.id, tokenRecord.userId))
      .limit(1);

    res.json({
      valid: true,
      attestation: {
        regulationName: regulation?.name || 'Unknown Regulation',
        regulationId: tokenRecord.regulationId,
        statute: regulation?.statute,
        attestationType: tokenRecord.attestationType,
        attestationStatement: tokenRecord.attestationStatement,
        attestationPeriod: tokenRecord.attestationPeriod,
        expiresAt: tokenRecord.expiresAt,
        user: {
          email: user?.email,
          name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown User',
        }
      }
    });

  } catch (error) {
    console.error('Error verifying attestation token:', error);
    res.status(500).json({ error: 'Failed to verify attestation' });
  }
});

/**
 * POST /api/attestation/confirm/:token
 * Complete the attestation
 * NO AUTHENTICATION REQUIRED - token is the auth
 */
router.post('/confirm/:token', async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    const { token } = req.params;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const _userAgent = req.headers['user-agent'] || 'unknown';

    // Find and validate the token
    const [tokenRecord] = await db.select()
      .from(attestationTokens)
      .where(eq(attestationTokens.token, token))
      .limit(1);

    if (!tokenRecord) {
      return res.status(404).json({ 
        error: 'Invalid attestation link',
        code: 'TOKEN_NOT_FOUND'
      });
    }

    // Check if already used
    if (tokenRecord.completedAt) {
      return res.status(400).json({ 
        error: 'This attestation has already been completed',
        code: 'TOKEN_ALREADY_USED',
        completedAt: tokenRecord.completedAt
      });
    }

    // Check if expired
    if (new Date() > tokenRecord.expiresAt) {
      return res.status(400).json({ 
        error: 'This attestation link has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Get user info for the action record
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, tokenRecord.userId))
      .limit(1);

    // Get the regulation to update its actions
    const [regulation] = await db.select()
      .from(regulations)
      .where(eq(regulations.id, tokenRecord.regulationId))
      .limit(1);

    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }

    // Mark token as used
    const completedAt = new Date();
    await db.update(attestationTokens)
      .set({
        completedAt: completedAt,
        completedByIp: String(clientIp),
        completedByName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined,
        completedByEmail: user?.email,
      })
      .where(eq(attestationTokens.id, tokenRecord.id));

    // Update the regulation's attestation action to completed
    const actions = (regulation.actions as any[]) || [];
    const updatedActions = actions.map(action => {
      if (action.type === 'attestation') {
        return {
          ...action,
          status: 'completed',
          completedDate: completedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          completedBy: {
            userId: user?.id,
            username: user?.username || user?.email,
            fullName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined,
          },
          notes: `Completed via email attestation. Period: ${tokenRecord.attestationPeriod || 'N/A'}. IP: ${clientIp}`,
        };
      }
      return action;
    });

    // Update the regulation
    await db.update(regulations)
      .set({ actions: updatedActions })
      .where(eq(regulations.id, tokenRecord.regulationId));

    // Log the attestation

    res.json({
      success: true,
      completedAt,
      regulation: {
        id: regulation.id,
        name: regulation.name,
      },
      attestedBy: user?.email,
    });

  } catch (error) {
    console.error('Error confirming attestation:', error);
    res.status(500).json({ error: 'Failed to complete attestation' });
  }
});

/**
 * GET /api/attestation/pending
 * Get all pending attestation tokens (admin view)
 */
router.get('/pending', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    const pendingTokens = await db.select({
      id: attestationTokens.id,
      regulationId: attestationTokens.regulationId,
      userId: attestationTokens.userId,
      attestationType: attestationTokens.attestationType,
      attestationPeriod: attestationTokens.attestationPeriod,
      expiresAt: attestationTokens.expiresAt,
      emailSentAt: attestationTokens.emailSentAt,
      emailSentTo: attestationTokens.emailSentTo,
      createdAt: attestationTokens.createdAt,
    })
      .from(attestationTokens)
      .where(
        and(
          isNull(attestationTokens.completedAt),
          gt(attestationTokens.expiresAt, new Date())
        )
      );

    res.json({ pendingTokens });
  } catch (error) {
    console.error('Error fetching pending attestations:', error);
    res.status(500).json({ error: 'Failed to fetch pending attestations' });
  }
});

/**
 * GET /api/attestation/history/:regulationId
 * Get attestation history for a regulation
 */
router.get('/history/:regulationId', requireAuth, async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    const regulationId = parseInt(req.params.regulationId);
    
    const history = await db.select({
      id: attestationTokens.id,
      attestationType: attestationTokens.attestationType,
      attestationPeriod: attestationTokens.attestationPeriod,
      attestationStatement: attestationTokens.attestationStatement,
      createdAt: attestationTokens.createdAt,
      emailSentAt: attestationTokens.emailSentAt,
      emailSentTo: attestationTokens.emailSentTo,
      completedAt: attestationTokens.completedAt,
      expiresAt: attestationTokens.expiresAt,
    })
      .from(attestationTokens)
      .where(eq(attestationTokens.regulationId, regulationId))
      .orderBy(attestationTokens.createdAt);

    res.json({ history });
  } catch (error) {
    console.error('Error fetching attestation history:', error);
    res.status(500).json({ error: 'Failed to fetch attestation history' });
  }
});

/**
 * DELETE /api/attestation/:tokenId
 * Revoke/cancel a pending attestation token (admin only)
 */
router.delete('/:tokenId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    const tokenId = parseInt(req.params.tokenId);
    
    await db.delete(attestationTokens)
      .where(eq(attestationTokens.id, tokenId));

    res.json({ success: true, message: 'Attestation token revoked' });
  } catch (error) {
    console.error('Error revoking attestation token:', error);
    res.status(500).json({ error: 'Failed to revoke attestation token' });
  }
});

/**
 * Generate HTML email content for attestation request
 */
function generateAttestationEmailForRecipient(
  regulation: any, 
  recipientName: string, 
  attestationStatement: string,
  attestationPeriod: string | undefined,
  attestationUrl: string
): string {
  const firstName = recipientName;
  const periodText = attestationPeriod ? ` for ${attestationPeriod}` : '';
  
  return `
Dear ${firstName},

You are receiving this email because you are the designated Directly Responsible Individual (DRI) for the following regulation:

REGULATION: ${regulation.name}
${regulation.statute ? `STATUTE: ${regulation.statute}` : ''}
PERIOD: ${attestationPeriod || 'Current Period'}

ATTESTATION REQUIRED:
${attestationStatement}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To confirm compliance${periodText}, please click the link below:

${attestationUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT NOTICE:
By clicking the confirmation link, you are attesting that:

1. You have reviewed the compliance requirements for ${regulation.name}
2. Your department/area is in compliance with all applicable requirements
3. You understand that this attestation will be recorded and may be subject to audit
4. You are authorized to make this attestation on behalf of your area of responsibility

This attestation link will expire in 14 days.

If you have any questions or believe you received this email in error, please contact your Chief Compliance Officer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an automated message from EdSteward Compliance Management System.
Do not reply to this email.
`.trim();
}

export default router;

