/**
 * Advanced Cache Manager - Phase 4
 * Intelligent caching with Redis fallback, cache warming, and invalidation strategies
 */

import { redisCache } from './RedisCache.js';
import { MemoryCacheRepository } from '../repositories/memory-cache-repository.js';
import { logger } from '../../utils/logger.js';

export class CacheManager {
  constructor(config = {}) {
    this.config = {
      preferRedis: config.preferRedis !== false,
      fallbackToMemory: config.fallbackToMemory !== false,
      defaultTTL: config.defaultTTL || 3600,
      maxMemorySize: config.maxMemorySize || 1000,
      cacheWarmingEnabled: config.cacheWarmingEnabled !== false,
      invalidationStrategies: config.invalidationStrategies || ['ttl', 'lru'],
      compressionThreshold: config.compressionThreshold || 1024, // bytes
      ...config
    };

    this.memoryCache = new MemoryCacheRepository({ maxSize: this.config.maxMemorySize });
    this.primaryCache = null;
    this.fallbackCache = null;
    this.isInitialized = false;
    
    this.metrics = {
      operations: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      fallbacks: 0,
      compressions: 0,
      decompressions: 0
    };

    this.initialize();
  }

  /**
   * Initialize cache manager
   */
  async initialize() {
    try {
      // Determine primary and fallback caches
      if (this.config.preferRedis) {
        const redisHealth = await redisCache.getHealth();
        
        if (redisHealth.status === 'healthy') {
          this.primaryCache = redisCache;
          this.fallbackCache = this.config.fallbackToMemory ? this.memoryCache : null;
          logger.info('[cache-manager] Using Redis as primary cache with memory fallback');
        } else {
          this.primaryCache = this.memoryCache;
          this.fallbackCache = null;
          logger.warn('[cache-manager] Redis unavailable, using memory cache only');
        }
      } else {
        this.primaryCache = this.memoryCache;
        this.fallbackCache = null;
        logger.info('[cache-manager] Using memory cache as primary');
      }

      this.isInitialized = true;
      logger.info('[cache-manager] Cache manager initialized successfully');

      // Start cache warming if enabled
      if (this.config.cacheWarmingEnabled) {
        this.startCacheWarming();
      }

    } catch (error) {
      logger.error('[cache-manager] Failed to initialize cache manager:', error);
      this.primaryCache = this.memoryCache;
      this.fallbackCache = null;
      this.isInitialized = true;
    }
  }

  /**
   * Get value from cache with intelligent fallback
   */
  async get(key, options = {}) {
    this.metrics.operations++;

    try {
      // Try primary cache first
      let value = await this._getFromCache(this.primaryCache, key);
      
      if (value !== null) {
        this.metrics.hits++;
        return this._decompress(value);
      }

      // Try fallback cache if available
      if (this.fallbackCache) {
        value = await this._getFromCache(this.fallbackCache, key);
        
        if (value !== null) {
          this.metrics.hits++;
          this.metrics.fallbacks++;
          
          // Promote to primary cache
          if (options.promoteToPrimary !== false) {
            await this._setToCache(this.primaryCache, key, value, options.ttl);
          }
          
          return this._decompress(value);
        }
      }

      this.metrics.misses++;
      return null;

    } catch (error) {
      logger.error('[cache-manager] Error getting key:', key, error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Set value in cache with intelligent compression and distribution
   */
  async set(key, value, options = {}) {
    this.metrics.operations++;

    try {
      const compressedValue = this._compress(value);
      const ttl = options.ttl || this.config.defaultTTL;
      const tags = options.tags || [];

      // Set in primary cache
      const primarySuccess = await this._setToCache(this.primaryCache, key, compressedValue, ttl);

      // Set in fallback cache if configured and primary succeeded
      if (this.fallbackCache && primarySuccess && options.replicateToFallback !== false) {
        await this._setToCache(this.fallbackCache, key, compressedValue, ttl);
      }

      // Store tags for invalidation
      if (tags.length > 0) {
        await this._storeTags(key, tags, ttl);
      }

      return primarySuccess;

    } catch (error) {
      logger.error('[cache-manager] Error setting key:', key, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Delete key from all caches
   */
  async delete(key) {
    this.metrics.operations++;

    try {
      const results = await Promise.allSettled([
        this._deleteFromCache(this.primaryCache, key),
        this.fallbackCache ? this._deleteFromCache(this.fallbackCache, key) : Promise.resolve(true)
      ]);

      return results.some(result => result.status === 'fulfilled' && result.value);

    } catch (error) {
      logger.error('[cache-manager] Error deleting key:', key, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return 0;
    }

    try {
      let deletedCount = 0;

      for (const tag of tags) {
        const tagKey = `tags:${tag}`;
        const keys = await this.get(tagKey);
        
        if (keys && Array.isArray(keys)) {
          for (const key of keys) {
            await this.delete(key);
            deletedCount++;
          }
          
          // Remove the tag index
          await this.delete(tagKey);
        }
      }

      logger.info(`[cache-manager] Invalidated ${deletedCount} keys for tags:`, tags);
      return deletedCount;

    } catch (error) {
      logger.error('[cache-manager] Error invalidating by tags:', tags, error);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern) {
    try {
      let deletedCount = 0;

      // Try Redis pattern deletion if available
      if (this.primaryCache === redisCache && redisCache.isConnected) {
        deletedCount = await redisCache.deletePattern(pattern);
      }

      // Handle memory cache pattern deletion
      if (this.primaryCache === this.memoryCache || this.fallbackCache === this.memoryCache) {
        const memoryKeys = this.memoryCache.getKeys();
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        
        for (const key of memoryKeys) {
          if (regex.test(key)) {
            await this.memoryCache.delete(key);
            deletedCount++;
          }
        }
      }

      logger.info(`[cache-manager] Invalidated ${deletedCount} keys for pattern:`, pattern);
      return deletedCount;

    } catch (error) {
      logger.error('[cache-manager] Error invalidating by pattern:', pattern, error);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(dataLoader, keys = []) {
    if (!this.config.cacheWarmingEnabled) {
      return;
    }

    try {
      logger.info('[cache-manager] Starting cache warming for', keys.length, 'keys');
      
      const warmingPromises = keys.map(async (key) => {
        try {
          const exists = await this.exists(key);
          if (!exists) {
            const data = await dataLoader(key);
            if (data !== null && data !== undefined) {
              await this.set(key, data, { ttl: this.config.defaultTTL });
            }
          }
        } catch (error) {
          logger.warn('[cache-manager] Failed to warm cache for key:', key, error);
        }
      });

      await Promise.allSettled(warmingPromises);
      logger.info('[cache-manager] Cache warming completed');

    } catch (error) {
      logger.error('[cache-manager] Error during cache warming:', error);
    }
  }

  /**
   * Check if key exists in any cache
   */
  async exists(key) {
    try {
      const primaryExists = await this._existsInCache(this.primaryCache, key);
      if (primaryExists) return true;

      if (this.fallbackCache) {
        return await this._existsInCache(this.fallbackCache, key);
      }

      return false;

    } catch (error) {
      logger.error('[cache-manager] Error checking existence:', key, error);
      return false;
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
      primaryCache: this.primaryCache === redisCache ? 'redis' : 'memory',
      fallbackCache: this.fallbackCache ? 'memory' : 'none',
      isInitialized: this.isInitialized,
      primaryCacheMetrics: this.primaryCache?.getMetrics ? this.primaryCache.getMetrics() : null,
      fallbackCacheMetrics: this.fallbackCache?.getMetrics ? this.fallbackCache.getMetrics() : null
    };
  }

  /**
   * Get health status
   */
  async getHealth() {
    try {
      const health = {
        status: 'healthy',
        details: {
          initialized: this.isInitialized,
          primaryCache: 'unknown',
          fallbackCache: 'unknown',
          metrics: this.getMetrics()
        }
      };

      // Check primary cache health
      if (this.primaryCache?.getHealth) {
        const primaryHealth = await this.primaryCache.getHealth();
        health.details.primaryCache = primaryHealth.status;
        
        if (primaryHealth.status === 'unhealthy') {
          health.status = 'degraded';
        }
      }

      // Check fallback cache health
      if (this.fallbackCache?.getHealth) {
        const fallbackHealth = await this.fallbackCache.getHealth();
        health.details.fallbackCache = fallbackHealth.status;
      }

      return health;

    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }

  /**
   * Clear all caches
   */
  async clear() {
    try {
      const results = await Promise.allSettled([
        this.primaryCache?.clear ? this.primaryCache.clear() : Promise.resolve(true),
        this.fallbackCache?.clear ? this.fallbackCache.clear() : Promise.resolve(true)
      ]);

      return results.every(result => result.status === 'fulfilled' && result.value);

    } catch (error) {
      logger.error('[cache-manager] Error clearing caches:', error);
      return false;
    }
  }

  // Private helper methods

  async _getFromCache(cache, key) {
    if (!cache) return null;
    return cache.get ? await cache.get(key) : null;
  }

  async _setToCache(cache, key, value, ttl) {
    if (!cache) return false;
    return cache.set ? await cache.set(key, value, ttl) : false;
  }

  async _deleteFromCache(cache, key) {
    if (!cache) return false;
    return cache.delete ? await cache.delete(key) : false;
  }

  async _existsInCache(cache, key) {
    if (!cache) return false;
    return cache.exists ? await cache.exists(key) : false;
  }

  _compress(value) {
    const serialized = JSON.stringify(value);
    
    if (serialized.length > this.config.compressionThreshold) {
      // Simple compression simulation (in production, use actual compression)
      this.metrics.compressions++;
      return { compressed: true, data: serialized };
    }
    
    return { compressed: false, data: value };
  }

  _decompress(value) {
    if (value && value.compressed) {
      this.metrics.decompressions++;
      return JSON.parse(value.data);
    }
    
    return value?.data || value;
  }

  async _storeTags(key, tags, ttl) {
    for (const tag of tags) {
      const tagKey = `tags:${tag}`;
      const existingKeys = await this.get(tagKey) || [];
      
      if (!existingKeys.includes(key)) {
        existingKeys.push(key);
        await this.set(tagKey, existingKeys, { ttl, replicateToFallback: false });
      }
    }
  }

  startCacheWarming() {
    // Implement cache warming strategies
    logger.info('[cache-manager] Cache warming strategies activated');
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
export default cacheManager; 