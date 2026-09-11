import { describe, it } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import { registerApiRoutes } from '../src/api/routes.js';
import { SSEManager } from '../src/api/sse.js';
import { AppConfig } from '../src/config.js';
import { HealthChecker } from '../src/monitor/checker.js';
import { IncidentDiagnosticsEngine } from '../src/monitor/diagnostics.js';
import { ProberEngine } from '../src/monitor/prober.js';
import { SloCalculator } from '../src/monitor/slo.js';
import { MonitorStore } from '../src/monitor/store.js';
import { Incident, Service } from '../src/types.js';

describe('Advanced Modules: Prober, Diagnostics, SLO & Store', () => {
  it('ProberEngine probes synthetic/internal endpoints with SSL breakdown', async () => {
    const result = await ProberEngine.probe('https://payments.internal.mesh/healthz');
    assert.strictEqual(result.isReachable, true);
    assert.ok(result.ttfbMs > 0);
    assert.ok(result.ssl);
    assert.strictEqual(result.ssl?.valid, true);
    assert.ok(result.ssl?.daysRemaining && result.ssl.daysRemaining > 0);
  });

  it('IncidentDiagnosticsEngine identifies probable cause and recommends runbook', () => {
    const incident: Incident = {
      id: 'inc_test_diag',
      serviceId: 'srv_payments',
      title: '504 Gateway Timeout',
      status: 'OPEN',
      severity: 'CRITICAL',
      startedAt: Date.now() - 60000,
      resolvedAt: null,
      errorDetails: 'HTTP 504 Gateway Timeout timed out after 3000ms',
    };

    const service: Service = {
      id: 'srv_payments',
      name: 'Payment Gateway API',
      url: 'https://payments.internal.mesh/healthz',
      status: 'DOWN',
      latencyP95: 2400,
      lastCheck: Date.now(),
    };

    const recentTicks = [
      { serviceId: 'srv_payments', timestamp: Date.now(), latencyMs: 2400, statusCode: 504 },
      { serviceId: 'srv_payments', timestamp: Date.now() - 4000, latencyMs: 2200, statusCode: 504 },
    ];

    const diag = IncidentDiagnosticsEngine.diagnose(incident, service, recentTicks);
    assert.strictEqual(diag.incidentId, 'inc_test_diag');
    assert.strictEqual(diag.recommendedRunbook, 'restart_container');
    assert.ok(diag.confidenceScore > 80);
    assert.match(diag.probableCause, /thread pool/i);
  });

  it('SloCalculator calculates 30-day error budget and burn rate', () => {
    const service: Service = {
      id: 'srv_payments',
      name: 'Payment Gateway API',
      url: 'https://payments.internal.mesh/healthz',
      status: 'DOWN',
      latencyP95: 2400,
      lastCheck: Date.now(),
    };

    const recentTicks = [
      { serviceId: 'srv_payments', timestamp: Date.now(), latencyMs: 2400, statusCode: 504 },
      { serviceId: 'srv_payments', timestamp: Date.now() - 4000, latencyMs: 120, statusCode: 200 },
    ];

    const slo = SloCalculator.calculate(service, recentTicks);
    assert.strictEqual(slo.uptimeTarget, 99.9);
    assert.strictEqual(slo.burnRateMultiplier, 14.4); // Down = 14.4x critical burn
    assert.strictEqual(slo.status, 'CRITICAL');
  });

  it('MonitorStore handles post-mortems, maintenance windows, and on-call rotation', () => {
    const store = new MonitorStore(':memory:');

    // Seed services for foreign key constraints
    store.upsertService({
      id: 'srv_db_replica',
      name: 'PostgreSQL Read Replica',
      url: 'tcp://postgres-replica.internal:5432',
      status: 'HEALTHY',
      latencyP95: 25,
      lastCheck: Date.now(),
    });

    store.upsertService({
      id: 'srv_payments',
      name: 'Payment Gateway API',
      url: 'https://payments.internal.mesh/healthz',
      status: 'DOWN',
      latencyP95: 2400,
      lastCheck: Date.now(),
    });

    // On-call default and handover
    const currentOnCall = store.getCurrentOnCall();
    assert.ok(currentOnCall.primaryOperator);

    const updatedOnCall = store.setOnCall('new_oncall_dev', 'backup_dev', 'Weekend shift');
    assert.strictEqual(updatedOnCall.primaryOperator, 'new_oncall_dev');
    assert.strictEqual(store.getCurrentOnCall().primaryOperator, 'new_oncall_dev');

    // Maintenance windows
    const now = Date.now();
    store.createMaintenanceWindow({
      id: 'maint_test_1',
      serviceId: 'srv_db_replica',
      title: 'Postgres OS upgrade',
      startsAt: now - 1000,
      endsAt: now + 3600000,
      createdBy: 'alexandrmotologa',
      active: true,
    });

    assert.strictEqual(store.isServiceUnderMaintenance('srv_db_replica', now), true);
    assert.strictEqual(store.isServiceUnderMaintenance('srv_payments', now), false);

    // Notification preferences
    assert.strictEqual(store.getNotificationPreference('srv_payments'), 'CRITICAL_LOUD');
    store.setNotificationPreference('srv_payments', 'SILENT');
    assert.strictEqual(store.getNotificationPreference('srv_payments'), 'SILENT');

    store.close();
  });
});

describe('Advanced API Endpoints', () => {
  const testConfig: AppConfig = {
    telegramBotToken: 'mock_token',
    webAppUrl: 'http://localhost:8080',
    port: 8080,
    host: '127.0.0.1',
    mockMode: true,
    sentinelEndpoint: 'http://localhost:9090',
    canaryMeshEndpoint: 'http://localhost:8000',
    allowedTelegramUsers: [],
    databasePath: ':memory:',
  };

  const createTestApp = () => {
    const app = Fastify({ logger: false });
    const store = new MonitorStore(':memory:');
    const checker = new HealthChecker(store, true, 10000);
    checker.init();
    const sse = new SSEManager(checker);

    registerApiRoutes(app, testConfig, store, checker, sse);
    return { app, store, checker, sse };
  };

  it('POST /api/probe returns target metrics', async () => {
    const { app, store, sse } = createTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/probe',
      headers: { authorization: 'tma mock' },
      payload: { target: 'https://auth.internal.mesh/health' },
    });

    assert.strictEqual(res.statusCode, 200);
    const probe = JSON.parse(res.payload);
    assert.strictEqual(probe.isReachable, true);
    assert.ok(probe.ttfbMs > 0);

    sse.close();
    store.close();
    await app.close();
  });

  it('GET /api/oncall and POST /api/oncall/handover', async () => {
    const { app, store, sse } = createTestApp();
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/oncall',
      headers: { authorization: 'tma mock' },
    });
    assert.strictEqual(getRes.statusCode, 200);

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/oncall/handover',
      headers: { authorization: 'tma mock' },
      payload: { primaryOperator: 'senior_sre', notes: 'Evening shift' },
    });
    assert.strictEqual(postRes.statusCode, 200);
    const updated = JSON.parse(postRes.payload);
    assert.strictEqual(updated.primaryOperator, 'senior_sre');

    sse.close();
    store.close();
    await app.close();
  });

  it('POST /api/incidents/:id/postmortem generates markdown report', async () => {
    const { app, store, sse } = createTestApp();
    const incidents = store.getIncidents('ALL');
    assert.ok(incidents.length > 0);
    const incidentId = incidents[0].id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/incidents/${incidentId}/postmortem`,
      headers: { authorization: 'tma mock' },
    });

    assert.strictEqual(res.statusCode, 200);
    const pm = JSON.parse(res.payload);
    assert.strictEqual(pm.incidentId, incidentId);
    assert.ok(pm.markdownReport.includes('Incident Post-Mortem'));
    assert.ok(pm.markdownReport.includes('Root Cause Analysis'));

    sse.close();
    store.close();
    await app.close();
  });
});
