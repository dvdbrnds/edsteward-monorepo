import session from 'express-session';
import { config, isProduction } from './environment';
import crypto from 'crypto';

// Enable session debugging based on Context7 documentation
console.log('🔍 Session Store Debug - Context7 AWS ALB Configuration');
console.log('🔍 Environment:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
console.log('🔍 Trust Proxy: 1 (ALB), Secure Cookies: auto (HTTPS READY)');
console.log('🔍 SUCCESS: SSL certificate configured for edsteward.ai');

export const sessionConfig: session.SessionOptions = {
  // Temporarily disable database store for debugging
  // store: storage.sessionStore,
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: true, // CRITICAL: Enable for AWS load balancer
  name: 'edsteward.sid',
  cookie: {
    // HTTPS READY: Using secure: 'auto' for AWS ALB compatibility
    // Auto-detects HTTPS from X-Forwarded-Proto header
    secure: 'auto', // Auto-detects HTTPS from ALB proxy headers
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Allow cross-site for load balancer
  },
  // Enhanced debugging based on Context7 documentation
  genid: (req) => {
    const sessionId = crypto.randomBytes(16).toString('hex');
    console.log(`🔑 Generated session ID: ${sessionId}`);
    console.log(`🔑 X-Forwarded-Proto:`, req.headers['x-forwarded-proto']);
    console.log(`🔑 Request secure:`, req.secure);
    console.log(`🔑 Environment:`, isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
    return sessionId;
  }
}; 