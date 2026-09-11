import { FastifyReply, FastifyRequest } from 'fastify';
import { HealthChecker } from '../monitor/checker.js';

export class SSEManager {
  private clients: Set<FastifyReply> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private checker: HealthChecker;

  constructor(checker: HealthChecker) {
    this.checker = checker;
    this.setupListeners();
    this.startHeartbeat();
  }

  private setupListeners(): void {
    this.checker.on('tick', (tick) => {
      this.broadcast('tick', tick);
    });

    this.checker.on('serviceUpdated', (service) => {
      this.broadcast('service', service);
    });

    this.checker.on('incidentCreated', (incident) => {
      this.broadcast('incident', { type: 'CREATED', incident });
    });

    this.checker.on('incidentUpdated', (incident) => {
      this.broadcast('incident', { type: 'UPDATED', incident });
    });
  }

  public handleConnection(req: FastifyRequest, reply: FastifyReply): void {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    // Flush headers immediately
    reply.raw.flushHeaders();

    this.clients.add(reply);

    // Initial connection established comment
    reply.raw.write(`: connected\n\n`);

    req.raw.on('close', () => {
      this.clients.delete(reply);
    });
  }

  public broadcast(event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.raw.write(payload);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        try {
          client.raw.write(`: keep-alive\n\n`);
        } catch {
          this.clients.delete(client);
        }
      }
    }, 15000);
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const client of this.clients) {
      try {
        client.raw.end();
      } catch {
        // Ignored during shutdown
      }
    }
    this.clients.clear();
  }
}
