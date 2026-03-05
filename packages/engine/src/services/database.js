/**
 * MCP Engine Database Service
 * 
 * Provides PostgreSQL connection pool and query utilities.
 * This is the single source of truth for database connections.
 */

import pg from 'pg';
const { Pool } = pg;

// Create connection pool with configuration from environment
const pool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: parseInt(process.env.MCP_DB_PORT) || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.MCP_DB_USER || process.env.USER, // Use current macOS user
  password: process.env.MCP_DB_PASSWORD || '', // No password for local dev
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log pool errors
pool.on('error', (err) => {
  console.error('[DATABASE] Unexpected pool error:', err);
});

// Track connection status
let isConnected = false;

// Test connection on startup
const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW() as time, current_database() as db');
    isConnected = true;
    console.log(`[DATABASE] ✅ Connected to PostgreSQL: ${result.rows[0].db}`);
    return true;
  } catch (err) {
    isConnected = false;
    console.error('[DATABASE] ❌ Connection failed:', err.message);
    return false;
  }
};

// Initialize connection
testConnection();

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (> 100ms)
    if (duration > 100) {
      console.log(`[DATABASE] Slow query (${duration}ms):`, text.substring(0, 100));
    }
    
    return result;
  } catch (err) {
    console.error('[DATABASE] Query error:', err.message);
    throw err;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<pg.PoolClient>}
 */
const getClient = () => pool.connect();

/**
 * Health check for the database
 * @returns {Promise<Object>}
 */
const healthCheck = async () => {
  try {
    const result = await pool.query(`
      SELECT 
        NOW() as time,
        current_database() as database,
        (SELECT COUNT(*) FROM regulations) as regulation_count,
        (SELECT COUNT(*) FROM regulation_audit_log) as audit_count
    `);
    return { 
      status: 'healthy', 
      ...result.rows[0],
      poolSize: pool.totalCount,
      poolIdle: pool.idleCount,
      poolWaiting: pool.waitingCount
    };
  } catch (err) {
    return { 
      status: 'unhealthy', 
      error: err.message 
    };
  }
};

/**
 * Get database statistics
 * @returns {Promise<Object>}
 */
const getStats = async () => {
  const result = await query(`
    SELECT
      (SELECT COUNT(*) FROM regulations WHERE is_current = TRUE) as total_regulations,
      (SELECT COUNT(*) FROM regulations WHERE jurisdiction_source = 'federal') as federal,
      (SELECT COUNT(*) FROM regulations WHERE jurisdiction_source = 'state') as state,
      (SELECT COUNT(*) FROM regulations WHERE state_code = 'PA') as pennsylvania,
      (SELECT COUNT(*) FROM regulations WHERE state_code = 'NJ') as new_jersey,
      (SELECT COUNT(*) FROM regulation_deadlines) as deadlines,
      (SELECT COUNT(*) FROM regulation_tasks) as tasks,
      (SELECT COUNT(*) FROM regulation_audit_log) as audit_entries,
      (SELECT COUNT(*) FROM transmission_log WHERE status = 'acknowledged') as transmissions_success,
      (SELECT COUNT(*) FROM transmission_log WHERE status = 'failed') as transmissions_failed
  `);
  return result.rows[0];
};

/**
 * Close the pool (for graceful shutdown)
 */
const close = async () => {
  await pool.end();
  console.log('[DATABASE] Connection pool closed');
};

export {
  pool,
  query,
  getClient,
  healthCheck,
  getStats,
  close,
  isConnected
};

export default {
  pool,
  query,
  getClient,
  healthCheck,
  getStats,
  close
};
