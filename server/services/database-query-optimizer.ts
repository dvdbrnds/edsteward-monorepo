import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { createHash } from 'crypto';

interface QueryCacheEntry {
  result: QueryResult<any>;
  timestamp: number;
  ttl: number;
}

interface QueryMetrics {
  queryCount: number;
  totalTime: number;
  avgTime: number;
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: string;
  }>;
}

interface ConnectionPoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
}

/**
 * Advanced database query optimizer with caching and performance monitoring
 */
export class DatabaseQueryOptimizer {
  private queryCache = new Map<string, QueryCacheEntry>();
  private queryMetrics = new Map<string, QueryMetrics>();
  private pools = new Map<string, Pool>();
  
  // Configuration
  private readonly CACHE_TTL = {
    regulations: 5 * 60 * 1000,      // 5 minutes
    users: 2 * 60 * 1000,           // 2 minutes
    health: 30 * 1000,              // 30 seconds
    default: 60 * 1000              // 1 minute
  };
  
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), this.CACHE_CLEANUP_INTERVAL);
  }
  
  /**
   * Get or create optimized connection pool for tenant
   */
  public getOptimizedPool(tenantId: string, databaseUrl: string): Pool {
    if (!this.pools.has(tenantId)) {
      const pool = new Pool({
        connectionString: databaseUrl,
        
        // Connection pool optimization
        max: this.getPoolSizeForTenant(tenantId),
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        
        // Query optimization
        statement_timeout: 30000,        // 30 second query timeout
        query_timeout: 25000,           // 25 second individual query timeout
        idle_in_transaction_session_timeout: 60000, // 1 minute idle transaction timeout
        
        // Performance tuning
        application_name: `edsteward_${tenantId}`,
        
        // Error handling
        allowExitOnIdle: true
      });
      
      // Pool event monitoring
      pool.on('connect', (client) => {
        console.log(`[DB-POOL] New client connected for tenant: ${tenantId}`);
      });
      
      pool.on('error', (err, client) => {
        console.error(`[DB-POOL] Pool error for tenant ${tenantId}:`, err);
      });
      
      pool.on('acquire', (client) => {
        console.log(`[DB-POOL] Client acquired for tenant: ${tenantId}`);
      });
      
      this.pools.set(tenantId, pool);
    }
    
    return this.pools.get(tenantId)!;
  }
  
  /**
   * Execute optimized query with caching and performance monitoring
   */
  public async executeOptimizedQuery<T extends QueryResultRow = any>(
    pool: Pool,
    query: string,
    params: any[] = [],
    options: {
      cache?: boolean;
      cacheTtl?: number;
      tenantId?: string;
      useIndex?: boolean;
      enablePagination?: boolean;
    } = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, params);
    
    // Check cache first if enabled
    if (options.cache !== false) {
      const cached = this.getCachedResult<T>(cacheKey);
      if (cached) {
        console.log(`[DB-CACHE] Cache hit for query: ${query.substring(0, 50)}...`);
        return cached;
      }
    }
    
    try {
      // Optimize query before execution
      const optimizedQuery = this.optimizeQuery(query, options);
      
      // Execute query
      const result = await pool.query<T>(optimizedQuery, params);
      
      // Record metrics
      const duration = Date.now() - startTime;
      this.recordQueryMetrics(query, duration);
      
      // Cache result if appropriate
      if (options.cache !== false && this.shouldCacheQuery(query, duration)) {
        const ttl = options.cacheTtl || this.getCacheTtl(query);
        this.setCachedResult(cacheKey, result, ttl);
      }
      
      console.log(`[DB-QUERY] Executed query in ${duration}ms: ${query.substring(0, 50)}...`);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryMetrics(query, duration, error as Error);
      throw error;
    }
  }
  
  /**
   * Optimize query based on patterns and hints
   */
  private optimizeQuery(query: string, options: any): string {
    let optimizedQuery = query;
    
    // Add index hints for specific queries
    if (options.useIndex && query.includes('regulations')) {
      // Add index hints for common regulation queries
      if (query.includes('WHERE') && query.includes('category')) {
        optimizedQuery = query.replace(
          'FROM regulations',
          'FROM regulations /*+ USE INDEX (idx_regulations_category) */'
        );
      }
    }
    
    // Optimize pagination queries
    if (options.enablePagination && query.includes('LIMIT')) {
      // Ensure ORDER BY for consistent pagination
      if (!query.includes('ORDER BY')) {
        optimizedQuery = optimizedQuery.replace(
          'LIMIT',
          'ORDER BY id LIMIT'
        );
      }
    }
    
    // Add query timeout hint
    if (!query.includes('SET statement_timeout')) {
      optimizedQuery = `SET statement_timeout = '30s'; ${optimizedQuery}`;
    }
    
    return optimizedQuery;
  }
  
  /**
   * Generate cache key for query and parameters
   */
  private generateCacheKey(query: string, params: any[]): string {
    const content = query + JSON.stringify(params);
    return createHash('md5').update(content).digest('hex');
  }
  
  /**
   * Get cached query result
   */
  private getCachedResult<T extends QueryResultRow>(cacheKey: string): QueryResult<T> | null {
    const entry = this.queryCache.get(cacheKey);
    if (!entry) return null;
    
    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.queryCache.delete(cacheKey);
      return null;
    }
    
    return entry.result as QueryResult<T>;
  }
  
  /**
   * Cache query result
   */
  private setCachedResult(cacheKey: string, result: QueryResult, ttl: number): void {
    // Don't cache if at max capacity (simple LRU)
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      const keys = Array.from(this.queryCache.keys());
      if (keys.length > 0) {
        this.queryCache.delete(keys[0]);
      }
    }
    
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl
    });
  }
  
  /**
   * Determine cache TTL based on query type
   */
  private getCacheTtl(query: string): number {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('regulations')) return this.CACHE_TTL.regulations;
    if (lowerQuery.includes('users')) return this.CACHE_TTL.users;
    if (lowerQuery.includes('health') || lowerQuery.includes('status')) return this.CACHE_TTL.health;
    
    return this.CACHE_TTL.default;
  }
  
  /**
   * Determine if query should be cached
   */
  private shouldCacheQuery(query: string, duration: number): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Don't cache very fast queries (overhead not worth it)
    if (duration < 10) return false;
    
    // Don't cache mutations
    if (lowerQuery.includes('insert') || lowerQuery.includes('update') || lowerQuery.includes('delete')) {
      return false;
    }
    
    // Cache SELECT queries
    return lowerQuery.includes('select');
  }
  
  /**
   * Record query performance metrics
   */
  private recordQueryMetrics(query: string, duration: number, error?: Error): void {
    const queryType = this.getQueryType(query);
    
    if (!this.queryMetrics.has(queryType)) {
      this.queryMetrics.set(queryType, {
        queryCount: 0,
        totalTime: 0,
        avgTime: 0,
        slowQueries: []
      });
    }
    
    const metrics = this.queryMetrics.get(queryType)!;
    metrics.queryCount++;
    metrics.totalTime += duration;
    metrics.avgTime = metrics.totalTime / metrics.queryCount;
    
    // Record slow queries
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      metrics.slowQueries.push({
        query: query.substring(0, 100),
        duration,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 slow queries
      if (metrics.slowQueries.length > 10) {
        metrics.slowQueries.shift();
      }
      
      console.warn(`[DB-PERFORMANCE] Slow query detected: ${duration}ms - ${query.substring(0, 100)}...`);
    }
    
    if (error) {
      console.error(`[DB-ERROR] Query failed after ${duration}ms:`, error.message);
    }
  }
  
  /**
   * Get query type for metrics grouping
   */
  private getQueryType(query: string): string {
    const lowerQuery = query.toLowerCase().trim();
    
    if (lowerQuery.startsWith('select')) return 'SELECT';
    if (lowerQuery.startsWith('insert')) return 'INSERT';
    if (lowerQuery.startsWith('update')) return 'UPDATE';
    if (lowerQuery.startsWith('delete')) return 'DELETE';
    if (lowerQuery.includes('health') || lowerQuery.includes('status')) return 'HEALTH';
    
    return 'OTHER';
  }
  
  /**
   * Get optimized pool size based on tenant usage
   */
  private getPoolSizeForTenant(tenantId: string): number {
    // Adjust pool size based on tenant size and usage patterns
    switch (tenantId) {
      case 'admin':
        return 15; // Higher for admin operations
      case 'moravian':
        return 10; // Medium for production tenant
      case 'staging':
        return 5;  // Lower for staging
      case 'test':
        return 3;  // Minimal for testing
      default:
        return 8;  // Default size
    }
  }
  
  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    const entries = Array.from(this.queryCache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.queryCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[DB-CACHE] Cleaned up ${cleanedCount} expired cache entries`);
    }
  }
  
  /**
   * Get performance metrics for monitoring
   */
  public getPerformanceMetrics(): Record<string, QueryMetrics> {
    return Object.fromEntries(this.queryMetrics);
  }
  
  /**
   * Get connection pool metrics
   */
  public getConnectionPoolMetrics(): Record<string, ConnectionPoolMetrics> {
    const metrics: Record<string, ConnectionPoolMetrics> = {};
    
    const poolEntries = Array.from(this.pools.entries());
    for (const [tenantId, pool] of poolEntries) {
      metrics[tenantId] = {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount
      };
    }
    
    return metrics;
  }
  
  /**
   * Clear all caches (useful for testing or manual cache invalidation)
   */
  public clearCache(): void {
    this.queryCache.clear();
    console.log('[DB-CACHE] All cache entries cleared');
  }
  
  /**
   * Close all connection pools gracefully
   */
  public async closeAllPools(): Promise<void> {
    const closePromises = Array.from(this.pools.values()).map(pool => pool.end());
    await Promise.all(closePromises);
    this.pools.clear();
    console.log('[DB-POOL] All connection pools closed');
  }
}

// Export singleton instance
export const databaseQueryOptimizer = new DatabaseQueryOptimizer(); 