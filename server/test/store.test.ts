import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MonitorStore } from '../src/monitor/store.js';

describe('MonitorStore (SQLite)', () => {
  it('initializes in-memory schema and handles service CRUD', () => {
    const store = new MonitorStore(':memory:');

    store.upsertService({
      id: 'srv_test',
      name: 'Test Service',
      url: 'http://localhost:3000/health',
      status: 'HEALTHY',
      latencyP95: 45,
      lastCheck: Date.now(),
    });

    const services = store.getServices();
    assert.strictEqual(services.length, 1);
    assert.strictEqual(services[0].id, 'srv_test');
    assert.strictEqual(services[0].status, 'HEALTHY');

    const single = store.getServiceById('srv_test');
    assert.ok(single);
    assert.strictEqual(single?.name, 'Test Service');

    store.close();
  });

  it('records latency ticks and retrieves recent points', () => {
    const store = new MonitorStore(':memory:');

    store.upsertService({
      id: 'srv_metrics',
      name: 'Metrics Service',
      url: 'http://localhost:3000/metrics',
      status: 'HEALTHY',
      latencyP95: 20,
      lastCheck: Date.now(),
    });

    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      store.recordLatencyTick({
        serviceId: 'srv_metrics',
        timestamp: now + i * 1000,
        latencyMs: 15 + i * 2,
        statusCode: 200,
      });
    }

    const ticks = store.getRecentLatencyTicks('srv_metrics', 10);
    assert.strictEqual(ticks.length, 5);
    assert.strictEqual(ticks[0].latencyMs, 15);
    assert.strictEqual(ticks[4].latencyMs, 23);

    store.close();
  });

  it('manages incident lifecycle: create, update, and filter', () => {
    const store = new MonitorStore(':memory:');

    store.upsertService({
      id: 'srv_auth',
      name: 'Auth Service',
      url: 'http://localhost:3000/auth',
      status: 'HEALTHY',
      latencyP95: 50,
      lastCheck: Date.now(),
    });

    store.createIncident({
      id: 'inc_1',
      serviceId: 'srv_auth',
      title: 'High 500 error rate',
      status: 'OPEN',
      severity: 'CRITICAL',
      startedAt: Date.now(),
      resolvedAt: null,
      errorDetails: 'Database connection pool exhausted',
    });

    let openIncidents = store.getIncidents('OPEN');
    assert.strictEqual(openIncidents.length, 1);
    assert.strictEqual(openIncidents[0].id, 'inc_1');

    store.updateIncidentStatus('inc_1', 'RESOLVED', Date.now(), 'alexandrmotologa');
    openIncidents = store.getIncidents('OPEN');
    assert.strictEqual(openIncidents.length, 0);

    const allIncidents = store.getIncidents('ALL');
    assert.strictEqual(allIncidents.length, 1);
    assert.strictEqual(allIncidents[0].status, 'RESOLVED');
    assert.strictEqual(allIncidents[0].acknowledgedBy, 'alexandrmotologa');

    store.close();
  });

  it('logs runbook execution events', () => {
    const store = new MonitorStore(':memory:');

    store.recordRunbookExecution({
      id: 'exec_101',
      runbookId: 'restart_container',
      serviceId: 'srv_auth',
      triggeredBy: 'alexandrmotologa',
      triggeredAt: Date.now(),
      status: 'SUCCESS',
      output: 'Container restarted successfully.',
    });

    const history = store.getRunbookExecutions();
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].id, 'exec_101');
    assert.strictEqual(history[0].runbookId, 'restart_container');

    store.close();
  });
});
