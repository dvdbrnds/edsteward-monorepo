## EdSteward API Rate Limiting Implementation (January 2026)

Implemented rate limiting using `express-rate-limit` in `server/middleware/rate-limiter.ts`:

**Rate Limiters:**
```typescript
// General API: 100 requests per 15 minutes
export const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

// Authentication: 5 requests per 15 minutes (skip if authenticated)
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

// Password Reset: 3 requests per hour
export const passwordResetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3 });

// File Uploads: 20 requests per hour
export const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });

// Admin Operations: 50 requests per 15 minutes
export const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });

// Burst Protection: 10 requests per minute
export const burstLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
```

**Applied in `server/index.ts`:**
```typescript
app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/authenticate', authLimiter);
app.use('/auth/saml', authLimiter);
```

**Upload routes** use `uploadLimiter` in regulations.ts, uploads.ts, compliance-tasks.ts.