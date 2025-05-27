/**
 * Prometheus metrics configuration
 * Exposes key metrics for monitoring
 */
import client from 'prom-client';
import { setupLogger } from '../utils/logger.js';

const logger = setupLogger('metrics');

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (GC, memory, etc.)
client.collectDefaultMetrics({ register });

// Define custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'tenant_id']
});

const refreshJobsAdded = new client.Counter({
  name: 'regulation_refresh_jobs_added_total',
  help: 'Total number of regulation refresh jobs added to queue',
  labelNames: ['source']
});

const refreshJobsCompleted = new client.Counter({
  name: 'regulation_refresh_jobs_completed_total',
  help: 'Total number of regulation refresh jobs completed',
  labelNames: ['source', 'status']
});

const refreshJobDuration = new client.Histogram({
  name: 'regulation_refresh_job_duration_seconds',
  help: 'Duration of regulation refresh jobs in seconds',
  labelNames: ['source', 'status'],
  buckets: [1, 5, 15, 30, 60, 120, 300, 600]
});

const cdcLagGauge = new client.Gauge({
  name: 'cdc_replication_lag_seconds',
  help: 'Lag in seconds between database changes and CDC processing',
  labelNames: ['table']
});

const activeTenants = new client.Gauge({
  name: 'active_tenants',
  help: 'Number of active tenants in the last 5 minutes'
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(refreshJobsAdded);
register.registerMetric(refreshJobsCompleted);
register.registerMetric(refreshJobDuration);
register.registerMetric(cdcLagGauge);
register.registerMetric(activeTenants);

// Express middleware for HTTP metrics
const httpMetricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Record when response finishes
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = req.route?.path || req.path;
    const tenantId = req.tenantId || 'unknown';
    
    // Increment request counter
    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
      tenant_id: tenantId
    });
    
    // Record request duration
    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode,
        tenant_id: tenantId
      },
      duration
    );
  });
  
  next();
};

// Set up metrics endpoint
const setupMetricsEndpoint = (app) => {
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error('Error generating metrics:', error);
      res.status(500).end();
    }
  });
  
  logger.info('Prometheus metrics endpoint configured at /metrics');
};

export const metrics = {
  httpRequestDuration,
  httpRequestTotal,
  refreshJobsAdded,
  refreshJobsCompleted,
  refreshJobDuration,
  cdcLagGauge,
  activeTenants,
  register,
  httpMetricsMiddleware,
  setupMetricsEndpoint
}; 