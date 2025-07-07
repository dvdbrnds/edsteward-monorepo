/**
 * Single-Tenant EdSteward Server
 * Simplified server without multi-tenant complexity
 */

import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { institutionConfig, validateConfig } from './config/institution';
import { configureAuth } from './auth/single-tenant-auth';
import { testConnection } from './services/database';
import { registerRoutes } from './routes';

// ES Module compatibility: Get current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Validate configuration on startup
try {
  validateConfig();
  console.log('✅ Configuration validated successfully');
} catch (error) {
  console.error('❌ Configuration validation failed:', error);
  process.exit(1);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration - support both development and production domains
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'https://moravian.edsteward.ai',
  'https://edsteward.ai'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Basic middleware
// Disable Brotli compression to fix production transfer issues
app.use(compression({
  filter: (req, res) => {
    // Only use gzip compression, avoid Brotli which causes transfer failures
    const acceptEncoding = req.headers['accept-encoding'];
    if (acceptEncoding && typeof acceptEncoding === 'string') {
      req.headers['accept-encoding'] = acceptEncoding.replace(/,?\s*br\s*/g, '');
    }
    return compression.filter(req, res);
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Configure authentication
configureAuth(app);

// API routes
registerRoutes(app);

// Serve static files
app.use(express.static(path.join(__dirname, '../dist/public')));

// Institution configuration endpoint
app.get('/api/config', (req, res) => {
  // Return public configuration (no secrets)
  res.json({
    institution: {
      name: institutionConfig.name,
      domain: institutionConfig.domain,
      branding: institutionConfig.branding,
    },
    authentication: {
      samlEnabled: institutionConfig.authentication.samlEnabled,
      usernamePasswordEnabled: institutionConfig.authentication.usernamePasswordEnabled,
      allowSelfRegistration: institutionConfig.authentication.allowSelfRegistration,
    },
    features: institutionConfig.features,
  });
});

// Health check
app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: 'ok',
    database: dbStatus ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    institution: institutionConfig.name,
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Single-Tenant EdSteward running on port ${PORT}`);
  console.log(`🏢 Institution: ${institutionConfig.name}`);
  console.log(`🔐 Authentication: ${institutionConfig.authentication.samlEnabled ? 'SAML + ' : ''}${institutionConfig.authentication.usernamePasswordEnabled ? 'Username/Password' : ''}`);
  console.log(`🌐 Access: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
