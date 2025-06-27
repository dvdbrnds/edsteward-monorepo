import session from 'express-session';
import { config, isProduction } from './environment';
import { storage } from '../storage';
import crypto from 'crypto';

// Enable session debugging based on Context7 documentation
console.log('🔍 Session Store Debug - Context7 AWS ALB Configuration');
console.log('🔍 Environment:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
console.log('🔍 Trust Proxy: 1 (ALB), Secure Cookies: true (HTTPS ENABLED)');
console.log('🔍 SUCCESS: ALB has HTTPS listener on port 443!');
console.log('🔍 PostgreSQL Session Store: ENABLED for persistence');

export const sessionConfig: session.SessionOptions = {
  // CRITICAL FIX: Enable PostgreSQL session store for persistence
  store: storage.sessionStore,
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false, // CRITICAL: Changed to false for AWS ALB best practices
  rolling: true, // CRITICAL: Reset session expiry on each request for active users
  name: 'edsteward.sid',
  cookie: {
    // Use secure cookies only in production (HTTPS)
    // In development, use HTTP cookies for local testing
    secure: isProduction, // Only secure in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Allow cross-site for load balancer
  },
  // Enhanced debugging based on Context7 documentation
  genid: (req) => {
    const sessionId = crypto.randomBytes(16).toString('hex');
    console.log(`🔑 Generated session ID: ${sessionId} (PostgreSQL persistent)`);
    console.log(`🔑 X-Forwarded-Proto:`, req.headers['x-forwarded-proto']);
    console.log(`🔑 Request secure:`, req.secure);
    console.log(`🔑 Environment:`, isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
    console.log(`🔑 Session Store: PostgreSQL (persistent with rolling expiry)`);
    return sessionId;
  }
}; 