import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppConfig } from '../config.js';
import { HealthChecker } from '../monitor/checker.js';
import { IncidentDiagnosticsEngine } from '../monitor/diagnostics.js';
import { ProberEngine } from '../monitor/prober.js';
import { SloCalculator } from '../monitor/slo.js';
import { MonitorStore } from '../monitor/store.js';
import { verifyTelegramWebAppData } from '../security/auth.js';
import { MaintenanceWindow, PostMortem } from '../types.js';
import { SSEManager } from './sse.js';

interface RunbookBody {
  runbookId: string;
  serviceId: string;
  reason?: string;
}

interface AckBody {
  acknowledgedBy?: string;
}

interface AnomalyBody {
  serviceId: string;
  reason?: string;
}

interface ProbeBody {
  target: string;
  timeoutMs?: number;
}

interface MaintenanceBody {
  serviceId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  reason?: string;
}

interface HandoverBody {
  primaryOperator: string;
  secondaryOperator?: string;
  notes?: string;
}

interface NotifPrefBody {
  serviceId: string;
  level: 'CRITICAL_LOUD' | 'SILENT' | 'MUTED';
}

export function registerApiRoutes(
  app: FastifyInstance,
  config: AppConfig,
  store: MonitorStore,
  checker: HealthChecker,
  sse: SSEManager
): void {
  // Authentication pre-handler helper
  const authenticate = (req: FastifyRequest, reply: FastifyReply): any => {
    const authHeader = req.headers.authorization;
    let initData: string | undefined;

    if (authHeader && authHeader.startsWith('tma ')) {
      initData = authHeader.substring(4);
    } else if (typeof req.query === 'object' && req.query !== null && 'initData' in req.query) {
      initData = (req.query as any).initData;
    }

    const result = verifyTelegramWebAppData(initData, config.telegramBotToken, config.mockMode);
    if (!result.valid) {
      reply.status(401).send({ error: 'Unauthorized', message: result.reason || 'Invalid Telegram credentials' });
      return null;
    }
    return result.user;
  };

  // Health probe
  app.get('/healthz', async () => {
    return { status: 'OK', uptime: process.uptime(), mockMode: config.mockMode };
  });

  // Services list
  app.get('/api/services', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const services = store.getServices();
    return services;
  });

  // Incidents list
  app.get('/api/incidents', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const query = req.query as { status?: string };
    const incidents = store.getIncidents(query.status);
    return incidents;
  });

  // Acknowledge incident
  app.post('/api/incidents/:id/ack', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const params = req.params as { id: string };
    const body = (req.body || {}) as AckBody;
    const operator = body.acknowledgedBy || user?.username || user?.first_name || 'Operator';

    store.updateIncidentStatus(params.id, 'ACKNOWLEDGED', null, operator);
    const incident = store.getIncidents('ALL').find((i) => i.id === params.id);
    if (incident) {
      sse.broadcast('incident', { type: 'UPDATED', incident });
    }

    return { success: true, incidentId: params.id, status: 'ACKNOWLEDGED', acknowledgedBy: operator };
  });

  // Runbook trigger
  app.post('/api/runbook/trigger', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const body = req.body as RunbookBody;
    if (!body || !body.runbookId || !body.serviceId) {
      return reply.status(400).send({ error: 'Missing runbookId or serviceId' });
    }

    // Check whitelist if configured
    if (config.allowedTelegramUsers.length > 0 && user && !config.allowedTelegramUsers.includes(user.id)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Operator not on authorized whitelist' });
    }

    const operator = user?.username || user?.first_name || 'WebOperator';

    try {
      const execution = checker.executeRunbook(body.runbookId, body.serviceId, operator, body.reason);
      return execution;
    } catch (err: any) {
      return reply.status(500).send({ error: 'Execution failed', message: err.message });
    }
  });

  // Runbook history
  app.get('/api/runbook/history', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const history = store.getRunbookExecutions(30);
    return history;
  });

  // Trigger synthetic anomaly (useful for demos and testing)
  app.post('/api/anomaly/trigger', async (req, reply) => {
    const body = (req.body || {}) as AnomalyBody;
    const serviceId = body.serviceId || 'srv_payments';
    const incident = checker.triggerAnomaly(serviceId, body.reason);
    return { success: true, incident };
  });

  // SSE Stream
  app.get('/api/stream', (req, reply) => {
    sse.handleConnection(req, reply);
  });

  // --- NEW ADVANCED FEATURE ROUTES ---

  // 1. Instant Health Probe Tool
  app.post('/api/probe', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const body = (req.body || {}) as ProbeBody;
    if (!body.target) {
      return reply.status(400).send({ error: 'Missing target URL to probe' });
    }

    const result = await ProberEngine.probe(body.target, body.timeoutMs);
    return result;
  });

  // 2. Incident Diagnostics
  app.get('/api/incidents/:id/diagnostics', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const params = req.params as { id: string };
    const incident = store.getIncidentById(params.id);
    if (!incident) {
      return reply.status(404).send({ error: 'Incident not found' });
    }

    const service = store.getServiceById(incident.serviceId);
    const recentTicks = store.getRecentLatencyTicks(incident.serviceId, 25);
    const diagnostics = IncidentDiagnosticsEngine.diagnose(incident, service, recentTicks);

    return diagnostics;
  });

  // 3. Post-Mortem Generation and Retrieval
  app.post('/api/incidents/:id/postmortem', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const params = req.params as { id: string };
    const incident = store.getIncidentById(params.id);
    if (!incident) {
      return reply.status(404).send({ error: 'Incident not found' });
    }

    const service = store.getServiceById(incident.serviceId);
    const recentTicks = store.getRecentLatencyTicks(incident.serviceId, 30);
    const diagnostics = IncidentDiagnosticsEngine.diagnose(incident, service, recentTicks);

    const now = Date.now();
    const resolvedAt = incident.resolvedAt || now;
    const downtimeSeconds = Math.max(1, Math.floor((resolvedAt - incident.startedAt) / 1000));
    const failedTicksCount = recentTicks.filter((t) => (t.statusCode && t.statusCode >= 500) || t.latencyMs > 1500).length;

    const markdownReport =
      `# Incident Post-Mortem: ${incident.title}\n\n` +
      `| Field | Value |\n` +
      `|---|---|\n` +
      `| **Service** | ${service?.name || incident.serviceId} (\`${service?.url || 'N/A'}\`) |\n` +
      `| **Severity** | \`${incident.severity}\` |\n` +
      `| **Outage Window** | ${new Date(incident.startedAt).toISOString()} to ${new Date(resolvedAt).toISOString()} |\n` +
      `| **Total Downtime** | **${downtimeSeconds} seconds** (${Math.round(downtimeSeconds / 60)} minutes) |\n` +
      `| **Acknowledged By** | @${incident.acknowledgedBy || 'Unacknowledged'} |\n` +
      `| **Remediation Runbook** | \`${diagnostics.recommendedRunbook}\` |\n\n` +
      `## Root Cause Analysis\n` +
      `${diagnostics.probableCause}.\n\n` +
      `### Contributing Factors\n` +
      diagnostics.reasoning.map((r) => `- ${r}`).join('\n') +
      `\n\n` +
      `## Impact & Remediation Summary\n` +
      `- Failed Health Probes: ${failedTicksCount}\n` +
      `- Peak Latency P95: ${diagnostics.anomalousMetrics.latencyP95}ms\n` +
      `- Incident closed and verified by automated telemetry.\n`;

    const pm: PostMortem = {
      id: `pm_${incident.id}`,
      incidentId: incident.id,
      serviceId: incident.serviceId,
      title: incident.title,
      startedAt: incident.startedAt,
      resolvedAt,
      downtimeSeconds,
      acknowledgedBy: incident.acknowledgedBy || undefined,
      rootCause: diagnostics.probableCause,
      remediationAction: diagnostics.recommendedRunbook,
      failedChecksCount: failedTicksCount,
      markdownReport,
      createdAt: now,
    };

    store.savePostMortem(pm);
    return pm;
  });

  app.get('/api/incidents/:id/postmortem', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const params = req.params as { id: string };
    const pm = store.getPostMortemByIncidentId(params.id);
    if (!pm) {
      return reply.status(404).send({ error: 'Post-mortem report not found' });
    }
    return pm;
  });

  // 4. Service SLO Metrics & Burn Rate
  app.get('/api/services/:id/slo', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const params = req.params as { id: string };
    const service = store.getServiceById(params.id);
    if (!service) {
      return reply.status(404).send({ error: 'Service not found' });
    }

    const recentTicks = store.getRecentLatencyTicks(service.id, 50);
    const slo = SloCalculator.calculate(service, recentTicks);
    return slo;
  });

  // 5. Maintenance Windows
  app.get('/api/maintenance', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const windows = store.getMaintenanceWindows(false);
    return windows;
  });

  app.post('/api/maintenance', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const body = req.body as MaintenanceBody;
    if (!body || !body.serviceId || !body.title || !body.startsAt || !body.endsAt) {
      return reply.status(400).send({ error: 'Missing required maintenance window fields' });
    }

    const createdBy = user?.username || user?.first_name || 'Operator';
    const window: MaintenanceWindow = {
      id: `maint_${Date.now()}`,
      serviceId: body.serviceId,
      title: body.title,
      startsAt: Number(body.startsAt),
      endsAt: Number(body.endsAt),
      createdBy,
      reason: body.reason,
      active: true,
    };

    store.createMaintenanceWindow(window);

    // Broadcast service update so status changes to MAINTENANCE immediately if current
    const service = store.getServiceById(body.serviceId);
    if (service) {
      sse.broadcast('service', service);
    }

    return window;
  });

  // 6. On-Call Shift Management
  app.get('/api/oncall', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const onCall = store.getCurrentOnCall();
    return onCall;
  });

  app.post('/api/oncall/handover', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const body = req.body as HandoverBody;
    if (!body || !body.primaryOperator) {
      return reply.status(400).send({ error: 'Missing primaryOperator' });
    }

    const updated = store.setOnCall(body.primaryOperator, body.secondaryOperator, body.notes);
    return updated;
  });

  // 7. Notification Urgency Preferences
  app.get('/api/notifications/preferences', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const services = store.getServices();
    const prefs = services.map((s) => ({
      serviceId: s.id,
      name: s.name,
      level: store.getNotificationPreference(s.id),
    }));
    return prefs;
  });

  app.post('/api/notifications/preferences', async (req, reply) => {
    const user = authenticate(req, reply);
    if (!user && !config.mockMode) return;

    const body = req.body as NotifPrefBody;
    if (!body || !body.serviceId || !body.level) {
      return reply.status(400).send({ error: 'Missing serviceId or level' });
    }

    store.setNotificationPreference(body.serviceId, body.level);
    return { success: true, serviceId: body.serviceId, level: body.level };
  });
}
