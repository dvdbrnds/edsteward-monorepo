/**
 * Redis Cache Implementation - Phase 4
 * Advanced distributed caching with TTL, invalidation, and monitoring
 */

import Redis from 'ioredis';
import { logger } from '../../utils/logger.js';

export class RedisCache {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.REDIS_HOST || 'localhost',
      port: config.port || process.env.REDIS_PORT || 6379,
      password: config.password || process.env.REDIS_PASSWORD,
      db: config.db || process.env.REDIS_DB || 0,
      keyPrefix: config.keyPrefix || 'mcp:',
      defaultTTL: config.defaultTTL || 3600, // 1 hour
      maxRetries: config.maxRetries || 3,
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      enableReadyCheck: true,
      lazyConnect: true,
      ...config
    };

    this.client = null;
    this.isConnected = false;
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      connectionAttempts: 0
    };

    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      this.metrics.connectionAttempts++;
      
      this.client = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        maxRetriesPerRequest: this.config.maxRetries,
        retryDelayOnFailover: this.config.retryDelayOnFailover,
        enableReadyCheck: this.config.enableReadyCheck,
        lazyConnect: this.config.lazyConnect
      });

      this.client.on('connect', () => {
        logger.info('[redis-cache] Connected to Redis server');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('[redis-cache] Redis client ready');
      });

      this.client.on('error', (error) => {
        logger.error('[redis-cache] Redis connection error:', error);
        this.metrics.errors++;
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('[redis-cache] Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('[redis-cache] Reconnecting to Redis...');
      });

      // Test connection
      await this.client.ping();
      logger.info('[redis-cache] Redis cache initialized successfully');

    } catch (error) {
      logger.error('[redis-cache] Failed to initialize Redis cache:', error);
      this.isConnected = false;
      // Fallback to memory cache if Redis is unavailable
      this.client = null;
    }
  }

  /**
   * Get value from cache
   */
  async get(key) {
    if (!this.isConnected || !this.client) {
      this.metrics.misses++;
      return null;
    }

    try {
      const value = await this.client.get(key);
      
      if (value !== null) {
        this.metrics.hits++;
        return JSON.parse(value);
      } else {
        this.metrics.misses++;
        return null;
      }
    } catch (error) {
      logger.error('[redis-cache] Error getting key:', key, error);
      this.metrics.errors++;
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttl = null) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      const expiration = ttl || this.config.defaultTTL;

      if (expiration > 0) {
        await this.client.setex(key, expiration, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }

      this.metrics.sets++;
      return true;
    } catch (error) {
      logger.error('[redis-cache] Error setting key:', key, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.del(key);
      this.metrics.deletes++;
      return result > 0;
    } catch (error) {
      logger.error('[redis-cache] Error deleting key:', key, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern) {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        const result = await this.client.del(...keys);
        this.metrics.deletes += result;
        return result;
      }
      return 0;
    } catch (error) {
      logger.error('[redis-cache] Error deleting pattern:', pattern, error);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('[redis-cache] Error checking existence:', key, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key, ttl) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error('[redis-cache] Error setting TTL:', key, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  async getTTL(key) {
    if (!this.isConnected || !this.client) {
      return -1;
    }

    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('[redis-cache] Error getting TTL:', key, error);
      this.metrics.errors++;
      return -1;
    }
  }

  /**
   * Increment counter
   */
  async increment(key, amount = 1, ttl = null) {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const result = await this.client.incrby(key, amount);
      
      if (ttl && result === amount) {
        // Set TTL only if this is a new key
        await this.client.expire(key, ttl);
      }
      
      return result;
    } catch (error) {
      logger.error('[redis-cache] Error incrementing:', key, error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  getMetrics() {
    const hitRate = this.metrics.hits + this.metrics.misses > 0 
      ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100 
      : 0;

    return {
      ...this.metrics,
      hitRate: Math.round(hitRate * 100) / 100,
      isConnected: this.isConnected,
      config: {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        defaultTTL: this.config.defaultTTL
      }
    };
  }

  /**
   * Clear all cache data
   */
  async clear() {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.flushdb();
      logger.info('[redis-cache] Cache cleared');
      return true;
    } catch (error) {
      logger.error('[redis-cache] Error clearing cache:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Get cache health status
   */
  async getHealth() {
    if (!this.client) {
      return {
        status: 'unhealthy',
        details: { error: 'Redis client not initialized' }
      };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - start;

      return {
        status: this.isConnected ? 'healthy' : 'degraded',
        details: {
          connected: this.isConnected,
          responseTime,
          metrics: this.getMetrics()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('[redis-cache] Redis connection closed');
    }
  }
}

// Export singleton instance
export const redisCache = new RedisCache();
export default redisCache; 