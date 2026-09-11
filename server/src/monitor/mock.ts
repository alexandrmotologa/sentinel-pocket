import { Incident, Service } from '../types.js';

export interface MockServiceDefinition {
  id: string;
  name: string;
  url: string;
  baseLatency: number;
}

export const MOCK_SERVICES: MockServiceDefinition[] = [
  {
    id: 'srv_payments',
    name: 'Payment Gateway API',
    url: 'https://payments.internal.mesh/healthz',
    baseLatency: 120,
  },
  {
    id: 'srv_auth',
    name: 'OAuth2 Identity Provider',
    url: 'https://auth.internal.mesh/health',
    baseLatency: 42,
  },
  {
    id: 'srv_redis',
    name: 'Distributed Session Cache',
    url: 'tcp://redis-cluster.internal:6379',
    baseLatency: 6,
  },
  {
    id: 'srv_db_replica',
    name: 'PostgreSQL Read Replica',
    url: 'tcp://postgres-replica.internal:5432',
    baseLatency: 28,
  },
];

export function initializeMockServices(): Service[] {
  const now = Date.now();
  return MOCK_SERVICES.map((def, idx) => ({
    id: def.id,
    name: def.name,
    url: def.url,
    // Start with srv_payments having an intermittent warning or healthy
    status: idx === 0 ? 'DEGRADED' : 'HEALTHY',
    latencyP95: idx === 0 ? 380 : def.baseLatency * 1.3,
    lastCheck: now,
  }));
}

export function generateInitialIncidents(): Incident[] {
  const now = Date.now();
  return [
    {
      id: 'inc_payment_spike',
      serviceId: 'srv_payments',
      title: 'Elevated P95 Latency & 504 Gateway Timeouts',
      status: 'OPEN',
      severity: 'WARNING',
      startedAt: now - 340000,
      resolvedAt: null,
      errorDetails: 'Upstream payment processor timed out after 3,000ms. Error budget consumption rate: 1.8x.',
    },
  ];
}

export function calculateMockTick(
  def: MockServiceDefinition,
  isAnomalous: boolean
): { latencyMs: number; statusCode: number } {
  if (isAnomalous) {
    const jitter = Math.random() * 800 + 1600; // 1,600ms - 2,400ms
    return {
      latencyMs: Math.round(jitter),
      statusCode: Math.random() > 0.4 ? 504 : 500,
    };
  }

  // Normal jitter between -15% and +25%
  const multiplier = 0.85 + Math.random() * 0.4;
  const latency = Math.max(1, Math.round(def.baseLatency * multiplier));
  return {
    latencyMs: latency,
    statusCode: 200,
  };
}
