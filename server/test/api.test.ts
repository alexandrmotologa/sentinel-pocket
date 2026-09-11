import { describe, it } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import { registerApiRoutes } from '../src/api/routes.js';
import { SSEManager } from '../src/api/sse.js';
import { AppConfig } from '../src/config.js';
import { HealthChecker } from '../src/monitor/checker.js';
import { MonitorStore } from '../src/monitor/store.js';

describe('Fastify REST API & Runbooks', () => {
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

  it('GET /healthz returns status OK', async () => {
    const { app, store, sse } = createTestApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.status, 'OK');
    assert.strictEqual(body.mockMode, true);
    sse.close();
    store.close();
    await app.close();
  });

  it('GET /api/services returns mock services in mock mode', async () => {
    const { app, store, sse } = createTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/services',
      headers: { authorization: 'tma mock' },
    });
    assert.strictEqual(res.statusCode, 200);
    const services = JSON.parse(res.payload);
    assert.ok(Array.isArray(services));
    assert.ok(services.length >= 4);
    assert.ok(services.some((s: any) => s.id === 'srv_payments'));
    sse.close();
    store.close();
    await app.close();
  });

  it('POST /api/runbook/trigger executes a restart action', async () => {
    const { app, store, sse } = createTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/runbook/trigger',
      headers: {
        authorization: 'tma mock',
        'content-type': 'application/json',
      },
      payload: {
        runbookId: 'restart_container',
        serviceId: 'srv_payments',
        reason: 'Testing restart',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.strictEqual(result.status, 'SUCCESS');
    assert.strictEqual(result.runbookId, 'restart_container');
    assert.match(result.output, /restarted successfully/i);

    // Verify history endpoint returns the executed action
    const histRes = await app.inject({
      method: 'GET',
      url: '/api/runbook/history',
      headers: { authorization: 'tma mock' },
    });
    assert.strictEqual(histRes.statusCode, 200);
    const history = JSON.parse(histRes.payload);
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].runbookId, 'restart_container');

    sse.close();
    store.close();
    await app.close();
  });
});
