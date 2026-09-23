'use strict';
// ── OpenTelemetry auto-instrumentation ──────────────────────────────────
// Loaded before the app via `node -r ./src/tracing.js`. Automatically
// instruments http, express, pg and ioredis so every request produces a
// trace, without touching any of the existing prom-client metrics or
// winston logs. Traces are exported over OTLP/HTTP to the otel-collector,
// which forwards them to Tempo for viewing/correlation in Grafana.
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');

if (process.env.OTEL_DEBUG === 'true') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

const serviceName = process.env.OTEL_SERVICE_NAME || 'unknown-service';
const otlpBase = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4318').replace(/\/$/, '');

const sdk = new NodeSDK({
  resource: new Resource({
    'service.name': serviceName,
    'service.namespace': 'ticketops',
    'deployment.environment': process.env.NODE_ENV || 'development',
  }),
  traceExporter: new OTLPTraceExporter({ url: `${otlpBase}/v1/traces` }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // very noisy / not useful for this app — keep spans focused on
      // http, express, pg and ioredis (all enabled by default)
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

try {
  sdk.start();
  // eslint-disable-next-line no-console
  console.log(`[otel] tracing initialized for "${serviceName}" -> ${otlpBase}/v1/traces`);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[otel] failed to initialize tracing', err);
}

const shutdown = () => {
  sdk.shutdown()
    .then(() => console.log('[otel] tracing shut down'))
    .catch((err) => console.error('[otel] error shutting down tracing', err))
    .finally(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = sdk;
