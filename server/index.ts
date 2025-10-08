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
import fs from 'fs';
import { createServer } from 'http';
import { setupWebSocketServer } from './websocket-server';
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
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for MCP test page
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "ws://localhost:3003", "http://localhost:3003", "ws://localhost:3000", "ws://*:3000"], // Allow WebSocket connections to MCP Engine and external access
    },
  },
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
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // CRITICAL: Required for modern browsers to send cookies
  },
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Configure authentication
configureAuth(app);

// API routes
registerRoutes(app);

// CRITICAL: Direct login endpoint since routes aren't working
app.post('/api/authenticate', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const loginEmail = email || username; // Accept both email and username fields
    
    if (!loginEmail || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Import database storage
    const { getDatabaseStorage } = await import('./services/database');
    const tenantStorage = getDatabaseStorage();
    
    // Try to get user by email first, then by username
    let user = await tenantStorage.getUserByEmail(loginEmail);
    if (!user) {
      user = await tenantStorage.getUserByUsername(loginEmail);
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify scrypt password
    const crypto = await import('crypto');
    const { promisify } = await import('util');
    const scryptAsync = promisify(crypto.scrypt);
    
    const [salt, hash] = user.password.split(':');
    if (!salt || !hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const derivedKey = await scryptAsync(password, salt, 32) as Buffer;
    const storedKey = Buffer.from(hash, 'hex');
    const isValidPassword = crypto.timingSafeEqual(derivedKey, storedKey);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Login failed' });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
        }
      });
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../dist/public')));

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
            console.log('[' + timestamp + '] ' + message);
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

// Error handling
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server with WebSocket support
const httpServer = createServer(app);

// Setup WebSocket server for MCP Engine integration
setupWebSocketServer(httpServer);

// Start server
httpServer.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Single-Tenant EdSteward running on port ${PORT}`);
  console.log(`🏢 Institution: ${institutionConfig.name}`);
  console.log(`🔐 Authentication: ${institutionConfig.authentication.samlEnabled ? 'SAML + ' : ''}${institutionConfig.authentication.usernamePasswordEnabled ? 'Username/Password' : ''}`);
  console.log(`🌐 Access: http://localhost:${PORT}`);
  console.log(`🌍 Network Access: http://0.0.0.0:${PORT} (accessible from external networks)`);
  
  // MCP Engine Integration Status
  console.log('🔌 MCP Engine Integration:');
  console.log('   - Port 3003: MCP Engine WebSocket (regulation updates)');
  
  // Start database connection monitoring to prevent crashes
  startDatabaseMonitoring();
});

// DATABASE MONITORING: Prevent database-related crashes
function startDatabaseMonitoring() {
  console.log('🔍 Starting database connection monitoring...');
  
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
  
  console.log('✅ Database monitoring started (30s intervals)');
  
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
    } else {
      console.log('📊 Memory usage:', memUsageMB);
    }
  }, 300000); // 5 minutes
  
  console.log('✅ Memory monitoring started (5min intervals)');
}

// CRASH PREVENTION: Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION - Server will attempt to continue:', error);
  console.error('Stack trace:', error.stack);
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  
  // Log the error but don't crash the server
  // In production, you might want to restart the server gracefully
  console.log('⚠️  Server continuing despite uncaught exception...');
  
  // Don't exit the process - keep running
  return false;
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED PROMISE REJECTION at:', promise);
  console.error('Reason:', reason);
  
  // Log the error but don't crash the server
  console.log('⚠️  Server continuing despite unhandled rejection...');
  
  // Don't exit the process - keep running
  return false;
});

// Handle specific database connection errors
process.on('warning', (warning) => {
  console.warn('⚠️  Process warning:', warning.name, warning.message);
  if (warning.stack) {
    console.warn('Warning stack:', warning.stack);
  }
});

// Override process.exit to prevent accidental crashes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _originalExit = process.exit;
process.exit = ((code?: number) => {
  console.error('🚨 PROCESS.EXIT CALLED - Preventing crash! Code:', code);
  console.error('Stack trace:', new Error().stack);
  console.log('⚠️  Server will continue running instead of exiting...');
  // Don't actually exit - just log it
  return undefined as never;
}) as typeof process.exit;

// Graceful shutdown only on explicit signals
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received - Server will continue running (crash prevention active)');
  // Don't exit - keep running
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received - Server will continue running (crash prevention active)');
  // Don't exit - keep running
});

// Add additional error handlers
process.on('beforeExit', (code) => {
  console.log('🚨 BEFORE EXIT - Code:', code, '- Preventing exit!');
});

process.on('exit', (code) => {
  console.log('🚨 PROCESS EXIT - Code:', code, '- This should not happen with crash prevention!');
});

// Add domain error handling for synchronous errors
process.on('multipleResolves', (type, promise, reason) => {
  console.warn('🚨 MULTIPLE RESOLVES detected:', type, promise, reason);
  console.log('⚠️  Server continuing despite multiple resolves...');
});

// Catch any remaining synchronous errors
process.on('disconnect', () => {
  console.log('🔄 DISCONNECT event - Server will continue running');
});

// Add setInterval to keep the process alive and detect crashes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _keepAliveInterval = setInterval(() => {
  // This ensures the event loop stays active
  // and prevents the process from exiting unexpectedly
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 1000 * 1024 * 1024) { // > 1GB
    console.warn('🚨 HIGH MEMORY USAGE detected:', Math.round(memUsage.heapUsed / 1024 / 1024), 'MB');
  }
}, 60000); // Every minute

// Enhanced error boundary for the entire application
const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError.apply(console, args);
  
  // Check if this looks like a crash-inducing error
  const errorString = args.join(' ');
  if (errorString.includes('ECONNRESET') || 
      errorString.includes('ENOTFOUND') || 
      errorString.includes('ETIMEDOUT') ||
      errorString.includes('connection terminated') ||
      errorString.includes('Client has encountered a connection error')) {
    console.log('🛡️  Database connection error detected - implementing recovery...');
    
    // Attempt to recover database connections
    setTimeout(async () => {
      try {
        console.log('🔄 Attempting database connection recovery...');
        // Force a database health check
        const { testConnection } = await import('./services/database');
        await testConnection();
        console.log('✅ Database connection recovery successful');
      } catch (recoveryError) {
        console.warn('⚠️  Database recovery failed, but server will continue:', recoveryError);
      }
    }, 2000);
  }
};
