/**
 * Memory Cache Repository
 * Simple in-memory cache implementation as fallback for Redis
 */
import { CacheRepository } from '../interfaces/repository.js';
import { setupLogger } from '../../utils/logger.js';

export class MemoryCacheRepository extends CacheRepository {
  constructor() {
    super();
    this.cache = new Map();
    this.timers = new Map();
    this.logger = setupLogger('memory-cache');
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  async get(key) {
    try {
      if (this.cache.has(key)) {
        const entry = this.cache.get(key);
        
        // Check if expired
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          await this.delete(key);
          this.stats.misses++;
          return null;
        }
        
        this.stats.hits++;
        return entry.value;
      }
      
      this.stats.misses++;
      return null;
    } catch (error) {
      this.logger.error('Error getting from cache:', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      const expiresAt = ttl > 0 ? Date.now() + (ttl * 1000) : null;
      
      // Clear existing timer if any
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
      
      // Store the value
      this.cache.set(key, {
        value: JSON.parse(JSON.stringify(value)), // Deep clone to prevent mutations
        expiresAt,
        createdAt: Date.now()
      });
      
      // Set expiration timer
      if (ttl > 0) {
        const timer = setTimeout(() => {
          this.delete(key);
        }, ttl * 1000);
        
        this.timers.set(key, timer);
      }
      
      this.stats.sets++;
      this.logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error('Error setting cache:', { key, error: error.message });
    }
  }

  async delete(key) {
    try {
      const existed = this.cache.has(key);
      
      // Clear timer
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
      
      // Delete from cache
      this.cache.delete(key);
      
      if (existed) {
        this.stats.deletes++;
        this.logger.debug(`Cache deleted: ${key}`);
      }
      
      return existed;
    } catch (error) {
      this.logger.error('Error deleting from cache:', { key, error: error.message });
      return false;
    }
  }

  async has(key) {
    try {
      if (!this.cache.has(key)) {
        return false;
      }
      
      const entry = this.cache.get(key);
      
      // Check if expired
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await this.delete(key);
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error checking cache key:', { key, error: error.message });
      return false;
    }
  }

  async clear() {
    try {
      // Clear all timers
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      
      this.timers.clear();
      this.cache.clear();
      
      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0
      };
      
      this.logger.info('Cache cleared');
    } catch (error) {
      this.logger.error('Error clearing cache:', error.message);
    }
  }

  async mget(keys) {
    try {
      const result = {};
      
      for (const key of keys) {
        const value = await this.get(key);
        if (value !== null) {
          result[key] = value;
        }
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error getting multiple keys:', { keys, error: error.message });
      return {};
    }
  }

  async mset(keyValuePairs, ttl = 3600) {
    try {
      const promises = Object.entries(keyValuePairs).map(([key, value]) =>
        this.set(key, value, ttl)
      );
      
      await Promise.all(promises);
    } catch (error) {
      this.logger.error('Error setting multiple keys:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  /**
   * Get all keys (for debugging)
   */
  getKeys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.delete(key));
    
    this.logger.debug(`Cleaned up ${expiredKeys.length} expired entries`);
    return expiredKeys.length;
  }
} 