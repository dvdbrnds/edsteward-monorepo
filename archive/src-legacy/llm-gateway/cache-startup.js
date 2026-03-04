/**
 * Federal Register Cache Startup Script
 * 
 * Initializes the Federal Register cache system and scheduler
 * for the MCP Engine LLM Gateway
 */

import FederalRegisterCache from './federal-register-cache.js';
import FederalRegisterScheduler from './federal-register-scheduler.js';

export class CacheStartup {
  constructor(options = {}) {
    this.cache = null;
    this.scheduler = null;
    this.options = {
      cacheDir: options.cacheDir || 'cache/federal-register',
      maxAge: options.maxAge || 24 * 60 * 60 * 1000, // 24 hours
      syncInterval: options.syncInterval || 6 * 60 * 60 * 1000, // 6 hours
      cleanupInterval: options.cleanupInterval || 24 * 60 * 60 * 1000, // 24 hours
      healthCheckInterval: options.healthCheckInterval || 15 * 60 * 1000, // 15 minutes
      preloadCitations: options.preloadCitations || ['37 CFR 201', '34 CFR 668', '20 USC 1232g'],
      ...options
    };
  }

  /**
   * Initialize the cache system
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Federal Register Cache System...');

      // Initialize cache
      this.cache = new FederalRegisterCache({
        cacheDir: this.options.cacheDir,
        maxAge: this.options.maxAge,
        maxDocuments: this.options.maxDocuments || 1000
      });

      // Initialize scheduler
      this.scheduler = new FederalRegisterScheduler({
        cache: {
          cacheDir: this.options.cacheDir,
          maxAge: this.options.maxAge
        },
        syncInterval: this.options.syncInterval,
        cleanupInterval: this.options.cleanupInterval,
        healthCheckInterval: this.options.healthCheckInterval
      });

      // Start scheduler
      this.scheduler.start();

      // Preload common documents
      if (this.options.preloadCitations && this.options.preloadCitations.length > 0) {
        console.log('📦 Preloading common Federal Register documents...');
        setTimeout(() => {
          this.preloadCommonDocuments();
        }, 5000); // Wait 5 seconds before preloading
      }

      console.log('✅ Federal Register Cache System initialized successfully');
      
      return {
        cache: this.cache,
        scheduler: this.scheduler
      };

    } catch (error) {
      console.error('❌ Failed to initialize Federal Register Cache System:', error.message);
      throw error;
    }
  }

  /**
   * Preload common documents
   */
  async preloadCommonDocuments() {
    try {
      const result = await this.scheduler.preloadDocuments(
        this.options.preloadCitations,
        10 // Max documents per citation
      );

      console.log(`✅ Preload complete: ${result.totalDocuments} documents processed`);
      
    } catch (error) {
      console.error('❌ Document preload failed:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    if (!this.cache || !this.scheduler) {
      return { initialized: false };
    }

    return {
      initialized: true,
      cache: this.cache.getCacheStats(),
      scheduler: this.scheduler.getStats()
    };
  }

  /**
   * Shutdown the cache system
   */
  async shutdown() {
    try {
      console.log('🛑 Shutting down Federal Register Cache System...');

      if (this.scheduler) {
        this.scheduler.stop();
      }

      if (this.cache) {
        await this.cache.cleanup();
      }

      console.log('✅ Federal Register Cache System shutdown complete');

    } catch (error) {
      console.error('❌ Cache system shutdown failed:', error.message);
    }
  }

  /**
   * Force sync all cached documents
   */
  async forceSync() {
    if (!this.cache) {
      throw new Error('Cache system not initialized');
    }

    console.log('🔄 Force syncing all cached documents...');
    return await this.cache.syncAll();
  }

  /**
   * Manual cleanup
   */
  async cleanup() {
    if (!this.cache) {
      throw new Error('Cache system not initialized');
    }

    console.log('🧹 Manual cache cleanup...');
    return await this.cache.cleanup();
  }

  /**
   * Get cache instance
   */
  getCache() {
    return this.cache;
  }

  /**
   * Get scheduler instance
   */
  getScheduler() {
    return this.scheduler;
  }
}

export default CacheStartup;
