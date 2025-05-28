/**
 * Metrics Collector - Phase 4
 * Comprehensive monitoring and observability system
 */

import EventEmitter from 'events';
import { performance } from 'perf_hooks';
import { cacheManager } from '../cache/CacheManager.js';
import { logger } from '../../utils/logger.js';

export class MetricsCollector extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      enableMetrics: config.enableMetrics !== false,
      metricsRetentionDays: config.metricsRetentionDays || 30,
      aggregationInterval: config.aggregationInterval || 60000, // 1 minute
      enablePerformanceTracking: config.enablePerformanceTracking !== false,
      enableErrorTracking: config.enableErrorTracking !== false,
      enableHealthChecks: config.enableHealthChecks !== false,
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      alertThresholds: {
        errorRate: config.alertThresholds?.errorRate || 0.05, // 5%
        responseTime: config.alertThresholds?.responseTime || 5000, // 5 seconds
        memoryUsage: config.alertThresholds?.memoryUsage || 0.8, // 80%
        ...config.alertThresholds
      },
      ...config
    };

    this.metrics = {
      requests: new Map(),
      responses: new Map(),
      errors: new Map(),
      performance: new Map(),
      system: new Map(),
      custom: new Map()
    };

    this.aggregatedMetrics = new Map();
    this.healthStatus = new Map();
    this.isInitialized = false;

    this.initialize();
  }

  /**
   * Initialize metrics collector
   */
  async initialize() {
    try {
      if (this.config.enableMetrics) {
        this.startMetricsAggregation();
      }

      if (this.config.enableHealthChecks) {
        this.startHealthChecks();
      }

      // Load historical metrics
      await this.loadHistoricalMetrics();

      this.isInitialized = true;
      logger.info('[metrics-collector] Metrics collector initialized');

    } catch (error) {
      logger.error('[metrics-collector] Failed to initialize:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Record request metrics
   */
  recordRequest(endpoint, method = 'GET', metadata = {}) {
    if (!this.config.enableMetrics) return;

    const timestamp = Date.now();
    const key = `${method}:${endpoint}`;
    
    const requestData = {
      timestamp,
      endpoint,
      method,
      metadata,
      id: this.generateRequestId()
    };

    this.metrics.requests.set(requestData.id, requestData);
    this.emit('request', requestData);

    return requestData.id;
  }

  /**
   * Record response metrics
   */
  recordResponse(requestId, statusCode, responseTime, metadata = {}) {
    if (!this.config.enableMetrics) return;

    const timestamp = Date.now();
    const requestData = this.metrics.requests.get(requestId);
    
    if (!requestData) {
      logger.warn('[metrics-collector] Request not found for response:', requestId);
      return;
    }

    const responseData = {
      requestId,
      timestamp,
      statusCode,
      responseTime,
      metadata,
      endpoint: requestData.endpoint,
      method: requestData.method
    };

    this.metrics.responses.set(requestId, responseData);
    this.emit('response', responseData);

    // Check for alerts
    this.checkAlerts(responseData);
  }

  /**
   * Record error metrics
   */
  recordError(error, context = {}) {
    if (!this.config.enableErrorTracking) return;

    const timestamp = Date.now();
    const errorData = {
      timestamp,
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace',
      name: error.name || 'Error',
      context,
      id: this.generateErrorId()
    };

    this.metrics.errors.set(errorData.id, errorData);
    
    // Only emit error event if there are listeners to prevent unhandled errors
    if (this.listenerCount('error') > 0) {
      this.emit('error', errorData);
    }

    logger.error('[metrics-collector] Error recorded:', errorData);
  }

  /**
   * Record performance metrics
   */
  recordPerformance(operation, duration, metadata = {}) {
    if (!this.config.enablePerformanceTracking) return;

    const timestamp = Date.now();
    const performanceData = {
      timestamp,
      operation,
      duration,
      metadata,
      id: this.generatePerformanceId()
    };

    this.metrics.performance.set(performanceData.id, performanceData);
    this.emit('performance', performanceData);
  }

  /**
   * Record system metrics
   */
  recordSystemMetrics() {
    if (!this.config.enableMetrics) return;

    const timestamp = Date.now();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const systemData = {
      timestamp,
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      pid: process.pid
    };

    this.metrics.system.set(timestamp, systemData);
    this.emit('system', systemData);

    return systemData;
  }

  /**
   * Record custom metrics
   */
  recordCustomMetric(name, value, tags = {}) {
    if (!this.config.enableMetrics) return;

    const timestamp = Date.now();
    const metricData = {
      timestamp,
      name,
      value,
      tags,
      id: this.generateCustomMetricId()
    };

    this.metrics.custom.set(metricData.id, metricData);
    this.emit('custom', metricData);
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(timeRange = '1h') {
    const now = Date.now();
    const ranges = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    const rangeMs = ranges[timeRange] || ranges['1h'];
    const startTime = now - rangeMs;

    return {
      timeRange,
      startTime,
      endTime: now,
      requests: this.aggregateRequests(startTime, now),
      responses: this.aggregateResponses(startTime, now),
      errors: this.aggregateErrors(startTime, now),
      performance: this.aggregatePerformance(startTime, now),
      system: this.aggregateSystem(startTime, now)
    };
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics() {
    const now = Date.now();
    const last5Minutes = now - (5 * 60 * 1000);

    return {
      timestamp: now,
      requests: {
        total: this.countMetrics(this.metrics.requests, last5Minutes),
        rate: this.calculateRate(this.metrics.requests, last5Minutes, 5 * 60)
      },
      responses: {
        total: this.countMetrics(this.metrics.responses, last5Minutes),
        averageResponseTime: this.calculateAverageResponseTime(last5Minutes),
        statusCodes: this.getStatusCodeDistribution(last5Minutes)
      },
      errors: {
        total: this.countMetrics(this.metrics.errors, last5Minutes),
        rate: this.calculateRate(this.metrics.errors, last5Minutes, 5 * 60)
      },
      system: this.getLatestSystemMetrics(),
      health: this.getOverallHealth()
    };
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    const health = {
      status: 'healthy',
      timestamp: Date.now(),
      checks: {},
      metrics: this.getRealTimeMetrics()
    };

    // Check error rate
    const errorRate = this.calculateErrorRate();
    health.checks.errorRate = {
      status: errorRate < this.config.alertThresholds.errorRate ? 'healthy' : 'unhealthy',
      value: errorRate,
      threshold: this.config.alertThresholds.errorRate
    };

    // Check response time
    const avgResponseTime = this.calculateAverageResponseTime();
    health.checks.responseTime = {
      status: avgResponseTime < this.config.alertThresholds.responseTime ? 'healthy' : 'degraded',
      value: avgResponseTime,
      threshold: this.config.alertThresholds.responseTime
    };

    // Check memory usage
    const memoryUsage = this.calculateMemoryUsage();
    health.checks.memoryUsage = {
      status: memoryUsage < this.config.alertThresholds.memoryUsage ? 'healthy' : 'degraded',
      value: memoryUsage,
      threshold: this.config.alertThresholds.memoryUsage
    };

    // Determine overall status
    const checkStatuses = Object.values(health.checks).map(check => check.status);
    if (checkStatuses.includes('unhealthy')) {
      health.status = 'unhealthy';
    } else if (checkStatuses.includes('degraded')) {
      health.status = 'degraded';
    }

    return health;
  }

  /**
   * Create performance timer
   */
  createTimer(operation) {
    const startTime = process.hrtime.bigint();
    
    return {
      end: (metadata = {}) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        this.recordPerformance(operation, duration, metadata);
        return duration;
      }
    };
  }

  /**
   * Middleware for Express.js
   */
  expressMiddleware() {
    return (req, res, next) => {
      const requestId = this.recordRequest(req.path, req.method, {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        query: req.query
      });

      const startTime = process.hrtime.bigint();

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      res.end = function(...args) {
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;

        this.recordResponse(requestId, res.statusCode, responseTime, {
          contentLength: res.get('Content-Length')
        });

        originalEnd.apply(res, args);
      }.bind(this);

      next();
    };
  }

  // Private helper methods

  aggregateRequests(startTime, endTime) {
    const requests = Array.from(this.metrics.requests.values())
      .filter(req => req.timestamp >= startTime && req.timestamp <= endTime);

    const byEndpoint = {};
    const byMethod = {};

    for (const request of requests) {
      byEndpoint[request.endpoint] = (byEndpoint[request.endpoint] || 0) + 1;
      byMethod[request.method] = (byMethod[request.method] || 0) + 1;
    }

    return {
      total: requests.length,
      byEndpoint,
      byMethod
    };
  }

  aggregateResponses(startTime, endTime) {
    const responses = Array.from(this.metrics.responses.values())
      .filter(res => res.timestamp >= startTime && res.timestamp <= endTime);

    const byStatusCode = {};
    let totalResponseTime = 0;

    for (const response of responses) {
      byStatusCode[response.statusCode] = (byStatusCode[response.statusCode] || 0) + 1;
      totalResponseTime += response.responseTime;
    }

    return {
      total: responses.length,
      averageResponseTime: responses.length > 0 ? totalResponseTime / responses.length : 0,
      byStatusCode
    };
  }

  aggregateErrors(startTime, endTime) {
    const errors = Array.from(this.metrics.errors.values())
      .filter(err => err.timestamp >= startTime && err.timestamp <= endTime);

    const byType = {};
    for (const error of errors) {
      byType[error.name] = (byType[error.name] || 0) + 1;
    }

    return {
      total: errors.length,
      byType
    };
  }

  aggregatePerformance(startTime, endTime) {
    const performances = Array.from(this.metrics.performance.values())
      .filter(perf => perf.timestamp >= startTime && perf.timestamp <= endTime);

    const byOperation = {};
    for (const performance of performances) {
      if (!byOperation[performance.operation]) {
        byOperation[performance.operation] = {
          count: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0
        };
      }

      const op = byOperation[performance.operation];
      op.count++;
      op.totalDuration += performance.duration;
      op.minDuration = Math.min(op.minDuration, performance.duration);
      op.maxDuration = Math.max(op.maxDuration, performance.duration);
      op.averageDuration = op.totalDuration / op.count;
    }

    return { byOperation };
  }

  aggregateSystem(startTime, endTime) {
    const systemMetrics = Array.from(this.metrics.system.values())
      .filter(sys => sys.timestamp >= startTime && sys.timestamp <= endTime);

    if (systemMetrics.length === 0) return null;

    const latest = systemMetrics[systemMetrics.length - 1];
    const oldest = systemMetrics[0];

    return {
      latest,
      memoryTrend: this.calculateTrend(systemMetrics.map(s => s.memory.heapUsed)),
      cpuTrend: this.calculateTrend(systemMetrics.map(s => s.cpu.user + s.cpu.system))
    };
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = (last - first) / first;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  countMetrics(metricsMap, since) {
    return Array.from(metricsMap.values())
      .filter(metric => metric.timestamp >= since).length;
  }

  calculateRate(metricsMap, since, windowSeconds) {
    const count = this.countMetrics(metricsMap, since);
    return count / windowSeconds;
  }

  calculateAverageResponseTime(since = Date.now() - 5 * 60 * 1000) {
    const responses = Array.from(this.metrics.responses.values())
      .filter(res => res.timestamp >= since);

    if (responses.length === 0) return 0;

    const totalTime = responses.reduce((sum, res) => sum + res.responseTime, 0);
    return totalTime / responses.length;
  }

  calculateErrorRate(since = Date.now() - 5 * 60 * 1000) {
    const totalRequests = this.countMetrics(this.metrics.requests, since);
    const totalErrors = this.countMetrics(this.metrics.errors, since);

    return totalRequests > 0 ? totalErrors / totalRequests : 0;
  }

  calculateMemoryUsage() {
    const latest = this.getLatestSystemMetrics();
    if (!latest) return 0;

    return latest.memory.heapUsed / latest.memory.heapTotal;
  }

  getLatestSystemMetrics() {
    const systemMetrics = Array.from(this.metrics.system.values());
    return systemMetrics.length > 0 ? systemMetrics[systemMetrics.length - 1] : null;
  }

  getStatusCodeDistribution(since = Date.now() - 5 * 60 * 1000) {
    const responses = Array.from(this.metrics.responses.values())
      .filter(res => res.timestamp >= since);

    const distribution = {};
    for (const response of responses) {
      distribution[response.statusCode] = (distribution[response.statusCode] || 0) + 1;
    }

    return distribution;
  }

  getOverallHealth() {
    const errorRate = this.calculateErrorRate();
    const avgResponseTime = this.calculateAverageResponseTime();
    const memoryUsage = this.calculateMemoryUsage();

    if (errorRate > this.config.alertThresholds.errorRate) return 'unhealthy';
    if (avgResponseTime > this.config.alertThresholds.responseTime) return 'degraded';
    if (memoryUsage > this.config.alertThresholds.memoryUsage) return 'degraded';

    return 'healthy';
  }

  checkAlerts(responseData) {
    // Check response time alert
    if (responseData.responseTime > this.config.alertThresholds.responseTime) {
      this.emit('alert', {
        type: 'high_response_time',
        value: responseData.responseTime,
        threshold: this.config.alertThresholds.responseTime,
        endpoint: responseData.endpoint
      });
    }

    // Check error rate alert
    const errorRate = this.calculateErrorRate();
    if (errorRate > this.config.alertThresholds.errorRate) {
      this.emit('alert', {
        type: 'high_error_rate',
        value: errorRate,
        threshold: this.config.alertThresholds.errorRate
      });
    }
  }

  startMetricsAggregation() {
    setInterval(() => {
      this.recordSystemMetrics();
      this.cleanupOldMetrics();
    }, this.config.aggregationInterval);
  }

  startHealthChecks() {
    setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        this.emit('health', health);
      } catch (error) {
        logger.error('[metrics-collector] Health check failed:', error);
      }
    }, this.config.healthCheckInterval);
  }

  cleanupOldMetrics() {
    const cutoff = Date.now() - (this.config.metricsRetentionDays * 24 * 60 * 60 * 1000);

    for (const [key, metricsMap] of Object.entries(this.metrics)) {
      for (const [id, metric] of metricsMap) {
        if (metric.timestamp < cutoff) {
          metricsMap.delete(id);
        }
      }
    }
  }

  async loadHistoricalMetrics() {
    try {
      const historical = await cacheManager.get('historical_metrics');
      if (historical) {
        // Load historical data if needed
        logger.info('[metrics-collector] Loaded historical metrics');
      }
    } catch (error) {
      logger.warn('[metrics-collector] Could not load historical metrics:', error);
    }
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generatePerformanceId() {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCustomMetricId() {
    return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get service health status
   */
  async getHealth() {
    const health = await this.getHealthStatus();
    return {
      status: health.status,
      details: {
        initialized: this.isInitialized,
        metrics: {
          totalRequests: this.metrics.requests.size,
          totalResponses: this.metrics.responses.size,
          totalErrors: this.metrics.errors.size,
          totalPerformance: this.metrics.performance.size,
          totalSystem: this.metrics.system.size,
          totalCustom: this.metrics.custom.size,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          overallHealth: health.status
        }
      }
    };
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();
export default metricsCollector; 