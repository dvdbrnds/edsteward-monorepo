/**
 * EdSteward Admin Console Backend v2.0
 * Rebuilt from scratch with real database-backed tenant management
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';

import {
  initializeAdminDatabase,
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantStats,
  checkTenantHealth,
  getTenantUsers,
  closeAllConnections
} from './config/database-connections.js';

const app = express();
const PORT = process.env.ADMIN_PORT || 4000;
const server = createServer(app);

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
    },
  },
}));

app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3002',
    'https://admin.edsteward.ai'
  ],
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================================================
// AUTHENTICATION (Simple token-based for now)
// =============================================================================

// Admin users (TODO: Move to database with proper password hashing)
const adminUsers = [
  { id: 1, email: 'admin@edsteward.ai', password: 'admin123', name: 'EdSteward Admin', role: 'super_admin' },
  { id: 2, email: 'dvdbrnds@gmail.com', password: 'gabadh', name: 'David Brands', role: 'super_admin' }
];

// Token storage (in-memory for simplicity)
const activeTokens = new Map<string, { userId: number; expiresAt: Date }>();

function generateToken(userId: number): string {
  const token = `admin-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  activeTokens.set(token, {
    userId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  });
  return token;
}

function validateToken(token: string): number | null {
  const session = activeTokens.get(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) {
    activeTokens.delete(token);
    return null;
  }
  return session.userId;
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const userId = validateToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  (req as any).userId = userId;
  (req as any).user = adminUsers.find(u => u.id === userId);
  next();
}

// =============================================================================
// AUTH ROUTES
// =============================================================================

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = adminUsers.find(u => u.email === email && u.password === password);
  
  if (user) {
    const token = generateToken(user.id);
    console.log(`✅ Admin login: ${user.email}`);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } else {
    console.log(`❌ Failed login attempt: ${email}`);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = (req as any).user;
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) activeTokens.delete(token);
  res.json({ message: 'Logged out successfully' });
});

// =============================================================================
// DASHBOARD ROUTES
// =============================================================================

app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const tenants = await getAllTenants();
    
    // Get real stats from all active tenants
    const tenantsWithStats = await Promise.all(
      tenants.filter(t => t.status === 'active').map(async (tenant) => {
        const stats = await getTenantStats(tenant);
        return { tenant, stats };
      })
    );

    const totalUsers = tenantsWithStats.reduce((sum, t) => sum + t.stats.userCount, 0);
    const totalRegulations = tenantsWithStats.reduce((sum, t) => sum + t.stats.regulationCount, 0);

    res.json({
      totalCustomers: tenants.length,
      activeCustomers: tenants.filter(t => t.status === 'active').length,
      activeUsers: totalUsers,
      totalRegulations,
      systemStatus: 'healthy',
      tenantBreakdown: tenantsWithStats.map(t => ({
        tenantId: t.tenant.id,
        tenantName: t.tenant.name,
        ...t.stats
      }))
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// =============================================================================
// TENANT/CUSTOMER ROUTES
// =============================================================================

// List all tenants
app.get('/api/customers', requireAuth, async (req, res) => {
  try {
    const tenants = await getAllTenants();
    
    // Enrich with real-time stats and health
    const enrichedTenants = await Promise.all(
      tenants.map(async (tenant) => {
        const [stats, health] = await Promise.all([
          getTenantStats(tenant),
          checkTenantHealth(tenant)
        ]);

        return {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          status: health.overall === 'unhealthy' ? 'unhealthy' : tenant.status,
          plan: tenant.plan,
          deploymentType: tenant.deployment_type,
          contactEmail: tenant.contact_email,
          userCount: stats.userCount,
          regulationCount: stats.regulationCount,
          lastActivity: stats.lastActivity,
          healthCheckUrl: tenant.health_check_url,
          createdAt: tenant.created_at,
          health: {
            overall: health.overall,
            database: health.database,
            application: health.application
          },
          error: stats.error || health.database.error || health.application.error
        };
      })
    );

    res.json(enrichedTenants);
  } catch (error) {
    console.error('Fetch customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customer data' });
  }
});

// Get single tenant
app.get('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const [stats, health, users] = await Promise.all([
      getTenantStats(tenant),
      checkTenantHealth(tenant),
      getTenantUsers(tenant, 20)
    ]);

    res.json({
      ...tenant,
      database_url: '[HIDDEN]', // Don't expose connection string
      stats,
      health,
      recentUsers: users
    });
  } catch (error) {
    console.error('Fetch customer error:', error);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// Create new tenant
app.post('/api/customers', requireAuth, async (req, res) => {
  try {
    const { name, subdomain, database_url, contact_email, plan, deployment_type } = req.body;

    // Validate required fields
    if (!name || !subdomain || !database_url || !contact_email) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'subdomain', 'database_url', 'contact_email']
      });
    }

    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return res.status(400).json({ 
        error: 'Invalid subdomain format. Use only lowercase letters, numbers, and hyphens.'
      });
    }

    const tenant = await createTenant({
      name,
      subdomain,
      database_url,
      contact_email,
      plan: plan || 'starter',
      deployment_type: deployment_type || 'cloud',
      status: 'pending'
    });

    console.log(`✅ Created new tenant: ${tenant.name} (${tenant.subdomain})`);
    res.status(201).json(tenant);
  } catch (error: any) {
    console.error('Create tenant error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'A tenant with this subdomain already exists' });
    }
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// Update tenant
app.put('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const tenant = await updateTenant(req.params.id, req.body);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    console.log(`✅ Updated tenant: ${tenant.name}`);
    res.json(tenant);
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// Delete tenant
app.delete('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const success = await deleteTenant(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    console.log(`🗑️ Deleted tenant: ${req.params.id}`);
    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// Activate tenant
app.post('/api/customers/:id/activate', requireAuth, async (req, res) => {
  try {
    const tenant = await updateTenant(req.params.id, { status: 'active' });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    console.log(`✅ Activated tenant: ${tenant.name}`);
    res.json(tenant);
  } catch (error) {
    console.error('Activate tenant error:', error);
    res.status(500).json({ error: 'Failed to activate tenant' });
  }
});

// Check tenant health
app.get('/api/customers/:id/health', requireAuth, async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const health = await checkTenantHealth(tenant);
    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Failed to check tenant health' });
  }
});

// =============================================================================
// USER ROUTES (Cross-tenant)
// =============================================================================

app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const tenants = await getAllTenants();
    
    const allUsers = await Promise.all(
      tenants.filter(t => t.status === 'active').map(t => getTenantUsers(t, limit))
    );

    const users = allUsers
      .flat()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// =============================================================================
// SYSTEM ROUTES
// =============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'admin-console',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// ERROR HANDLER
// =============================================================================

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// =============================================================================
// STARTUP
// =============================================================================

async function startServer() {
  try {
    console.log('🚀 Starting EdSteward Admin Console v2.0...');
    
    // Initialize database
    await initializeAdminDatabase();
    console.log('✅ Database initialized');

    // Start server
    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║         EdSteward Admin Console v2.0                       ║
╠════════════════════════════════════════════════════════════╣
║  🌐 API Server:    http://localhost:${PORT}                   ║
║  🔐 Auth:          admin@edsteward.ai / admin123           ║
║  📊 Endpoints:     /api/customers, /api/dashboard/stats    ║
║  💾 Database:      Real tenant data from Neon              ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await closeAllConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await closeAllConnections();
  process.exit(0);
});

startServer();
