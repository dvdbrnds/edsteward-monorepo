import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { demoRequests } from '@shared/schema';
import { emailService } from '../../services/email';
import { eq, sql } from 'drizzle-orm';

const router = Router();

const ALLOWED_ORIGINS = [
  'https://edsteward.com',
  'https://www.edsteward.com',
];

if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3070');
}

function corsMiddleware(req: Request, res: Response, next: Function) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: Request, res: Response, next: Function) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const maxRequests = 5;

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + window });
    return next();
  }

  if (entry.count >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  entry.count++;
  next();
}

router.use(corsMiddleware);

router.post('/', rateLimit, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, institution, role, message } = req.body;

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !institution?.trim()) {
      return res.status(400).json({ error: 'First name, last name, email, and institution are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const [demoRequest] = await db.insert(demoRequests).values({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      institution: institution.trim(),
      role: role?.trim() || null,
      message: message?.trim() || null,
    }).returning();

    console.log(`[DemoRequests] New demo request #${demoRequest.id} from ${email} at ${institution}`);

    try {
      await emailService.sendEmail({
        to: 'david@edsteward.com',
        subject: `New Demo Request: ${firstName} ${lastName} — ${institution}`,
        html: `
          <h2>New Demo Request from edsteward.com</h2>
          <table style="border-collapse:collapse; font-family:sans-serif;">
            <tr><td style="padding:6px 12px; font-weight:bold;">Name</td><td style="padding:6px 12px;">${firstName} ${lastName}</td></tr>
            <tr><td style="padding:6px 12px; font-weight:bold;">Email</td><td style="padding:6px 12px;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:6px 12px; font-weight:bold;">Institution</td><td style="padding:6px 12px;">${institution}</td></tr>
            ${role ? `<tr><td style="padding:6px 12px; font-weight:bold;">Role</td><td style="padding:6px 12px;">${role}</td></tr>` : ''}
            ${message ? `<tr><td style="padding:6px 12px; font-weight:bold;">Message</td><td style="padding:6px 12px;">${message}</td></tr>` : ''}
          </table>
          <p style="margin-top:16px; color:#64748b; font-size:13px;">Submitted at ${new Date().toISOString()}</p>
        `,
      });
    } catch (emailErr) {
      console.error('[DemoRequests] Email notification failed (request still saved):', emailErr);
    }

    res.status(201).json({ success: true, message: 'Demo request received. We\'ll be in touch within one business day.' });
  } catch (error) {
    console.error('[DemoRequests] Error processing demo request:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again or email hello@edsteward.com.' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  if (!req.isAuthenticated?.() || !(req.user as any)?.isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const requests = await db
      .select()
      .from(demoRequests)
      .orderBy(sql`${demoRequests.createdAt} DESC`);

    res.json(requests);
  } catch (error) {
    console.error('[DemoRequests] Error fetching demo requests:', error);
    res.status(500).json({ error: 'Failed to fetch demo requests.' });
  }
});

export default router;
