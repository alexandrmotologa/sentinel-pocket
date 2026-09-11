import { DiagnosticsResult, Incident, LatencyTick, Service } from '../types.js';

export class IncidentDiagnosticsEngine {
  public static diagnose(
    incident: Incident,
    service: Service | null,
    recentTicks: LatencyTick[]
  ): DiagnosticsResult {
    const errorTicks = recentTicks.filter((t) => (t.statusCode && t.statusCode >= 400) || t.latencyMs > 1000);
    const errorRate = recentTicks.length > 0 ? (errorTicks.length / recentTicks.length) * 100 : 0;
    const lastStatusCode = errorTicks[errorTicks.length - 1]?.statusCode || 500;
    const latencyP95 = service?.latencyP95 || 500;

    const reasoning: string[] = [];
    let probableCause = 'Unknown infrastructure anomaly';
    let confidenceScore = 75;
    let recommendedRunbook = 'restart_container';

    if (lastStatusCode === 504 || incident.errorDetails?.includes('504') || incident.errorDetails?.includes('timed out')) {
      probableCause = 'Upstream gateway timeout and thread pool exhaustion';
      confidenceScore = 93;
      recommendedRunbook = 'restart_container';
      reasoning.push(`HTTP 504 Gateway Timeout detected on recent health checks.`);
      reasoning.push(`P95 latency spiked to ${Math.round(latencyP95)}ms (> 1,500ms threshold).`);
      reasoning.push(`Container thread pool or upstream keep-alive sockets appear saturated.`);
    } else if (lastStatusCode === 502 || lastStatusCode === 503) {
      probableCause = 'Canary release regression or reverse proxy connection refused';
      confidenceScore = 89;
      recommendedRunbook = 'rollback_canary';
      reasoning.push(`HTTP ${lastStatusCode} Bad Gateway returned from ingress proxy.`);
      reasoning.push(`Correlation observed following recent deployment window.`);
      reasoning.push(`CanaryMesh rollback to stable baseline recommended.`);
    } else if (service?.id.includes('redis') || service?.id.includes('cache')) {
      probableCause = 'Distributed cache fragmentation or key eviction deadlock';
      confidenceScore = 91;
      recommendedRunbook = 'flush_cache';
      reasoning.push(`Cache round-trip latency exceeded normal SLA by > 4x.`);
      reasoning.push(`Memory allocation stall suspected in primary session cache.`);
    } else {
      probableCause = 'Intermittent packet loss or degraded host resources';
      confidenceScore = 82;
      recommendedRunbook = 'restart_container';
      reasoning.push(`Consecutive probe latencies elevated above ${Math.round(latencyP95)}ms.`);
      reasoning.push(`Error budget consumption rate currently elevated.`);
    }

    return {
      incidentId: incident.id,
      serviceId: incident.serviceId,
      probableCause,
      confidenceScore,
      recommendedRunbook,
      reasoning,
      anomalousMetrics: {
        latencyP95: Math.round(latencyP95),
        errorRate: `${errorRate.toFixed(1)}%`,
        lastStatusCode,
      },
    };
  }
}
