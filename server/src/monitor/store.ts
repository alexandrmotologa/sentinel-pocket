import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  Incident,
  IncidentStatus,
  LatencyTick,
  RunbookExecution,
  Service,
} from '../types.js';

export class MonitorStore {
  private db: DatabaseSync;

  constructor(databasePath: string) {
    if (databasePath !== ':memory:') {
      const dir = path.dirname(databasePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(databasePath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('HEALTHY', 'DEGRADED', 'DOWN')),
        latency_p95 REAL NOT NULL DEFAULT 0,
        last_check INTEGER NOT NULL,
        silenced_until INTEGER
      );

      CREATE TABLE IF NOT EXISTS latency_ticks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        latency_ms REAL NOT NULL,
        status_code INTEGER,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ticks_service_time ON latency_ticks(service_id, timestamp DESC);

      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
        severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
        started_at INTEGER NOT NULL,
        resolved_at INTEGER,
        error_details TEXT,
        acknowledged_by TEXT,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

      CREATE TABLE IF NOT EXISTS runbook_executions (
        id TEXT PRIMARY KEY,
        runbook_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        triggered_by TEXT NOT NULL,
        triggered_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
        output TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_runbook_time ON runbook_executions(triggered_at DESC);
    `);
  }

  public upsertService(service: Service): void {
    const stmt = this.db.prepare(`
      INSERT INTO services (id, name, url, status, latency_p95, last_check, silenced_until)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        url = excluded.url,
        status = excluded.status,
        latency_p95 = excluded.latency_p95,
        last_check = excluded.last_check,
        silenced_until = COALESCE(excluded.silenced_until, services.silenced_until)
    `);

    stmt.run(
      service.id,
      service.name,
      service.url,
      service.status,
      service.latencyP95,
      service.lastCheck,
      service.silencedUntil || null
    );
  }

  public getServices(): Service[] {
    const stmt = this.db.prepare(`
      SELECT id, name, url, status, latency_p95 as latencyP95, last_check as lastCheck, silenced_until as silencedUntil
      FROM services
      ORDER BY name ASC
    `);

    const rows = stmt.all() as any[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      status: row.status,
      latencyP95: Number(row.latencyP95),
      lastCheck: Number(row.lastCheck),
      silencedUntil: row.silencedUntil ? Number(row.silencedUntil) : null,
      recentLatencies: this.getRecentLatencyTicks(row.id, 20),
    }));
  }

  public getServiceById(id: string): Service | null {
    const stmt = this.db.prepare(`
      SELECT id, name, url, status, latency_p95 as latencyP95, last_check as lastCheck, silenced_until as silencedUntil
      FROM services
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      url: row.url,
      status: row.status,
      latencyP95: Number(row.latencyP95),
      lastCheck: Number(row.lastCheck),
      silencedUntil: row.silencedUntil ? Number(row.silencedUntil) : null,
      recentLatencies: this.getRecentLatencyTicks(row.id, 20),
    };
  }

  public recordLatencyTick(tick: LatencyTick): void {
    const stmt = this.db.prepare(`
      INSERT INTO latency_ticks (service_id, timestamp, latency_ms, status_code)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(tick.serviceId, tick.timestamp, tick.latencyMs, tick.statusCode ?? 200);

    // Prune ticks older than 100 entries per service to keep DB compact
    const pruneStmt = this.db.prepare(`
      DELETE FROM latency_ticks
      WHERE service_id = ?
        AND id NOT IN (
          SELECT id FROM latency_ticks
          WHERE service_id = ?
          ORDER BY timestamp DESC
          LIMIT 100
        )
    `);
    pruneStmt.run(tick.serviceId, tick.serviceId);
  }

  public getRecentLatencyTicks(serviceId: string, limit = 20): LatencyTick[] {
    const stmt = this.db.prepare(`
      SELECT id, service_id as serviceId, timestamp, latency_ms as latencyMs, status_code as statusCode
      FROM latency_ticks
      WHERE service_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(serviceId, limit) as any[];
    return rows.reverse().map((r) => ({
      id: r.id,
      serviceId: r.serviceId,
      timestamp: Number(r.timestamp),
      latencyMs: Number(r.latencyMs),
      statusCode: r.statusCode ? Number(r.statusCode) : 200,
    }));
  }

  public createIncident(incident: Incident): void {
    const stmt = this.db.prepare(`
      INSERT INTO incidents (id, service_id, title, status, severity, started_at, resolved_at, error_details, acknowledged_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        resolved_at = excluded.resolved_at,
        error_details = excluded.error_details,
        acknowledged_by = excluded.acknowledged_by
    `);

    stmt.run(
      incident.id,
      incident.serviceId,
      incident.title,
      incident.status,
      incident.severity,
      incident.startedAt,
      incident.resolvedAt ?? null,
      incident.errorDetails ?? null,
      incident.acknowledgedBy ?? null
    );
  }

  public updateIncidentStatus(
    id: string,
    status: IncidentStatus,
    resolvedAt?: number | null,
    acknowledgedBy?: string | null
  ): void {
    const stmt = this.db.prepare(`
      UPDATE incidents
      SET status = ?,
          resolved_at = COALESCE(?, resolved_at),
          acknowledged_by = COALESCE(?, acknowledged_by)
      WHERE id = ?
    `);

    stmt.run(status, resolvedAt ?? null, acknowledgedBy ?? null, id);
  }

  public getIncidents(statusFilter?: string): Incident[] {
    let query = `
      SELECT id, service_id as serviceId, title, status, severity,
             started_at as startedAt, resolved_at as resolvedAt,
             error_details as errorDetails, acknowledged_by as acknowledgedBy
      FROM incidents
    `;

    if (statusFilter && statusFilter !== 'ALL') {
      query += ` WHERE status = ?`;
      const stmt = this.db.prepare(query + ` ORDER BY started_at DESC LIMIT 50`);
      const rows = stmt.all(statusFilter) as any[];
      return rows.map(this.mapIncident);
    }

    query += ` ORDER BY started_at DESC LIMIT 50`;
    const stmt = this.db.prepare(query);
    const rows = stmt.all() as any[];
    return rows.map(this.mapIncident);
  }

  public silenceService(serviceId: string, until: number): void {
    const stmt = this.db.prepare(`
      UPDATE services
      SET silenced_until = ?
      WHERE id = ?
    `);
    stmt.run(until, serviceId);
  }

  public recordRunbookExecution(exec: RunbookExecution): void {
    const stmt = this.db.prepare(`
      INSERT INTO runbook_executions (id, runbook_id, service_id, triggered_by, triggered_at, status, output)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      exec.id,
      exec.runbookId,
      exec.serviceId,
      exec.triggeredBy,
      exec.triggeredAt,
      exec.status,
      exec.output
    );
  }

  public getRunbookExecutions(limit = 30): RunbookExecution[] {
    const stmt = this.db.prepare(`
      SELECT id, runbook_id as runbookId, service_id as serviceId,
             triggered_by as triggeredBy, triggered_at as triggeredAt,
             status, output
      FROM runbook_executions
      ORDER BY triggered_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      runbookId: r.runbookId,
      serviceId: r.serviceId,
      triggeredBy: r.triggeredBy,
      triggeredAt: Number(r.triggeredAt),
      status: r.status,
      output: r.output,
    }));
  }

  private mapIncident(r: any): Incident {
    return {
      id: r.id,
      serviceId: r.serviceId,
      title: r.title,
      status: r.status,
      severity: r.severity,
      startedAt: Number(r.startedAt),
      resolvedAt: r.resolvedAt ? Number(r.resolvedAt) : null,
      errorDetails: r.errorDetails || undefined,
      acknowledgedBy: r.acknowledgedBy || undefined,
    };
  }

  public close(): void {
    this.db.close();
  }
}
