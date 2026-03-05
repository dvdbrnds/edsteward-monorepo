import session from 'express-session';
import { config, isProduction } from './environment';
import { storage } from '../storage';
import crypto from 'crypto';

// CONTEXT7 SESSION FIX: Comprehensive session configuration for AWS ALB + PostgreSQL

/**
 * Context7 Best Practices for Express Session + AWS ALB:
 * 1. Use PostgreSQL session store for persistence
 * 2. Configure proper cookie settings for ALB
 * 3. Handle X-Forwarded-Proto headers correctly
 * 4. Implement rolling sessions for security
 * 5. Use secure session ID generation
 */
export const sessionConfig: session.SessionOptions = {
  // CRITICAL FIX: Re-enable PostgreSQL session store for persistence
  store: storage.sessionStore,
  
  // Use strong session secret (256-bit minimum)
  secret: config.SESSION_SECRET,
  
  // Context7 Best Practice: Don't resave unchanged sessions
  resave: false,
  
  // Context7 Security: Don't save uninitialized sessions (prevents session fixation)
  saveUninitialized: false,
  
  // Context7 Security: Rolling sessions - reset expiry on each request
  rolling: true,
  
  // Custom session name for security
  name: 'edsteward.sid',
  
  // Context7 AWS ALB Cookie Configuration
  cookie: {
    // CRITICAL AWS ALB FIX: Use 'auto' for secure cookies
    // This automatically detects HTTPS from X-Forwarded-Proto header
    secure: isProduction ? 'auto' : false,
    
    // Context7 Security: HTTP-only cookies prevent XSS
    httpOnly: true,
    
    // Context7 Best Practice: 24-hour session lifetime
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    
    // Context7 AWS ALB: 'lax' allows cross-site requests from load balancer
    sameSite: 'lax',
    
    // Context7 Security: Set domain for subdomain support
    domain: isProduction ? '.edsteward.ai' : undefined
  },
  
  // Context7 Best Practice: Custom session ID generation
  genid: (req) => {
    const sessionId = crypto.randomBytes(32).toString('hex'); // 256-bit session ID
    
    // Enhanced debugging for Context7 compliance
    if (!isProduction) {
    }
    
    return sessionId;
  }
}; 