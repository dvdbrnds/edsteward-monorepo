/**
 * Federal Register Cache Scheduler
 * 
 * Manages automatic synchronization, cleanup, and maintenance
 * of the Federal Register document cache
 */

import FederalRegisterCache from './federal-register-cache.js';

export class FederalRegisterScheduler {
  constructor(options = {}) {
    this.cache = new FederalRegisterCache(options.cache);
    this.intervals = {
      sync: options.syncInterval || 6 * 60 * 60 * 1000,      // Every 6 hours
      cleanup: options.cleanupInterval || 24 * 60 * 60 * 1000,   // Daily
      healthCheck: options.healthCheckInterval || 15 * 60 * 1000 // Every 15 minutes
    };
    
    this.tasks = new Map();
    this.isRunning = false;
    this.stats = {
      lastSync: null,
      lastCleanup: null,
      lastHealthCheck: null,
      syncCount: 0,
      cleanupCount: 0,
      healthCheckCount: 0,
      errors: []
    };
    
    console.log('🕒 Federal Register Scheduler initialized');
    console.log(`📅 Sync interval: ${this.intervals.sync / 1000 / 60} minutes`);
    console.log(`🧹 Cleanup interval: ${this.intervals.cleanup / 1000 / 60 / 60} hours`);
    console.log(`💚 Health check interval: ${this.intervals.healthCheck / 1000 / 60} minutes`);
  }

  /**
   * Start all scheduled tasks
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('🚀 Starting Federal Register Cache Scheduler...');

    // Sync task - Check for document updates
    this.tasks.set('sync', setInterval(async () => {
      await this.runSyncTask();
    }, this.intervals.sync));

    // Cleanup task - Remove old cache entries
    this.tasks.set('cleanup', setInterval(async () => {
      await this.runCleanupTask();
    }, this.intervals.cleanup));

    // Health check task - Monitor cache health
    this.tasks.set('healthCheck', setInterval(async () => {
      await this.runHealthCheckTask();
    }, this.intervals.healthCheck));

    // Log started tasks
    for (const [name] of this.tasks) {
      console.log(`✅ Started ${name} task`);
    }

    this.isRunning = true;
    console.log('🎉 Federal Register Cache Scheduler is now running');

    // Run initial health check
    setTimeout(() => this.runHealthCheckTask(), 5000);
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Scheduler is not running');
      return;
    }

    console.log('🛑 Stopping Federal Register Cache Scheduler...');

    for (const [name, intervalId] of this.tasks) {
      clearInterval(intervalId);
      console.log(`⏹️ Stopped ${name} task`);
    }

    this.tasks.clear();
    this.isRunning = false;
    console.log('✅ Federal Register Cache Scheduler stopped');
  }

  /**
   * Run synchronization task
   */
  async runSyncTask() {
    try {
      console.log('🔄 [SCHEDULER] Starting sync task...');
      const startTime = Date.now();

      const result = await this.cache.syncAll();
      
      const duration = Date.now() - startTime;
      this.stats.lastSync = Date.now();
      this.stats.syncCount++;

      console.log(`✅ [SCHEDULER] Sync task completed in ${duration}ms`);
      console.log(`📊 [SCHEDULER] Found ${result.updates.length} document updates`);

      if (result.updates.length > 0) {
        console.log('📋 [SCHEDULER] Updated documents:');
        result.updates.forEach(update => {
          console.log(`   - ${update.documentNumber}: ${update.title}`);
        });
      }

    } catch (error) {
      console.error('❌ [SCHEDULER] Sync task failed:', error.message);
      this.stats.errors.push({
        task: 'sync',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Run cleanup task
   */
  async runCleanupTask() {
    try {
      console.log('🧹 [SCHEDULER] Starting cleanup task...');
      const startTime = Date.now();

      await this.cache.cleanup();
      
      const duration = Date.now() - startTime;
      this.stats.lastCleanup = Date.now();
      this.stats.cleanupCount++;

      console.log(`✅ [SCHEDULER] Cleanup task completed in ${duration}ms`);

    } catch (error) {
      console.error('❌ [SCHEDULER] Cleanup task failed:', error.message);
      this.stats.errors.push({
        task: 'cleanup',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Run health check task
   */
  async runHealthCheckTask() {
    try {
      const cacheStats = this.cache.getCacheStats();
      
      this.stats.lastHealthCheck = Date.now();
      this.stats.healthCheckCount++;

      // Log health status
      console.log(`💚 [SCHEDULER] Cache health check: ${cacheStats.totalDocuments} docs, ${Math.round(cacheStats.totalSize / 1024 / 1024)}MB`);

      // Check for issues
      const issues = [];
      
      if (cacheStats.totalDocuments > this.cache.maxDocuments) {
        issues.push(`Document count (${cacheStats.totalDocuments}) exceeds limit (${this.cache.maxDocuments})`);
      }
      
      if (cacheStats.totalSize > 100 * 1024 * 1024) { // 100MB
        issues.push(`Cache size (${Math.round(cacheStats.totalSize / 1024 / 1024)}MB) is large`);
      }

      if (issues.length > 0) {
        console.log('⚠️ [SCHEDULER] Cache health issues detected:');
        issues.forEach(issue => console.log(`   - ${issue}`));
      }

    } catch (error) {
      console.error('❌ [SCHEDULER] Health check failed:', error.message);
      this.stats.errors.push({
        task: 'healthCheck',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Force run a specific task
   */
  async runTask(taskName) {
    switch (taskName) {
      case 'sync':
        await this.runSyncTask();
        break;
      case 'cleanup':
        await this.runCleanupTask();
        break;
      case 'healthCheck':
        await this.runHealthCheckTask();
        break;
      default:
        throw new Error(`Unknown task: ${taskName}`);
    }
  }

  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      intervals: this.intervals,
      cacheStats: this.cache.getCacheStats(),
      uptime: this.isRunning ? Date.now() - (this.stats.lastHealthCheck || Date.now()) : 0
    };
  }

  /**
   * Update interval for a task
   */
  updateInterval(taskName, newInterval) {
    if (!this.tasks.has(taskName)) {
      throw new Error(`Task ${taskName} not found`);
    }

    const intervalId = this.tasks.get(taskName);
    clearInterval(intervalId);
    
    this.intervals[taskName] = newInterval;
    
    // Create new task with updated interval
    let taskFunction;
    switch (taskName) {
      case 'sync':
        taskFunction = () => this.runSyncTask();
        break;
      case 'cleanup':
        taskFunction = () => this.runCleanupTask();
        break;
      case 'healthCheck':
        taskFunction = () => this.runHealthCheckTask();
        break;
    }

    if (this.isRunning) {
      const newIntervalId = setInterval(taskFunction, newInterval);
      this.tasks.set(taskName, newIntervalId);
    }

    console.log(`✅ Updated ${taskName} interval to: ${newInterval}ms`);
  }

  /**
   * Preload documents for specific CFR citations
   */
  async preloadDocuments(cfrCitations, maxDocumentsPerCitation = 20) {
    console.log(`📦 [SCHEDULER] Preloading documents for ${cfrCitations.length} CFR citations...`);
    
    const results = {
      totalSearches: 0,
      totalDocuments: 0,
      cached: 0,
      downloaded: 0,
      failed: 0
    };

    for (const cfrCitation of cfrCitations) {
      try {
        console.log(`🔍 [SCHEDULER] Preloading documents for: ${cfrCitation}`);
        
        // Search for documents
        const searchResults = await this.cache.searchByCFRCitation(cfrCitation, {
          limit: maxDocumentsPerCitation
        });
        
        results.totalSearches++;
        
        if (searchResults.documents && searchResults.documents.length > 0) {
          // Bulk download the documents
          const downloadResult = await this.cache.bulkDownloadDocuments(
            searchResults, 
            maxDocumentsPerCitation
          );
          
          results.totalDocuments += downloadResult.documents.length;
          results.cached += downloadResult.cached;
          results.downloaded += downloadResult.downloaded;
          results.failed += downloadResult.failed;
        }
        
        // Small delay between citations
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ [SCHEDULER] Failed to preload documents for ${cfrCitation}:`, error.message);
        results.failed++;
      }
    }

    console.log(`✅ [SCHEDULER] Preload complete: ${results.totalDocuments} documents processed`);
    console.log(`📊 [SCHEDULER] Downloaded: ${results.downloaded}, Cached: ${results.cached}, Failed: ${results.failed}`);
    
    return results;
  }
}

export default FederalRegisterScheduler;
