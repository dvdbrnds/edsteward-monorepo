/**
 * OpenTelemetry Instrumentation for Axiom
 *
 * This module adds OTLP exporters that send traces, logs, and metrics to Axiom.
 * It is designed to coexist with Sentry v9 (which manages its own OTel TracerProvider).
 *
 * Call `setupAxiomTelemetry()` AFTER Sentry.init() so we can attach our exporters
 * to the Sentry-managed TracerProvider rather than creating a conflicting one.
 */

import { trace, metrics, DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions';

const AXIOM_OTLP_URL = 'https://api.axiom.co';

interface AxiomConfig {
  apiToken: string;
  dataset: string;
  serviceName: string;
  environment: string;
  version: string;
}

function getAxiomConfig(): AxiomConfig | null {
  const apiToken = process.env.AXIOM_API_TOKEN;
  if (!apiToken) {
    console.log('[AXIOM] AXIOM_API_TOKEN not set — Axiom telemetry disabled');
    return null;
  }

  return {
    apiToken,
    dataset: process.env.AXIOM_DATASET || 'edsteward-otel',
    serviceName: process.env.OTEL_SERVICE_NAME || 'edsteward-app',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.VERSION || '1.5.15',
  };
}

function makeHeaders(config: AxiomConfig): Record<string, string> {
  return {
    'Authorization': `Bearer ${config.apiToken}`,
    'X-Axiom-Dataset': config.dataset,
  };
}

function buildResource(config: AxiomConfig) {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.version,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.environment,
  });
}

/**
 * Attach an OTLP trace exporter to the existing TracerProvider (managed by Sentry).
 * If no TracerProvider exists (Sentry disabled), traces won't be sent — that's fine,
 * Sentry is the primary trace source.
 */
function setupTraceExporter(config: AxiomConfig): boolean {
  const provider = trace.getTracerProvider();

  const exporter = new OTLPTraceExporter({
    url: `${AXIOM_OTLP_URL}/v1/traces`,
    headers: makeHeaders(config),
  });

  // Sentry v9 registers a NodeTracerProvider with addSpanProcessor support.
  // Try to attach our exporter to it.
  const activeProvider = (provider as any)?.getDelegate?.() ?? provider;
  if (activeProvider && typeof activeProvider.addSpanProcessor === 'function') {
    activeProvider.addSpanProcessor(new BatchSpanProcessor(exporter));
    console.log('[AXIOM] Trace exporter attached to existing TracerProvider');
    return true;
  }

  console.log('[AXIOM] No TracerProvider with addSpanProcessor found — trace export skipped');
  console.log('[AXIOM] (This is normal if Sentry is not configured)');
  return false;
}

/**
 * Create a standalone LoggerProvider that exports to Axiom via OTLP.
 * Sentry does not manage logs, so we create our own provider.
 */
function setupLogExporter(config: AxiomConfig): LoggerProvider {
  const resource = buildResource(config);

  const logExporter = new OTLPLogExporter({
    url: `${AXIOM_OTLP_URL}/v1/logs`,
    headers: makeHeaders(config),
  });

  const loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));

  logs.setGlobalLoggerProvider(loggerProvider);
  console.log('[AXIOM] Log exporter configured');
  return loggerProvider;
}

/**
 * Create a standalone MeterProvider that exports to Axiom via OTLP.
 * Sentry does not manage metrics, so we create our own provider.
 */
function setupMetricExporter(config: AxiomConfig): MeterProvider {
  const resource = buildResource(config);

  const metricExporter = new OTLPMetricExporter({
    url: `${AXIOM_OTLP_URL}/v1/metrics`,
    headers: makeHeaders(config),
  });

  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60_000,
      }),
    ],
  });

  metrics.setGlobalMeterProvider(meterProvider);
  console.log('[AXIOM] Metric exporter configured');
  return meterProvider;
}

let loggerProvider: LoggerProvider | null = null;
let meterProvider: MeterProvider | null = null;

/**
 * Initialize Axiom telemetry exporters.
 * Call this AFTER Sentry.init() so we can attach to Sentry's TracerProvider.
 */
export function setupAxiomTelemetry(): void {
  const config = getAxiomConfig();
  if (!config) return;

  if (process.env.OTEL_LOG_LEVEL === 'debug') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  console.log(`[AXIOM] Initializing telemetry → dataset: ${config.dataset}, service: ${config.serviceName}`);

  setupTraceExporter(config);
  loggerProvider = setupLogExporter(config);
  meterProvider = setupMetricExporter(config);

  console.log('[AXIOM] Telemetry setup complete');
}

/**
 * Graceful shutdown — flush pending telemetry before process exit.
 */
export async function shutdownAxiomTelemetry(): Promise<void> {
  const shutdowns: Promise<void>[] = [];
  if (loggerProvider) shutdowns.push(loggerProvider.shutdown());
  if (meterProvider) shutdowns.push(meterProvider.shutdown());
  await Promise.allSettled(shutdowns);
}

/**
 * Get the Axiom logger for emitting structured log records via OTel.
 * Returns null if Axiom is not configured.
 */
export function getAxiomLogger(name = 'edsteward') {
  if (!loggerProvider) return null;
  return loggerProvider.getLogger(name);
}

/**
 * Get the Axiom meter for recording metrics via OTel.
 * Returns null if Axiom is not configured.
 */
export function getAxiomMeter(name = 'edsteward') {
  if (!meterProvider) return null;
  return meterProvider.getMeter(name);
}
