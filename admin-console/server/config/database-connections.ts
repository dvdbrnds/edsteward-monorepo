/**
 * Customer Database Connection Manager
 * Handles connections to different customer tenant databases
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory and load environment variables from correct path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// Customer tenant database configurations
export interface CustomerTenantConfig {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'maintenance';
  databaseUrl: string;
  healthCheckUrl?: string;
}

// Define customer tenant configurations
export const customerTenants: CustomerTenantConfig[] = [
  {
    id: 'moravian',
    name: 'Moravian University',
    subdomain: 'moravian',
    status: 'active',
    databaseUrl: process.env.DATABASE_URL || '',
    healthCheckUrl: 'https://moravian.edsteward.ai/api/health'
  },
  {
    id: 'test',
    name: 'Test University',
    subdomain: 'test',
    status: 'active',
    databaseUrl: process.env.DATABASE_URL || '',
    healthCheckUrl: 'http://localhost:3000/api/health'
  },
  {
    id: 'beta',
    name: 'Beta University', 
    subdomain: 'beta',
    status: 'active',
    databaseUrl: process.env.DATABASE_URL || '',
    healthCheckUrl: 'http://localhost:3000/api/health'
  }
];

// Database connection pools for each tenant
const connectionPools = new Map<string, Pool>();

/**
 * Get database connection pool for a specific tenant
 */
export function getTenantDatabasePool(tenantId: string): Pool {
  if (connectionPools.has(tenantId)) {
    return connectionPools.get(tenantId)!;
  }

  const tenant = customerTenants.find(t => t.id === tenantId);
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  console.log(`Creating connection pool for tenant ${tenantId}:`);
  console.log(`Database URL: ${tenant.databaseUrl ? '[SET]' : '[NOT SET]'}`);
  console.log(`URL includes neon.tech: ${tenant.databaseUrl.includes('neon.tech')}`);
  
  const pool = new Pool({
    connectionString: tenant.databaseUrl,
    ssl: tenant.databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false,
    max: 5, // Limit connections per tenant
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  connectionPools.set(tenantId, pool);
  return pool;
}

/**
 * Execute query on a specific tenant database
 */
export async function queryTenantDatabase(tenantId: string, query: string, params: any[] = []) {
  const pool = getTenantDatabasePool(tenantId);
  
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error(`Database query error for tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Get comprehensive tenant statistics including real user activity tracking
 */
export async function getTenantStats(tenantId: string) {
  try {
    const [usersResult, regulationsResult, lastActivityResult] = await Promise.all([
      queryTenantDatabase(tenantId, 'SELECT COUNT(*) as count FROM users'),
      queryTenantDatabase(tenantId, 'SELECT COUNT(*) as count FROM regulations'),
      getRealLastActivity(tenantId)
    ]);

    return {
      userCount: parseInt(usersResult.rows[0]?.count || '0'),
      regulationCount: parseInt(regulationsResult.rows[0]?.count || '0'),
      lastActivity: lastActivityResult
    };
  } catch (error) {
    console.error(`Error getting stats for tenant ${tenantId}:`, error);
    return {
      userCount: 0,
      regulationCount: 0,
      lastActivity: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get real user activity from multiple sources to find the most recent activity
 */
async function getRealLastActivity(tenantId: string): Promise<string | null> {
  try {
    // Check multiple activity sources and find the most recent timestamp
    const activityQueries = [
      // Last login (most reliable activity indicator)
      queryTenantDatabase(tenantId, `
        SELECT last_login as activity_time, 'user_login' as activity_type
        FROM users 
        WHERE last_login IS NOT NULL 
        ORDER BY last_login DESC 
        LIMIT 1
      `),
      
      // System logs for user activities (login, regulation views, etc.)
      queryTenantDatabase(tenantId, `
        SELECT timestamp as activity_time, 'system_log' as activity_type
        FROM system_logs 
        WHERE structured_data->>'userId' IS NOT NULL
        ORDER BY timestamp DESC 
        LIMIT 1
      `),
      
      // Recent user sessions
      queryTenantDatabase(tenantId, `
        SELECT expire as activity_time, 'active_session' as activity_type
        FROM session 
        WHERE expire > NOW()
        ORDER BY expire DESC 
        LIMIT 1
      `),
      
      // Recent notes created/updated
      queryTenantDatabase(tenantId, `
        SELECT GREATEST(created_at, updated_at) as activity_time, 'note_activity' as activity_type
        FROM notes 
        ORDER BY GREATEST(created_at, updated_at) DESC 
        LIMIT 1
      `),
      
      // Recent comments
      queryTenantDatabase(tenantId, `
        SELECT created_at as activity_time, 'comment_activity' as activity_type
        FROM comments 
        ORDER BY created_at DESC 
        LIMIT 1
      `),
      
      // Recent evidence file uploads
      queryTenantDatabase(tenantId, `
        SELECT uploaded_at as activity_time, 'file_upload' as activity_type
        FROM evidence_files 
        ORDER BY uploaded_at DESC 
        LIMIT 1
      `)
    ];

    // Execute all queries in parallel
    const results = await Promise.allSettled(activityQueries);
    
    // Collect all valid timestamps
    const allActivities: Array<{timestamp: Date, type: string}> = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.rows.length > 0) {
        const row = result.value.rows[0];
        if (row.activity_time) {
          allActivities.push({
            timestamp: new Date(row.activity_time),
            type: row.activity_type
          });
        }
      }
    });

    // Find the most recent activity
    if (allActivities.length === 0) {
      // Fallback to most recent user creation if no activity found
      const fallbackResult = await queryTenantDatabase(tenantId, `
        SELECT created_at as activity_time
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      
      return fallbackResult.rows[0]?.activity_time || null;
    }

    // Sort by timestamp and return the most recent
    allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const mostRecentActivity = allActivities[0];
    
    console.log(`[${tenantId}] Most recent activity: ${mostRecentActivity.type} at ${mostRecentActivity.timestamp.toISOString()}`);
    
    return mostRecentActivity.timestamp.toISOString();
    
  } catch (error) {
    console.error(`Error getting real last activity for tenant ${tenantId}:`, error);
    
    // Fallback to simple user creation query if complex activity tracking fails
    try {
      const fallbackResult = await queryTenantDatabase(tenantId, `
        SELECT created_at FROM users ORDER BY created_at DESC LIMIT 1
      `);
      return fallbackResult.rows[0]?.created_at || null;
    } catch (fallbackError) {
      console.error(`Fallback activity query also failed for tenant ${tenantId}:`, fallbackError);
      return null;
    }
  }
}

/**
 * Check health of a tenant's database connection
 */
export async function checkTenantHealth(tenantId: string) {
  try {
    const result = await queryTenantDatabase(tenantId, 'SELECT 1 as health');
    return {
      status: 'healthy',
      database: true,
      responseTime: Date.now()
    };
  } catch (error) {
    return {
      status: 'unhealthy', 
      database: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now()
    };
  }
}

/**
 * Check application health by calling the health endpoint
 */
export async function checkApplicationHealth(healthCheckUrl: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(healthCheckUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'EdSteward-Admin-Console/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const healthData = await response.json();
      return {
        status: 'healthy',
        applicationHealth: true,
        serverStatus: healthData.server || 'unknown',
        databaseStatus: healthData.database || {},
        tenantInfo: healthData.tenant || {},
        responseTime: Date.now(),
        fullHealthData: healthData
      };
    } else {
      return {
        status: 'unhealthy',
        applicationHealth: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime: Date.now()
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      applicationHealth: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now()
    };
  }
}

/**
 * Comprehensive health check combining database and application health
 */
export async function checkComprehensiveHealth(tenantId: string, healthCheckUrl?: string) {
  const dbHealth = await checkTenantHealth(tenantId);
  
  let appHealth = null;
  if (healthCheckUrl) {
    appHealth = await checkApplicationHealth(healthCheckUrl);
  }
  
  // Determine overall status
  const dbHealthy = dbHealth.status === 'healthy';
  const appHealthy = !appHealth || appHealth.status === 'healthy';
  const overallHealthy = dbHealthy && appHealthy;
  
  return {
    status: overallHealthy ? 'healthy' : 'unhealthy',
    database: dbHealth,
    application: appHealth,
    overall: {
      healthy: overallHealthy,
      databaseConnected: dbHealthy,
      applicationResponding: appHealthy,
      hasErrors: !!(dbHealth.error || appHealth?.error)
    }
  };
}

/**
 * Get users from a specific tenant
 */
export async function getTenantUsers(tenantId: string, limit: number = 50) {
  try {
    const result = await queryTenantDatabase(
      tenantId,
      'SELECT id, email, username, "firstName", "lastName", role, department, created_at, last_login FROM users ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    
    return result.rows.map(user => ({
      id: user.id,
      email: user.email,
      username: user.username,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      role: user.role,
      department: user.department,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      tenantId
    }));
  } catch (error) {
    console.error(`Error getting users for tenant ${tenantId}:`, error);
    return [];
  }
}

/**
 * Cleanup database connections
 */
export async function closeTenantConnections() {
  for (const [tenantId, pool] of connectionPools) {
    try {
      await pool.end();
      console.log(`Closed database connection for tenant: ${tenantId}`);
    } catch (error) {
      console.error(`Error closing connection for tenant ${tenantId}:`, error);
    }
  }
  connectionPools.clear();
} 