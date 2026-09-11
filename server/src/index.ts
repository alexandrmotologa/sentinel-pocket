import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerApiRoutes } from './api/routes.js';
import { SSEManager } from './api/sse.js';
import { TelegramBotManager } from './bot/bot.js';
import { config } from './config.js';
import { HealthChecker } from './monitor/checker.js';
import { MonitorStore } from './monitor/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Initialize SQLite store
  const store = new MonitorStore(config.databasePath);

  // Initialize Health checker
  const checker = new HealthChecker(store, config.mockMode, 4000);

  // Initialize SSE broker
  const sse = new SSEManager(checker);

  // Initialize Telegram bot manager
  const botManager = new TelegramBotManager(config, store, checker);

  // Register API routes
  registerApiRoutes(app, config, store, checker, sse);

  // Determine web static assets path
  // In development: ../../web/dist relative to dist/index.js
  // In Docker / production: /app/web/dist or ./public
  const possiblePaths = [
    path.resolve(__dirname, '../../web/dist'),
    path.resolve(__dirname, '../public'),
    path.resolve(process.cwd(), '../web/dist'),
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'web/dist'),
  ];

  let staticPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
      staticPath = p;
      break;
    }
  }

  if (staticPath) {
    app.log.info(`Serving static Web App from: ${staticPath}`);
    await app.register(fastifyStatic, {
      root: staticPath,
      prefix: '/',
    });

    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/healthz')) {
        reply.status(404).send({ error: 'Endpoint Not Found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  // Start background services
  checker.start();
  await botManager.start();

  // Start HTTP server
  try {
    const address = await app.listen({ port: config.port, host: config.host });
    console.log(`🛡️  Sentinel Pocket server running at: ${address}`);
    console.log(`📡  Cockpit WebApp accessible at: ${config.webAppUrl}`);
    console.log(`⚡  Mock Mode: ${config.mockMode ? 'ENABLED' : 'DISABLED'}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    checker.stop();
    await botManager.stop();
    sse.close();
    store.close();
    await app.close();
    console.log('✅ Sentinel Pocket shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();
