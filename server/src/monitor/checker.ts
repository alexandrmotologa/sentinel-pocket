import { EventEmitter } from 'node:events';
import {
  Incident,
  LatencyTick,
  RunbookActionId,
  RunbookExecution,
  Service,
  ServiceStatus,
} from '../types.js';
import {
  calculateMockTick,
  generateInitialIncidents,
  initializeMockServices,
  MOCK_SERVICES,
} from './mock.js';
import { MonitorStore } from './store.js';

export interface CheckerEvents {
  tick: (tick: LatencyTick) => void;
  serviceUpdated: (service: Service) => void;
  incidentCreated: (incident: Incident) => void;
  incidentUpdated: (incident: Incident) => void;
}

export class HealthChecker extends EventEmitter {
  private store: MonitorStore;
  private isMockMode: boolean;
  private intervalTimer: NodeJS.Timeout | null = null;
  private anomalousServices: Set<string> = new Set();
  private checkIntervalMs: number;

  constructor(store: MonitorStore, isMockMode = true, checkIntervalMs = 5000) {
    super();
    this.store = store;
    this.isMockMode = isMockMode;
    this.checkIntervalMs = checkIntervalMs;

    if (this.isMockMode) {
      this.anomalousServices.add('srv_payments');
    }
  }

  public init(): void {
    const existing = this.store.getServices();
    if (existing.length === 0 && this.isMockMode) {
      const initialServices = initializeMockServices();
      for (const s of initialServices) {
        this.store.upsertService(s);
      }

      const initialIncidents = generateInitialIncidents();
      for (const inc of initialIncidents) {
        this.store.createIncident(inc);
      }
    }
  }

  public start(): void {
    if (this.intervalTimer) return;
    this.init();

    // Run first check immediately
    this.runCheckCycle();

    this.intervalTimer = setInterval(() => {
      this.runCheckCycle();
    }, this.checkIntervalMs);
    if (this.intervalTimer.unref) {
      this.intervalTimer.unref();
    }
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public isAnomalous(serviceId: string): boolean {
    return this.anomalousServices.has(serviceId);
  }

  public triggerAnomaly(serviceId: string, reason?: string): Incident {
    this.anomalousServices.add(serviceId);
    const service = this.store.getServiceById(serviceId);
    const title = reason || `High Latency & Probe Failure detected on ${service?.name || serviceId}`;

    const incident: Incident = {
      id: `inc_${Date.now()}_${serviceId.replace('srv_', '')}`,
      serviceId,
      title,
      status: 'OPEN',
      severity: 'CRITICAL',
      startedAt: Date.now(),
      resolvedAt: null,
      errorDetails: `Anomaly injected. Service exceeded SLA latency thresholds with consecutive timeout errors.`,
    };

    this.store.createIncident(incident);

    if (service) {
      service.status = 'DOWN';
      service.lastCheck = Date.now();
      this.store.upsertService(service);
      this.emit('serviceUpdated', service);
    }

    this.emit('incidentCreated', incident);
    return incident;
  }

  public executeRunbook(
    runbookId: RunbookActionId | string,
    serviceId: string,
    triggeredBy: string,
    reason?: string
  ): RunbookExecution {
    const service = this.store.getServiceById(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    const execId = `exec_${Date.now()}`;
    let output = '';
    let success = true;

    switch (runbookId) {
      case 'restart_container':
        this.anomalousServices.delete(serviceId);
        output = `Container for ${service.name} restarted successfully. Health probes verified (HTTP 200).`;
        break;

      case 'rollback_canary':
        this.anomalousServices.delete(serviceId);
        output = `CanaryMesh traffic shifted 100% to stable baseline for ${service.name}. Canary deployment deactivated.`;
        break;

      case 'flush_cache':
        output = `Purged cache namespace keys for ${service.name}. Evicted 1,420 stale entries.`;
        break;

      case 'silence_1h': {
        const until = Date.now() + 3600 * 1000;
        this.store.silenceService(serviceId, until);
        output = `Alerts for ${service.name} silenced until ${new Date(until).toISOString()}.`;
        break;
      }

      case 'silence_24h': {
        const until = Date.now() + 86400 * 1000;
        this.store.silenceService(serviceId, until);
        output = `Alerts for ${service.name} silenced until ${new Date(until).toISOString()}.`;
        break;
      }

      default:
        success = false;
        output = `Unknown runbook action '${runbookId}' requested.`;
        break;
    }

    const execution: RunbookExecution = {
      id: execId,
      runbookId,
      serviceId,
      triggeredBy,
      triggeredAt: Date.now(),
      status: success ? 'SUCCESS' : 'FAILED',
      output,
    };

    this.store.recordRunbookExecution(execution);

    // If service was restored, mark open incidents as resolved
    if (success && (runbookId === 'restart_container' || runbookId === 'rollback_canary')) {
      const openIncidents = this.store.getIncidents('OPEN').filter((i) => i.serviceId === serviceId);
      for (const inc of openIncidents) {
        this.store.updateIncidentStatus(inc.id, 'RESOLVED', Date.now());
        inc.status = 'RESOLVED';
        inc.resolvedAt = Date.now();
        this.emit('incidentUpdated', inc);
      }

      service.status = 'HEALTHY';
      service.lastCheck = Date.now();
      this.store.upsertService(service);
      this.emit('serviceUpdated', service);
    }

    return execution;
  }

  private runCheckCycle(): void {
    const services = this.store.getServices();
    const now = Date.now();

    for (const service of services) {
      const def = MOCK_SERVICES.find((d) => d.id === service.id) || {
        id: service.id,
        name: service.name,
        url: service.url,
        baseLatency: 50,
      };

      const isAnomalous = this.anomalousServices.has(service.id);
      const { latencyMs, statusCode } = calculateMockTick(def, isAnomalous);

      // Record tick in SQLite
      const tick: LatencyTick = {
        serviceId: service.id,
        timestamp: now,
        latencyMs,
        statusCode,
      };
      this.store.recordLatencyTick(tick);
      this.emit('tick', tick);

      // Determine updated status
      let newStatus: ServiceStatus = 'HEALTHY';
      if (statusCode >= 500 || latencyMs > 2000) {
        newStatus = 'DOWN';
      } else if (statusCode >= 400 || latencyMs > 500) {
        newStatus = 'DEGRADED';
      }

      // Calculate recent P95
      const recent = this.store.getRecentLatencyTicks(service.id, 20);
      const sorted = recent.map((r) => r.latencyMs).sort((a, b) => a - b);
      const p95Idx = Math.floor(sorted.length * 0.95);
      const p95 = sorted[p95Idx] || latencyMs;

      const previousStatus = service.status;
      service.status = newStatus;
      service.latencyP95 = p95;
      service.lastCheck = now;

      this.store.upsertService(service);

      // Status transition notification
      if (previousStatus !== newStatus) {
        this.emit('serviceUpdated', service);

        // If newly degraded or down, check if open incident exists
        if (newStatus !== 'HEALTHY') {
          const open = this.store.getIncidents('OPEN').find((i) => i.serviceId === service.id);
          if (!open) {
            const inc: Incident = {
              id: `inc_${now}_${service.id.replace('srv_', '')}`,
              serviceId: service.id,
              title: `${service.name} status degraded to ${newStatus}`,
              status: 'OPEN',
              severity: newStatus === 'DOWN' ? 'CRITICAL' : 'WARNING',
              startedAt: now,
              resolvedAt: null,
              errorDetails: `Health probe returned HTTP ${statusCode} with latency ${latencyMs}ms.`,
            };
            this.store.createIncident(inc);
            this.emit('incidentCreated', inc);
          }
        }
      }
    }
  }
}
