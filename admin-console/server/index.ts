/**
 * EdSteward Admin Console Backend
 * Standalone server for managing EdSteward customers
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

// Load environment variables FIRST
dotenv.config();
import { 
  customerTenants, 
  getTenantStats, 
  checkTenantHealth, 
  checkComprehensiveHealth,
  getTenantUsers,
  closeTenantConnections 
} from './config/database-connections.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.ADMIN_PORT || 4000;

// Create HTTP server and WebSocket server
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/deployment' });

// Track active deployment connections
const deploymentConnections = new Map<string, WebSocket[]>();

// WebSocket connection handling
wss.on('connection', (ws: WebSocket, req) => {
  console.log('New WebSocket connection for deployment monitoring');
  
  // Add connection to general deployment monitoring
  const generalConnections = deploymentConnections.get('general') || [];
  generalConnections.push(ws);
  deploymentConnections.set('general', generalConnections);

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    // Remove from all deployment tracking
    deploymentConnections.forEach((connections, key) => {
      const index = connections.indexOf(ws);
      if (index !== -1) {
        connections.splice(index, 1);
        if (connections.length === 0) {
          deploymentConnections.delete(key);
        }
      }
    });
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Security middleware
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

// CORS configuration for admin console frontend
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3002', 
    'https://admin.edsteward.ai'
  ],
  credentials: true,
}));

// Basic middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mock admin users (replace with proper auth system)
const adminUsers = [
  { id: 1, email: 'admin@edsteward.ai', password: 'admin123', name: 'EdSteward Admin' },
  { id: 2, email: 'support@edsteward.ai', password: 'support123', name: 'EdSteward Support' }
];

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = adminUsers.find(u => u.email === email && u.password === password);
  
  if (user) {
    const token = `admin-token-${user.id}-${Date.now()}`;
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && token.startsWith('admin-token-')) {
    const userId = parseInt(token.split('-')[2]);
    const user = adminUsers.find(u => u.id === userId);
    if (user) {
      res.json({ id: user.id, email: user.email, name: user.name });
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  } else {
    res.status(401).json({ error: 'No token provided' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Dashboard stats endpoint
app.get('/api/dashboard/stats', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !token.startsWith('admin-token-')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get real stats from all customer tenants
    const tenantStats = await Promise.all(
      customerTenants.map(async (tenant) => {
        const stats = await getTenantStats(tenant.id);
        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          ...stats
        };
      })
    );

    // Aggregate statistics
    const totalUsers = tenantStats.reduce((sum, stats) => sum + stats.userCount, 0);
    const totalRegulations = tenantStats.reduce((sum, stats) => sum + stats.regulationCount, 0);
    const totalCustomers = customerTenants.length;
    
    // Get recent activity from the most recent user registrations
    const recentActivity = tenantStats
      .filter(stats => stats.lastActivity)
      .sort((a, b) => {
        // Safe date comparison with null checks
        const dateA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const dateB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5)
      .map((stats, index) => ({
        id: index + 1,
        action: 'User registration',
        customer: stats.tenantName,
        timestamp: stats.lastActivity
      }));

    res.json({
      totalCustomers,
      activeUsers: totalUsers,
      totalRegulations,
      systemStatus: 'healthy',
      recentActivity,
      tenantBreakdown: tenantStats
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Customer management endpoints
app.get('/api/customers', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !token.startsWith('admin-token-')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get real customer data with comprehensive health checks
    const customersWithStats = await Promise.all(
      customerTenants.map(async (tenant) => {
        const stats = await getTenantStats(tenant.id);
        const comprehensiveHealth = await checkComprehensiveHealth(tenant.id, tenant.healthCheckUrl);
        
        return {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          status: comprehensiveHealth.status === 'healthy' ? tenant.status : 'unhealthy',
          userCount: stats.userCount,
          regulationCount: stats.regulationCount,
          lastActivity: stats.lastActivity,
          databaseHealth: comprehensiveHealth.database.database,
          applicationHealth: comprehensiveHealth.application?.applicationHealth || null,
          serverStatus: comprehensiveHealth.application?.serverStatus || null,
          healthCheckUrl: tenant.healthCheckUrl,
          healthDetails: {
            database: comprehensiveHealth.database,
            application: comprehensiveHealth.application,
            overall: comprehensiveHealth.overall
          },
          error: stats.error || comprehensiveHealth.database.error || comprehensiveHealth.application?.error
        };
      })
    );

    res.json(customersWithStats);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customer data' });
  }
});

// Get users across all tenants
app.get('/api/users', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !token.startsWith('admin-token-')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 100;
    
    // Get users from all tenants
    const allUsers = await Promise.all(
      customerTenants.map(async (tenant) => {
        const users = await getTenantUsers(tenant.id, limit);
        return users.map(user => ({
          ...user,
          tenantName: tenant.name
        }));
      })
    );

    // Flatten and sort by creation date
    const users = allUsers
      .flat()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Get detailed customer information
app.get('/api/customers/:customerId', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !token.startsWith('admin-token-')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { customerId } = req.params;
  
  try {
    const tenant = customerTenants.find(t => t.id === customerId);
    if (!tenant) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const [stats, health, users] = await Promise.all([
      getTenantStats(customerId),
      checkTenantHealth(customerId),
      getTenantUsers(customerId, 20)
    ]);

    res.json({
      ...tenant,
      stats,
      health,
      recentUsers: users,
      databaseUrl: tenant.databaseUrl ? '[CONFIGURED]' : '[NOT CONFIGURED]'
    });
  } catch (error) {
    console.error(`Error fetching customer ${customerId}:`, error);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// System health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'admin-console',
    version: '1.0.0'
  });
});

// Tenant Provisioning Endpoint - Enhanced ECS-Per-Customer
app.post('/api/tenants/provision', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !token.startsWith('admin-token-')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const tenantConfig = req.body;
    console.log('Starting tenant provisioning for:', tenantConfig.customerName);

    // Validate required fields
    const requiredFields = ['customerName', 'organizationDomain', 'contactEmail', 'awsRegion', 'awsAccountId', 'databaseUrl'];
    const missingFields = requiredFields.filter(field => !tenantConfig[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missingFields 
      });
    }

    // Generate deployment ID for tracking
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Start deployment process in background
    startTenantDeployment(deploymentId, tenantConfig);

    res.json({
      success: true,
      deploymentId,
      message: 'Tenant deployment started',
      tenantConfig: {
        customerName: tenantConfig.customerName,
        customerSubdomain: tenantConfig.customerSubdomain,
        clusterName: tenantConfig.clusterName,
        serviceName: tenantConfig.serviceName
      }
    });

  } catch (error) {
    console.error('Error starting tenant provisioning:', error);
    res.status(500).json({ error: 'Failed to start tenant provisioning' });
  }
});

// Enhanced deployment function with real-time monitoring
async function startTenantDeployment(deploymentId: string, tenantConfig: any) {
  const steps = [
    { id: 'vpc', name: 'Create VPC', script: 'create-vpc.sh' },
    { id: 'ecs', name: 'Create ECS Cluster', script: 'create-ecs-cluster.sh' },
    { id: 'rds', name: 'Setup Database', script: 'setup-database.sh' },
    { id: 'alb', name: 'Configure Load Balancer', script: 'setup-alb.sh' },
    { id: 'ecr', name: 'Create Container Registry', script: 'create-ecr.sh' },
    { id: 'task', name: 'Deploy Application', script: 'deploy-application.sh' },
    { id: 'dns', name: 'Configure DNS', script: 'setup-dns.sh' },
    { id: 'monitoring', name: 'Setup Monitoring', script: 'setup-monitoring.sh' }
  ];

  console.log(`[${deploymentId}] Starting deployment for ${tenantConfig.customerName}`);

  try {
    // Check if we're in test mode (for development)
    const fs = await import('fs');
    const isTestMode = process.env.NODE_ENV === 'development' || !fs.default.existsSync('../../customer-deployment-template/deploy-customer-isolated.sh');
    
    if (isTestMode) {
      console.log(`[${deploymentId}] Running in test mode - simulating deployment steps`);
      simulateDeployment(deploymentId, tenantConfig, steps);
      return;
    }

    // Use enhanced deploy-customer.sh script
    const deployScript = '../../customer-deployment-template/deploy-customer-isolated.sh';
    
    // Create customer configuration file
    const customerConfigPath = `/tmp/${tenantConfig.customerSubdomain}-config.json`;
    const customerConfig = {
      customer: {
        name: tenantConfig.customerName,
        domain: tenantConfig.organizationDomain,
        subdomain: tenantConfig.customerSubdomain,
        contact: {
          supportEmail: tenantConfig.contactEmail,
          adminEmail: tenantConfig.contactEmail,
          organizationUrl: tenantConfig.organizationUrl || ''
        }
      },
      aws: {
        region: tenantConfig.awsRegion,
        accountId: tenantConfig.awsAccountId,
        clusterName: tenantConfig.clusterName,
        serviceName: tenantConfig.serviceName,
        ecrRepository: tenantConfig.ecrRepository,
        logGroup: `/aws/ecs/${tenantConfig.serviceName}`
      },
      database: {
        type: tenantConfig.databaseType,
        connectionString: tenantConfig.databaseUrl,
        name: `${tenantConfig.customerSubdomain}_edsteward`
      },
      deployment: {
        dockerImage: `${tenantConfig.awsAccountId}.dkr.ecr.${tenantConfig.awsRegion}.amazonaws.com/${tenantConfig.ecrRepository}:latest`,
        taskDefinitionFamily: tenantConfig.serviceName,
        domainName: `${tenantConfig.customerSubdomain}.edsteward.ai`
      },
      branding: {
        primaryColor: tenantConfig.primaryColor,
        logoUrl: tenantConfig.logoUrl,
        faviconUrl: tenantConfig.faviconUrl
      },
      features: {
        maxUsers: tenantConfig.maxUsers,
        maxRegulations: tenantConfig.maxRegulations,
        samlEnabled: tenantConfig.samlEnabled,
        ssoProvider: tenantConfig.ssoProvider
      }
    };

    // Write config file
    fs.default.writeFileSync(customerConfigPath, JSON.stringify(customerConfig, null, 2));

    // Execute deployment script with enhanced logging
    const { spawn } = await import('child_process');
    const deployProcess = spawn('zsh', [deployScript, customerConfigPath], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    deployProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(`[${deploymentId}] STDOUT:`, output);
      
      // Parse output for step updates with better detection
      steps.forEach(step => {
        const stepKeywords = [
          step.name.toLowerCase(),
          step.id,
          `step ${steps.indexOf(step) + 1}`,
          step.name.split(' ').map(word => word.toLowerCase())
        ].flat();
        
        const outputLower = output.toLowerCase();
        const isStepActive = stepKeywords.some(keyword => outputLower.includes(keyword));
        
        if (isStepActive) {
          // Determine status from output
          let status = 'running';
          if (outputLower.includes('completed') || outputLower.includes('success') || outputLower.includes('done')) {
            status = 'completed';
          } else if (outputLower.includes('error') || outputLower.includes('failed') || outputLower.includes('failure')) {
            status = 'failed';
          }
          
          broadcastStepUpdate(deploymentId, step.id, status, output.trim());
        }
      });
    });

    deployProcess.stderr.on('data', (data: Buffer) => {
      const error = data.toString();
      console.error(`[${deploymentId}] STDERR:`, error);
    });

    deployProcess.on('close', (code: number) => {
      if (code === 0) {
        console.log(`[${deploymentId}] Deployment completed successfully`);
        broadcastDeploymentComplete(deploymentId, tenantConfig);
      } else {
        console.error(`[${deploymentId}] Deployment failed with code ${code}`);
        broadcastDeploymentFailed(deploymentId, `Process exited with code ${code}`);
      }
    });

  } catch (error) {
    console.error(`[${deploymentId}] Deployment error:`, error);
    broadcastDeploymentFailed(deploymentId, error instanceof Error ? error.message : String(error));
  }
}

// Simulate deployment for testing WebSocket functionality
async function simulateDeployment(deploymentId: string, tenantConfig: any, steps: any[]) {
  console.log(`[${deploymentId}] === STARTING DEPLOYMENT SIMULATION ===`);
  console.log(`[${deploymentId}] Customer: ${tenantConfig.customerName}`);
  console.log(`[${deploymentId}] Steps to process: ${steps.length}`);
  
  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`[${deploymentId}] Processing step ${i + 1}/${steps.length}: ${step.name}`);
      
      // Start step
      broadcastStepUpdate(deploymentId, step.id, 'running', `Starting ${step.name}...`);
      
      // Simulate work (2-4 seconds per step)
      const duration = 2000 + Math.random() * 2000;
      console.log(`[${deploymentId}] Step ${step.name} will take ${Math.round(duration)}ms`);
      await new Promise(resolve => setTimeout(resolve, duration));
      
      // Complete step
      broadcastStepUpdate(deploymentId, step.id, 'completed', `${step.name} completed successfully`);
      console.log(`[${deploymentId}] Step ${step.name} completed`);
    }
    
    console.log(`[${deploymentId}] All steps completed, sending final completion...`);
    
    // Complete deployment
    setTimeout(() => {
      broadcastDeploymentComplete(deploymentId, tenantConfig);
      console.log(`[${deploymentId}] === DEPLOYMENT SIMULATION COMPLETED ===`);
    }, 1000);
    
  } catch (error) {
    console.error(`[${deploymentId}] Error in deployment simulation:`, error);
    broadcastDeploymentFailed(deploymentId, error instanceof Error ? error.message : String(error));
  }
}

// WebSocket broadcasting functions
function broadcastStepUpdate(deploymentId: string, stepId: string, status: string, details: string) {
  console.log(`[${deploymentId}] Step ${stepId}: ${status} - ${details}`);
  
  const message = JSON.stringify({
    type: 'step_update',
    deploymentId,
    stepId,
    status,
    details,
    timestamp: new Date().toISOString()
  });

  // Broadcast to all connected clients
  const connections = deploymentConnections.get('general') || [];
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  });
}

function broadcastDeploymentComplete(deploymentId: string, tenantConfig: any) {
  console.log(`[${deploymentId}] Deployment completed for ${tenantConfig.customerName}`);
  
  const message = JSON.stringify({
    type: 'deployment_complete',
    deploymentId,
    customerName: tenantConfig.customerName,
    customerSubdomain: tenantConfig.customerSubdomain,
    deploymentUrl: `https://${tenantConfig.customerSubdomain}.edsteward.ai`,
    timestamp: new Date().toISOString()
  });

  const connections = deploymentConnections.get('general') || [];
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  });
}

function broadcastDeploymentFailed(deploymentId: string, error: string) {
  console.log(`[${deploymentId}] Deployment failed: ${error}`);
  
  const message = JSON.stringify({
    type: 'deployment_failed',
    deploymentId,
    error,
    timestamp: new Date().toISOString()
  });

  const connections = deploymentConnections.get('general') || [];
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  });
}

// Error handler middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Admin server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server with WebSocket support
server.listen(PORT, () => {
  console.log(`🚀 EdSteward Admin Console Backend running on port ${PORT}`);
  console.log(`🔐 Admin Authentication: Username/Password`);
  console.log(`🌐 Frontend should connect to: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket Deployment Monitoring: ws://localhost:${PORT}/ws/deployment`);
  console.log(`📊 Managing EdSteward customer tenants`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down admin console gracefully');
  await closeTenantConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down admin console gracefully');
  await closeTenantConnections();
  process.exit(0);
}); 