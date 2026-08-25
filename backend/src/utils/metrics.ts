import client from 'prom-client';

// Collect default Node.js process metrics (memory, CPU, event loop)
client.collectDefaultMetrics({ prefix: 'email_infra_' });

export const httpRequestsTotal = new client.Counter({
  name: 'email_infra_http_requests_total',
  help: 'Total number of HTTP requests received',
  labelNames: ['method', 'route', 'status']
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'email_infra_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

export const emailsSyncedTotal = new client.Counter({
  name: 'email_infra_emails_synced_total',
  help: 'Total number of emails ingested via IMAP',
  labelNames: ['account_id']
});

export const aiClassificationsTotal = new client.Counter({
  name: 'email_infra_ai_classifications_total',
  help: 'Total AI email classifications performed',
  labelNames: ['category', 'model']
});

export const aiClassificationLatency = new client.Histogram({
  name: 'email_infra_ai_classification_latency_seconds',
  help: 'AI classification latency in seconds',
  buckets: [0.1, 0.25, 0.5, 1, 2, 5]
});

export const elasticsearchSearchLatency = new client.Histogram({
  name: 'email_infra_elasticsearch_search_latency_seconds',
  help: 'Elasticsearch search query latency in seconds',
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
});

export const qdrantSearchLatency = new client.Histogram({
  name: 'email_infra_qdrant_search_latency_seconds',
  help: 'Qdrant vector search latency in seconds',
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
});

export async function getPrometheusMetrics(): Promise<string> {
  return await client.register.metrics();
}