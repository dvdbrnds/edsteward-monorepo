/**
 * OpenTelemetry setup for distributed tracing and metrics
 */
import opentelemetry from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { setupLogger } from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();
const logger = setupLogger('telemetry');

// Service name for identification in traces
const serviceName = process.env.SERVICE_NAME || 'regulation-compliance-service';

// OTLP endpoint URL for trace export
const otlpEndpoint = process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

/**
 * Initialize OpenTelemetry SDK
 */
export function initTelemetry() {
  try {
    const sdk = new opentelemetry.NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }),
      traceExporter: new OTLPTraceExporter({
        url: otlpEndpoint
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Enable specific instrumentations
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-pg': { enabled: true },
          '@opentelemetry/instrumentation-redis': { enabled: true },
          '@opentelemetry/instrumentation-aws-sdk': { enabled: true },
          '@opentelemetry/instrumentation-kafkajs': { enabled: true }
        })
      ]
    });
    
    // Initialize the SDK and register with the OpenTelemetry API
    sdk.start()
      .then(() => logger.info('OpenTelemetry initialized'))
      .catch(error => logger.error('Error initializing OpenTelemetry', error));
    
    // Graceful shutdown
    const shutdown = async () => {
      try {
        await sdk.shutdown();
        logger.info('OpenTelemetry SDK shut down successfully');
      } catch (error) {
        logger.error('Error shutting down OpenTelemetry SDK', error);
      }
    };
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
    return sdk;
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry:', error);
    // Don't crash the application if telemetry fails
    return null;
  }
}

/**
 * Add tenant context to active span
 */
export function addTenantToSpan(tenantId) {
  const { trace } = require('@opentelemetry/api');
  const activeSpan = trace.getActiveSpan();
  
  if (activeSpan) {
    activeSpan.setAttribute('tenant.id', tenantId);
  }
}

/**
 * Express middleware to add request context to spans
 */
export function telemetryMiddleware(req, res, next) {
  const { trace, context } = require('@opentelemetry/api');
  const activeSpan = trace.getActiveSpan();
  
  if (activeSpan) {
    // Add tenant ID if available
    if (req.tenantId) {
      activeSpan.setAttribute('tenant.id', req.tenantId);
    }
    
    // Add user ID if available
    if (req.user && req.user.id) {
      activeSpan.setAttribute('user.id', req.user.id);
    }
    
    // Add request path for better filtering
    activeSpan.setAttribute('http.route', req.route?.path || req.path);
  }
  
  next();
} 