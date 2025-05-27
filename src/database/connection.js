/**
 * PostgreSQL database connection module with tenant isolation
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { setupLogger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = setupLogger('database');

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  user: process.env.PG_USER || 'app_user',
  password: process.env.PG_PASSWORD || 'app_password',
  database: process.env.PG_DATABASE || 'regulations',
  max: 20, // Max connections in pool
  idleTimeoutMillis: 30000
};

// Create connection pool
const pool = new pg.Pool(pgConfig);

// Handle pool events
pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected database error', err);
});

/**
 * Execute a query with tenant isolation
 * @param {string} text SQL query text
 * @param {Array} params Query parameters
 * @param {string} tenantId Tenant ID for isolation
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params = [], tenantId = null) {
  const client = await pool.connect();
  
  try {
    // Set tenant context if provided
    if (tenantId) {
      await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
      logger.debug(`Set tenant context: ${tenantId}`);
    }
    
    // Execute the query
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug(`Executed query`, {
      query: text,
      duration,
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    logger.error(`Query error: ${error.message}`, {
      query: text,
      params
    });
    throw error;
  } finally {
    // Reset tenant context and release client back to pool
    if (tenantId) {
      await client.query(`SELECT set_config('app.tenant_id', '', false)`);
    }
    client.release();
  }
}

/**
 * Execute a transaction with tenant isolation
 * @param {Function} callback Transaction function that receives client
 * @param {string} tenantId Tenant ID for isolation
 * @returns {Promise<any>} Transaction result
 */
export async function transaction(callback, tenantId = null) {
  const client = await pool.connect();
  
  try {
    // Set tenant context if provided
    if (tenantId) {
      await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
      logger.debug(`Set tenant context: ${tenantId}`);
    }
    
    // Start transaction
    await client.query('BEGIN');
    
    // Execute transaction callback
    const result = await callback(client);
    
    // Commit transaction
    await client.query('COMMIT');
    
    return result;
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error(`Transaction error: ${error.message}`);
    throw error;
  } finally {
    // Reset tenant context and release client back to pool
    if (tenantId) {
      await client.query(`SELECT set_config('app.tenant_id', '', false)`);
    }
    client.release();
  }
}

/**
 * Get a regulation by ID with tenant isolation
 * @param {string} regId Regulation ID
 * @param {string} tenantId Tenant ID
 * @returns {Promise<Object>} Regulation object
 */
export async function getRegulation(regId, tenantId) {
  if (!regId || !tenantId) {
    throw new Error('Regulation ID and tenant ID are required');
  }
  
  const result = await query(
    'SELECT * FROM regulations WHERE reg_id = $1',
    [regId],
    tenantId
  );
  
  return result.rows[0];
}

/**
 * Insert or update a regulation with tenant isolation
 * @param {Object} regulation Regulation object
 * @param {string} tenantId Tenant ID
 * @returns {Promise<Object>} Inserted or updated regulation
 */
export async function upsertRegulation(regulation, tenantId) {
  if (!regulation.reg_id || !tenantId) {
    throw new Error('Regulation ID and tenant ID are required');
  }
  
  const { reg_id, title, revision, payload } = regulation;
  
  return transaction(async (client) => {
    // Check if regulation exists
    const checkResult = await client.query(
      'SELECT id FROM regulations WHERE reg_id = $1 AND tenant_id = $2',
      [reg_id, tenantId]
    );
    
    let result;
    
    if (checkResult.rowCount === 0) {
      // Insert new regulation
      result = await client.query(
        `INSERT INTO regulations 
         (tenant_id, reg_id, title, revision, payload) 
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [tenantId, reg_id, title, revision, payload]
      );
      
      logger.info(`Inserted new regulation: ${reg_id}`, { tenantId });
    } else {
      // Update existing regulation
      result = await client.query(
        `UPDATE regulations 
         SET title = $1, revision = $2, payload = $3, updated_at = NOW()
         WHERE reg_id = $4 AND tenant_id = $5
         RETURNING *`,
        [title, revision, payload, reg_id, tenantId]
      );
      
      logger.info(`Updated regulation: ${reg_id}`, { tenantId });
    }
    
    return result.rows[0];
  }, tenantId);
}

/**
 * Close the database pool
 */
export async function closePool() {
  logger.info('Closing database connection pool');
  await pool.end();
}

// Export pool for advanced use cases
export { pool }; 