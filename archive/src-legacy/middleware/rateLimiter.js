/**
 * Rate limiting middleware for API protection
 * Implements different limits for various endpoints
 */
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { setupLogger } from '../utils/logger.js';

// Initialize logger
const logger = setupLogger('rate-limiter');

dotenv.config();

// Check if rate limiting is enabled
const isRateLimitEnabled = process.env.ENABLE_RATE_LIMIT === 'true';

// In-memory store for rate limiting (fallback when Redis is not available)
const inMemoryStore = new Map();

// Helper to create tenant-specific key prefix
const keyGenerator = (req) => {
  const tenantId = req.tenantId || 'default';
  return `rate-limit:${tenantId}:${req.ip}`;
};

// Try to set up Redis store if available and enabled
let redisStore = null;
let redisClient = null;

// Only set up Redis if rate limiting is enabled
if (isRateLimitEnabled) {
  logger.info('Rate limiting is enabled, attempting to set up Redis store');
  
  try {
    // Import Redis dynamically to prevent errors when the package isn't installed
    const setupRedis = async () => {
      try {
        // Dynamic imports to avoid errors if Redis isn't installed
        const redisModule = await import('redis').catch(err => {
          logger.warn('Redis module not available:', err.message);
          return null;
        });
        
        if (!redisModule) {
          logger.warn('Redis module could not be imported, using in-memory store instead');
          return { redisClient: null, redisStore: null };
        }
        
        const redisLimiterModule = await import('rate-limit-redis').catch(err => {
          logger.warn('Rate-limit-redis module not available:', err.message);
          return null;
        });
        
        if (!redisLimiterModule) {
          logger.warn('Rate-limit-redis module could not be imported, using in-memory store instead');
          return { redisClient: null, redisStore: null };
        }
        
        // Redis client for rate limit storage
        const client = redisModule.createClient({
          url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`
        });
        
        client.on('error', (err) => {
          logger.error('Redis client error:', err);
        });
        
        try {
          // Connect to Redis
          await client.connect();
          logger.info('Redis connection established for rate limiting');
          
          // Create Redis store for rate limiting
          const store = new redisLimiterModule.default({
            sendCommand: (...args) => client.sendCommand(args),
            prefix: 'rl:'
          });
          
          // Set the global variables
          redisClient = client;
          redisStore = store;
          
          return { redisClient: client, redisStore: store };
        } catch (connError) {
          logger.warn('Failed to connect to Redis:', connError.message);
          return { redisClient: null, redisStore: null };
        }
      } catch (error) {
        logger.warn('Redis setup failed:', error.message);
        return { redisClient: null, redisStore: null };
      }
    };
    
    // Initialize Redis asynchronously
    setupRedis().catch(err => {
      logger.warn('Async Redis setup failed:', err.message);
    });
  } catch (error) {
    logger.warn('Redis import failed, falling back to in-memory rate limiting:', error.message);
  }
} else {
  logger.info('Rate limiting is disabled, skipping Redis setup');
}

// Standard API rate limit (100 req/min)
export const standardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { 
    error: 'Too many requests, please try again later',
    retryAfter: 'See retry-after header'
  },
  // Use Redis store if available, otherwise use the default
  ...(redisStore && { store: redisStore })
});

// Heavy operations rate limit (10 per day)
export const bulkOperationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 requests per day
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { 
    error: 'Daily bulk operation limit reached',
    retryAfter: 'See retry-after header'
  },
  // Use Redis store if available, otherwise use the default
  ...(redisStore && { store: redisStore })
});

// Login attempt rate limit (15 per hour)
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // 15 login attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `rate-limit:login:${req.ip}`, // IP-based for login
  message: { 
    error: 'Too many login attempts, please try again later',
    retryAfter: 'See retry-after header'
  },
  // Use Redis store if available, otherwise use the default
  ...(redisStore && { store: redisStore })
});

// Debug test injection rate limit (5 per minute)
export const debugTestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `rate-limit:debug:${req.ip}`, // IP-based for debug endpoints
  message: { 
    error: 'Debug endpoint rate limit reached',
    retryAfter: 'See retry-after header'
  },
  // Use Redis store if available, otherwise use the default
  ...(redisStore && { store: redisStore })
});

// Apply rate limiters to specific routes
export const applyRateLimiters = (app) => {
  // Only apply rate limiters if enabled
  if (!isRateLimitEnabled) {
    logger.info('Rate limiting is disabled');
    return;
  }
  
  try {
    // Apply standard rate limit to all routes by default
    app.use(standardLimiter);
    
    // Apply bulk operation rate limit to specific endpoints
    app.use('/api/regulations/refresh', bulkOperationLimiter);
    app.use('/api/detect-changes', bulkOperationLimiter);
    app.use('/queue/refresh', bulkOperationLimiter);
    
    // Apply login rate limit
    app.use('/auth/login', loginRateLimiter);
    
    // Apply debug test rate limit
    app.use('/v1/admin/inject-test-reg', debugTestLimiter);
    
    logger.info('Rate limiters applied successfully');
  } catch (error) {
    logger.error('Failed to apply rate limiters:', error);
  }
}; 