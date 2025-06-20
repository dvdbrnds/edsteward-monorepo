import pg from 'pg';
import { TenantConfig } from '../middleware/tenantDetection.js';

const { Pool } = pg;
type PoolType = InstanceType<typeof Pool>;
type PoolConfig = pg.PoolConfig;

// Simple logger if the config doesn't exist yet
const logger = {
  info: (message: string, meta?: any) => console.log('INFO:', message, meta || ''),
  error: (message: string, error?: any) => console.error('ERROR:', message, error || ''),
  warn: (message: string, meta?: any) => console.warn('WARN:', message, meta || ''),
  debug: (message: string, meta?: any) => console.debug('DEBUG:', message, meta || '')
};

// Database connection pool registry
const connectionPools: Map<string, PoolType> = new Map();

interface TenantDatabaseConfig extends PoolConfig {
  tenantId: string;
  database: string;
}

/**
 * Get database configuration for a tenant
 */
function getTenantDatabaseConfig(tenantConfig: TenantConfig): TenantDatabaseConfig {
  const baseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL_MODE === 'require' ? {
      rejectUnauthorized: false,
      ca: process.env.DB_SSL_CERT
    } : false,
    max: 10, // Maximum connections per tenant
    min: 1,  // Minimum connections per tenant
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  return {
    ...baseConfig,
    tenantId: tenantConfig.id,
    database: tenantConfig.database
  };
}

/**
 * Create a new database connection pool for a tenant
 */
async function createTenantPool(tenantConfig: TenantConfig): Promise<PoolType> {
  const config = getTenantDatabaseConfig(tenantConfig);
  
  logger.info(`Creating database pool for tenant: ${config.tenantId}`, {
    database: config.database,
    host: config.host
  });

  const pool = new Pool(config);

  // Test the connection
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info(`Database connection established for tenant: ${config.tenantId}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to connect to database for tenant: ${config.tenantId}`, errorMsg);
    throw error;
  }

  // Store the pool
  connectionPools.set(config.tenantId, pool);
  
  return pool;
}

/**
 * Get or create a database connection pool for a tenant
 */
export async function getTenantDatabase(tenantConfig: TenantConfig): Promise<PoolType> {
  const existingPool = connectionPools.get(tenantConfig.id);
  
  if (existingPool) {
    return existingPool;
  }

  return await createTenantPool(tenantConfig);
}

/**
 * Execute a query on a tenant's database
 */
export async function queryTenantDatabase(tenantConfig: TenantConfig, text: string, params?: any[]): Promise<any> {
  const pool = await getTenantDatabase(tenantConfig);
  
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Database query failed for tenant: ${tenantConfig.id}`, {
      query: text,
      error: errorMsg
    });
    throw error;
  }
}

/**
 * Get a database client for transaction handling
 */
export async function getTenantDatabaseClient(tenantConfig: TenantConfig) {
  const pool = await getTenantDatabase(tenantConfig);
  return await pool.connect();
}

/**
 * Create a new tenant database
 */
export async function createTenantDatabase(tenantConfig: TenantConfig): Promise<void> {
  // Connect to the main database to create the tenant database
  const mainPool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres', // Connect to postgres database to create new databases
    ssl: process.env.DB_SSL_MODE === 'require' ? {
      rejectUnauthorized: false,
      ca: process.env.DB_SSL_CERT
    } : false
  });

  try {
    // Create the database
    await mainPool.query(`CREATE DATABASE "${tenantConfig.database}"`);
    logger.info(`Created database for tenant: ${tenantConfig.id}`, {
      database: tenantConfig.database
    });

    // Run initial schema migrations
    await runTenantMigrations(tenantConfig);
    
  } catch (error: any) {
    if (error.code === '42P04') {
      // Database already exists
      logger.info(`Database already exists for tenant: ${tenantConfig.id}`);
    } else {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create database for tenant: ${tenantConfig.id}`, errorMsg);
      throw error;
    }
  } finally {
    await mainPool.end();
  }
}

/**
 * Run database migrations for a tenant
 */
export async function runTenantMigrations(tenantConfig: TenantConfig): Promise<void> {
  logger.info(`Running migrations for tenant: ${tenantConfig.id}`);
  
  try {
    const pool = await getTenantDatabase(tenantConfig);
    
    // Create basic tables (this would typically use a migration system)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        tenant_id VARCHAR(100) NOT NULL DEFAULT '${tenantConfig.id}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS regulations (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        source VARCHAR(255),
        effective_date DATE,
        tenant_id VARCHAR(100) NOT NULL DEFAULT '${tenantConfig.id}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS compliance_items (
        id SERIAL PRIMARY KEY,
        regulation_id INTEGER REFERENCES regulations(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date DATE,
        status VARCHAR(50) DEFAULT 'pending',
        assigned_to INTEGER REFERENCES users(id),
        tenant_id VARCHAR(100) NOT NULL DEFAULT '${tenantConfig.id}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for tenant isolation
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_regulations_tenant_id ON regulations(tenant_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_compliance_items_tenant_id ON compliance_items(tenant_id);`);

    logger.info(`Migrations completed for tenant: ${tenantConfig.id}`);
    
  } catch (error) {
    logger.error(`Migration failed for tenant: ${tenantConfig.id}`, error);
    throw error;
  }
}

/**
 * Close all database connections
 */
export async function closeAllConnections(): Promise<void> {
  logger.info('Closing all database connections');
  
  const closePromises = Array.from(connectionPools.values()).map(pool => pool.end());
  await Promise.all(closePromises);
  
  connectionPools.clear();
  logger.info('All database connections closed');
}

/**
 * Health check for all tenant databases
 */
export async function healthCheckTenantDatabases(): Promise<{ [tenantId: string]: boolean }> {
  const results: { [tenantId: string]: boolean } = {};
  
  connectionPools.forEach(async (pool, tenantId) => {
    try {
      await pool.query('SELECT 1');
      results[tenantId] = true;
    } catch (error) {
      logger.error(`Health check failed for tenant: ${tenantId}`, error);
      results[tenantId] = false;
    }
  });
  
  return results;
} 