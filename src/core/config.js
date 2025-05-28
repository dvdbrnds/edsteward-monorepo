/**
 * Centralized Configuration Management
 * Loads and validates environment variables and application settings
 */
import dotenv from 'dotenv';
import { setupLogger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

const logger = setupLogger('config');

/**
 * Application configuration with validation
 */
export const config = {
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Server settings
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost'
  },
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'compliance_llm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000
  },
  
  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3
  },
  
  // Kafka configuration
  kafka: {
    brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
    groupId: process.env.KAFKA_GROUP_ID || 'compliance-llm-group',
    clientId: process.env.KAFKA_CLIENT_ID || 'compliance-llm-client'
  },
  
  // Security settings
  security: {
    allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3050'],
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    rateLimitEnabled: process.env.ENABLE_RATE_LIMIT === 'true',
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000 // 15 minutes
  },
  
  // Feature flags
  features: {
    cdcEnabled: process.env.ENABLE_CDC === 'true',
    workerEnabled: process.env.ENABLE_WORKER === 'true',
    debugMode: process.env.DEBUG_MODE === 'true',
    metricsEnabled: process.env.ENABLE_METRICS === 'true'
  },
  
  // LLM Gateway settings
  llmGateway: {
    port: parseInt(process.env.LLM_GATEWAY_PORT) || 3002,
    maxConcurrentQueries: parseInt(process.env.MAX_CONCURRENT_QUERIES) || 10,
    queryTimeoutMs: parseInt(process.env.QUERY_TIMEOUT_MS) || 30000
  },
  
  // Batch processing settings
  batch: {
    port: parseInt(process.env.BATCH_PORT) || 3001,
    maxJobsPerBatch: parseInt(process.env.MAX_JOBS_PER_BATCH) || 100,
    batchTimeoutMs: parseInt(process.env.BATCH_TIMEOUT_MS) || 300000 // 5 minutes
  },
  
  // File paths
  paths: {
    regulationsFile: process.env.REGULATIONS_FILE || 'compmat.csv',
    logsDir: process.env.LOGS_DIR || 'logs',
    tempDir: process.env.TEMP_DIR || 'tmp',
    registryFile: process.env.REGISTRY_FILE || 'regulation-servers-registry.json'
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFile: process.env.LOG_FILE === 'true'
  }
};

/**
 * Validate required configuration
 */
export function validateConfig() {
  const requiredEnvVars = [
    'DB_HOST',
    'DB_NAME',
    'DB_USER'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    logger.warn(`Missing environment variables: ${missing.join(', ')}`);
    logger.warn('Using default values. For production, please set these variables.');
  }
  
  // Validate numeric values
  if (isNaN(config.server.port) || config.server.port < 1 || config.server.port > 65535) {
    throw new Error('Invalid PORT: must be a number between 1 and 65535');
  }
  
  if (isNaN(config.database.port) || config.database.port < 1 || config.database.port > 65535) {
    throw new Error('Invalid DB_PORT: must be a number between 1 and 65535');
  }
  
  logger.info('Configuration validated successfully');
}

/**
 * Get configuration for a specific service
 */
export function getServiceConfig(serviceName) {
  const serviceConfigs = {
    'app': {
      port: config.server.port,
      enableRateLimit: config.security.rateLimitEnabled,
      enableCdc: config.features.cdcEnabled,
      enableWorker: config.features.workerEnabled
    },
    'llm-gateway': {
      port: config.llmGateway.port,
      maxConcurrentQueries: config.llmGateway.maxConcurrentQueries,
      queryTimeoutMs: config.llmGateway.queryTimeoutMs
    },
    'batch-server': {
      port: config.batch.port,
      maxJobsPerBatch: config.batch.maxJobsPerBatch,
      batchTimeoutMs: config.batch.batchTimeoutMs
    }
  };
  
  return serviceConfigs[serviceName] || {};
}

/**
 * Display current configuration (safe for logging)
 */
export function displayConfig() {
  const safeConfig = {
    ...config,
    database: {
      ...config.database,
      password: config.database.password ? '***' : undefined
    },
    security: {
      ...config.security,
      jwtSecret: config.security.jwtSecret ? '***' : undefined
    }
  };
  
  logger.info('Current configuration:', safeConfig);
}

// Validate configuration on module load
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
} 