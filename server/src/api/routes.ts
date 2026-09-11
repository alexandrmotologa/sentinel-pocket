import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppConfig } from '../config.js';
import { HealthChecker } from '../monitor/checker.js';
import { MonitorStore } from '../monitor/store.js';
import { verifyTelegramWebAppData } from '../security/auth.js';
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
}
