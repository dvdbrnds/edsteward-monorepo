/**
 * Single-Tenant EdSteward Server
 * Simplified server without multi-tenant complexity
 */

import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);

let Sentry: any = null;
try {
  Sentry = _require('@sentry/node');
  if (process.env.SENTRY_DSN && Sentry?.init) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: `edsteward@${process.env.VERSION || '1.5.15'}`,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  }
} catch (err) {
  console.warn('[SENTRY] Failed to load @sentry/node — error tracking disabled:', (err as Error).message);
}

import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import passport from 'passport';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { setupWebSocketServer } from './websocket-server';
import { institutionConfig, validateConfig } from './config/institution';
import { configureAuth } from './auth/single-tenant-auth';
import { testConnection, getDbForRequest, pool as sharedPool } from './services/database';
import { registerRoutes } from './routes';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { startTaskScheduler } from './services/task-scheduler';
import { apiLimiter, authLimiter, tenantQuotaLimiter } from './middleware/rate-limiter';
import { tenantMiddleware } from './middleware/tenant';
import { tenantSessionVerificationMiddleware } from './middleware/session';
import { tenantRequestLogger, getAllTenantMetrics, getTopEndpoints } from './middleware/tenant-logger';
import { setupVite, serveStatic, log } from './vite';
import { initializeTenantRegistry, refreshAllTenants, getRegistryStats } from './services/tenant-registry';

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

// ES Module compatibility: Get current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Validate configuration on startup
try {
  validateConfig();
} catch (error) {
  console.error('❌ Configuration validation failed:', error);
  process.exit(1);
}

// Security middleware with proper CSP configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite dev server and some UI libraries
        "'unsafe-eval'",   // Required for Vite dev server HMR in development
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Tailwind and styled-components
      ],
      imgSrc: [
        "'self'",
        "data:",           // For inline images and icons
        "blob:",           // For generated images
        "https://www.okta.com", // Okta logo
        "https://*.okta.com",
      ],
      fontSrc: ["'self'", "data:"],
      connectSrc: [
        "'self'",
        "ws://localhost:*",    // WebSocket dev
        "wss://localhost:*",   // WebSocket dev secure
        "ws://*.edsteward.ai", // WebSocket production
        "wss://*.edsteward.ai", // WebSocket production secure
        "https://*.okta.com",  // Okta SSO
        "https://*.neon.tech", // Neon database (if direct connections needed)
      ],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  // Other helmet protections (all enabled by default)
  crossOriginEmbedderPolicy: false, // Disable for compatibility with external images
}));

// CORS configuration - support both development and production domains
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001', // Admin console
  'http://localhost:3002', // Admin console fallback port
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
// NOTE: sameSite must be 'none' for SAML callbacks (cross-origin POST from IdP)
// This requires secure: true (HTTPS) which is enforced in production
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  console.error('FATAL: SESSION_SECRET must be set in production');
  process.exit(1);
}

const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  pool: sharedPool as any,
  tableName: 'session',
  createTableIfMissing: true,
  pruneSessionInterval: 60 * 15, // prune expired sessions every 15 min
  errorLog: (err: Error) => {
    console.error('[SESSION-STORE] PostgreSQL session error:', err.message);
  },
});

app.use(session({
  store: sessionStore,
  secret: sessionSecret || 'dev-only-insecure-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Track user activity — updates last_active_at, throttled to once per 2 min per user
const activityThrottle = new Map<number, number>();
app.use((req: any, _res: any, next: any) => {
  if (req.user?.id && req.path.startsWith('/api/')) {
    const now = Date.now();
    const last = activityThrottle.get(req.user.id) || 0;
    if (now - last > 120_000) {
      activityThrottle.set(req.user.id, now);
      const db = getDbForRequest(req);
      db.update(users)
        .set({ lastActiveAt: new Date() })
        .where(eq(users.id, req.user.id))
        .execute()
        .catch(() => {});
    }
  }
  next();
});

// CRITICAL: Tenant detection middleware MUST run BEFORE authentication routes
// This sets req.tenant and req.tenantId based on subdomain
if (process.env.MULTI_TENANT === 'true') {
  console.log('🏢 Multi-tenant mode ENABLED - tenant routing active');
  app.use(tenantMiddleware);
  
  // CRITICAL SECURITY: Verify session tenant matches request tenant
  // Prevents cross-tenant session hijacking via shared cookies
  app.use(tenantSessionVerificationMiddleware);
  
  // Tenant registry initialization is batched in the listen callback via Promise.allSettled
} else {
  console.log('🏠 Single-tenant mode - using default database');
}

// Configure authentication AFTER tenant middleware so login routes have tenant context
configureAuth(app);

// Tenant-aware request logging (after tenant detection)
app.use(tenantRequestLogger);

// Rate limiting - apply to API routes
// Tenant-wide quota: 10,000 requests per hour per tenant
app.use('/api/', tenantQuotaLimiter);
// Per-IP within tenant: 200 requests per 15 minutes
app.use('/api/', apiLimiter);
// Stricter rate limit for authentication: 10 attempts per 15 minutes per tenant+IP
app.use('/api/login', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/authenticate', authLimiter);
app.use('/auth/saml', authLimiter);

// API routes
registerRoutes(app);

// Static files - only used in production mode
// In dev mode, Vite middleware handles this
if (!isDev) {
  app.use(express.static(path.join(__dirname, '../dist/public')));
}

// Serve MCP client script
app.get('/mcp-client.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/mcp-client.js'));
});

// MCP Engine Test Page
app.get('/mcp-test.html', (req, res) => {
  const testPageContent = `<!DOCTYPE html>
<html>
<head>
    <title>MCP Engine Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        .connecting { background: #fff3cd; color: #856404; }
        #messages { border: 1px solid #ccc; height: 300px; overflow-y: scroll; padding: 10px; }
        button { padding: 10px 20px; margin: 5px; }
    </style>
</head>
<body>
    <h1>🚀 MCP Engine WebSocket Test</h1>
    
    <div id="status" class="status disconnected">❌ Not Connected</div>
    
    <button onclick="connect()">Connect to MCP Engine</button>
    <button onclick="sendTest()">Send Test Update</button>
    <button onclick="clearMessages()">Clear Messages</button>
    
    <h3>Messages:</h3>
    <div id="messages"></div>
    
    <script>
        let ws = null;
        const statusDiv = document.getElementById('status');
        const messagesDiv = document.getElementById('messages');
        
        function addMessage(message, type = 'info') {
            const timestamp = new Date().toLocaleTimeString();
            const div = document.createElement('div');
            div.innerHTML = '<strong>' + timestamp + '</strong>: ' + message;
            div.style.color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'black';
            messagesDiv.appendChild(div);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        function connect() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                addMessage('Already connected!', 'info');
                return;
            }
            
            statusDiv.textContent = '🟡 Connecting to MCP Engine...';
            statusDiv.className = 'status connecting';
            addMessage('Attempting to connect to ws://localhost:3003/regulation-updates');
            
            ws = new WebSocket('ws://localhost:3003/regulation-updates');
            
            ws.onopen = function() {
                statusDiv.textContent = '✅ Connected to MCP Engine';
                statusDiv.className = 'status connected';
                addMessage('✅ Connected to MCP Engine WebSocket!', 'success');
                
                // Subscribe to REG-66
                const subscribeMessage = {
                    type: 'subscribe',
                    regulationIds: ['REG-66']
                };
                ws.send(JSON.stringify(subscribeMessage));
                addMessage('📋 Sent subscription for REG-66', 'success');
            };
            
            ws.onmessage = function(event) {
                const message = JSON.parse(event.data);
                addMessage('📥 Received: ' + JSON.stringify(message, null, 2), 'success');
                
                if (message.type === 'regulation_updated') {
                    addMessage('🚨 REGULATION UPDATE: ' + message.regulationId + ' version ' + message.version, 'success');
                }
            };
            
            ws.onclose = function(event) {
                statusDiv.textContent = '❌ Disconnected from MCP Engine';
                statusDiv.className = 'status disconnected';
                addMessage('❌ WebSocket connection closed. Code: ' + event.code, 'error');
            };
            
            ws.onerror = function(error) {
                statusDiv.textContent = '❌ WebSocket Error';
                statusDiv.className = 'status disconnected';
                addMessage('❌ WebSocket error: ' + JSON.stringify(error), 'error');
                addMessage('❌ Error details: ' + error.toString(), 'error');
                console.error('WebSocket error details:', error);
            };
        }
        
        function sendTest() {
            // Send a test update via HTTP to trigger WebSocket notification
            fetch('http://localhost:3003/api/simulate-change/REG-66', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    changeType: 'MANUAL_TEST',
                    mockData: {
                        impact: 'high',
                        message: 'Manual test from MCP test page'
                    }
                })
            })
            .then(response => response.json())
            .then(data => {
                addMessage('📤 Sent test update: ' + JSON.stringify(data), 'info');
            })
            .catch(error => {
                addMessage('❌ Failed to send test update: ' + error, 'error');
            });
        }
        
        function clearMessages() {
            messagesDiv.innerHTML = '';
        }
        
        // Auto-connect on page load
        window.onload = function() {
            addMessage('🚀 MCP Engine Test Page Loaded');
            addMessage('Click "Connect to MCP Engine" to start WebSocket connection');
        };
    </script>
</body>
</html>`;
  res.send(testPageContent);
});

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
  const { databaseHealthMonitor } = await import('./services/database-health');
  const dbStatus = await testConnection();
  const warming = databaseHealthMonitor.isWarming();

  const status = warming ? 'warming_up' : (dbStatus ? 'healthy' : 'degraded');

  res.json({
    status,
    database: dbStatus ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    institution: institutionConfig.name,
    warming,
  });
});

// Tenant Registry API - Dynamic tenant management
app.get('/api/admin/tenant-registry/status', (req, res) => {
  const stats = getRegistryStats();
  res.json({
    success: true,
    stats,
    tenantCount: stats.cachedTenants,
    tenants: [] // Simplified - full tenant list available via other endpoints
  });
});

app.post('/api/admin/tenant-registry/refresh', async (req, res) => {
  try {
    console.log('[TENANT-REGISTRY] Manual refresh triggered via API');
    await refreshAllTenants();
    const stats = getRegistryStats();
    res.json({
      success: true,
      message: 'Tenant registry refreshed successfully',
      stats
    });
  } catch (error) {
    console.error('[TENANT-REGISTRY] Refresh failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh tenant registry',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Tenant metrics endpoint (admin only)
app.get('/api/admin/tenant-metrics', (req, res) => {
  // Only allow in development or for authenticated admins
  const user = (req as any).user;
  if (process.env.NODE_ENV !== 'development' && (!user || user.role !== 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const metrics = getAllTenantMetrics();
  const tenantId = req.query.tenant as string;
  
  if (tenantId) {
    // Return metrics for specific tenant
    const tenantData = metrics[tenantId];
    if (!tenantData) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    return res.json({
      tenant: tenantId,
      metrics: {
        requests: tenantData.requests,
        errors: tenantData.errors,
        avgResponseTime: tenantData.avgResponseTime,
        lastRequest: tenantData.lastRequest,
        errorRate: tenantData.requests > 0 
          ? ((tenantData.errors / tenantData.requests) * 100).toFixed(2) + '%'
          : '0%',
      },
      topEndpoints: getTopEndpoints(tenantId, 10),
    });
  }
  
  // Return summary for all tenants
  const summary = Object.entries(metrics).map(([tenant, data]) => ({
    tenant,
    requests: data.requests,
    errors: data.errors,
    avgResponseTime: data.avgResponseTime,
    lastRequest: data.lastRequest,
    errorRate: data.requests > 0 
      ? ((data.errors / data.requests) * 100).toFixed(2) + '%'
      : '0%',
  }));
  
  res.json({
    tenants: summary,
    totalRequests: summary.reduce((sum, t) => sum + t.requests, 0),
    totalErrors: summary.reduce((sum, t) => sum + t.errors, 0),
  });
});

// Serve React app for all other routes - PRODUCTION ONLY
// In dev mode, Vite middleware handles this
if (!isDev) {
  app.get('*', (req, res) => {
    const htmlPath = path.join(__dirname, '../dist/public/index.html');
    
    // Read the HTML file and inject MCP client script
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // Inject MCP client script after title-setter script
    html = html.replace(
      '<script src="/title-setter.js"></script>',
      '<script src="/title-setter.js"></script>\n    \n    <!-- MCP Engine Integration - Real-time regulation updates -->\n    <script src="/mcp-client.js"></script>'
    );
    
    res.send(html);
  });
}

// Error handling — ordered: JSON parse errors, deserialization, then general API errors
import { jsonErrorHandler, deserializationErrorHandler, apiErrorHandler } from './middleware/error';
app.use(jsonErrorHandler);
app.use(deserializationErrorHandler);
app.use(apiErrorHandler);
if (process.env.SENTRY_DSN && Sentry?.setupExpressErrorHandler) {
  Sentry.setupExpressErrorHandler(app);
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create HTTP server with WebSocket support
const httpServer = createServer(app);

// Setup WebSocket server for MCP Engine integration
setupWebSocketServer(httpServer);

// Setup Vite dev server or static serving
async function setupFrontend() {
  if (isDev) {
    log("Setting up Vite development server with HMR...");
    try {
      await setupVite(app, httpServer);
      log("✅ Vite dev server ready - changes will hot reload!");
    } catch (error) {
      console.error("Error setting up Vite:", error);
      log("⚠️ Falling back to static serving");
      serveStatic(app);
    }
  } else {
    log("Production mode - serving static files from dist/public");
    serveStatic(app);
  }
}

// Start server
httpServer.listen(Number(PORT), '0.0.0.0', async () => {
  // Log the database user for diagnostics (helps debug auth issues)
  try {
    const client = await sharedPool.connect();
    const r = await client.query('SELECT current_user');
    console.log(`[STARTUP] Database pool connected as: ${r.rows[0]?.current_user}`);
    client.release();
  } catch (e) {
    console.error('[STARTUP] Database pool connection check failed:', (e as Error).message);
  }

  const isMultiTenant = process.env.MULTI_TENANT === 'true';

  const startupTasks: Array<{ name: string; task: Promise<void> }> = [
    { name: 'frontend', task: setupFrontend() },
  ];

  if (isMultiTenant) {
    startupTasks.push({
      name: 'tenant-registry',
      task: initializeTenantRegistry().then(() => {
        console.log('[TENANT-REGISTRY] ✅ Registry initialized successfully');
      }),
    });
  }

  const results = await Promise.allSettled(startupTasks.map(t => t.task));

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Startup task "${startupTasks[i].name}" failed:`, result.reason);
    }
  });

  startDatabaseMonitoring();
  startTaskScheduler();

  log(`🚀 Server running on port ${PORT} (${isDev ? 'development' : 'production'} mode)`);
});

// DATABASE MONITORING: Prevent database-related crashes
function startDatabaseMonitoring() {
  
  // Check database health every 30 seconds
  setInterval(async () => {
    try {
      await testConnection();
      // Connection is healthy, no action needed
    } catch (error) {
      console.warn('⚠️  Database health check failed:', error instanceof Error ? error.message : String(error));
      // Log the error but don't crash - the connection pool will handle reconnection
    }
  }, 30000); // 30 seconds
  
  
  // Monitor memory usage to prevent memory leaks
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    // Log memory usage every 5 minutes, warn if high
    if (memUsageMB.heapUsed > 500) { // Warn if heap usage > 500MB
      console.warn('⚠️  High memory usage detected:', memUsageMB);
    }
  }, 300000); // 5 minutes
  
}

// ERROR HANDLING: Log but don't crash on transient errors
process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', error.message);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('🚨 UNHANDLED REJECTION:', reason);
});

// GRACEFUL SHUTDOWN: Clean up on SIGTERM/SIGINT so the process actually exits
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 5000);

  try {
    httpServer.close();
    const { closeDatabaseConnections } = await import('./services/database');
    await closeDatabaseConnections();
  } catch (err) {
    console.error('Error during shutdown:', err);
  } finally {
    clearTimeout(forceExitTimer);
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
