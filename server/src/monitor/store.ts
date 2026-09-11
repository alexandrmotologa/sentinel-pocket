import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  Incident,
  IncidentStatus,
  LatencyTick,
  MaintenanceWindow,
  OnCallShift,
  PostMortem,
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
        status TEXT NOT NULL CHECK (status IN ('HEALTHY', 'DEGRADED', 'DOWN', 'MAINTENANCE')),
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

      CREATE TABLE IF NOT EXISTS post_mortems (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL UNIQUE,
        service_id TEXT NOT NULL,
        title TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        resolved_at INTEGER NOT NULL,
        downtime_seconds INTEGER NOT NULL,
        acknowledged_by TEXT,
        root_cause TEXT NOT NULL,
        remediation_action TEXT NOT NULL,
        failed_checks_count INTEGER NOT NULL,
        markdown_report TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS maintenance_windows (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL,
        title TEXT NOT NULL,
        starts_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        reason TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS on_call_shifts (
        id TEXT PRIMARY KEY,
        primary_operator TEXT NOT NULL,
        secondary_operator TEXT,
        started_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS notification_preferences (
        service_id TEXT PRIMARY KEY,
        level TEXT NOT NULL CHECK (level IN ('CRITICAL_LOUD', 'SILENT', 'MUTED')),
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
      );
    `);

    // Ensure default on-call shift exists
    this.ensureDefaultOnCall();
  }

  private ensureDefaultOnCall(): void {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM on_call_shifts`);
    const row = stmt.get() as any;
    if (row && Number(row.count) === 0) {
      const now = Date.now();
      const insert = this.db.prepare(`
        INSERT INTO on_call_shifts (id, primary_operator, secondary_operator, started_at, updated_at, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insert.run('shift_current', 'alexandrmotologa', 'devops_oncall', now, now, 'Primary 24/7 on-call rotation');
    }
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
    const now = Date.now();

    return rows.map((row) => {
      // Check active maintenance windows
      const isUnderMaintenance = this.isServiceUnderMaintenance(row.id, now);
      const notifLevel = this.getNotificationPreference(row.id);

      return {
        id: row.id,
        name: row.name,
        url: row.url,
        status: isUnderMaintenance ? 'MAINTENANCE' : row.status,
        latencyP95: Number(row.latencyP95),
        lastCheck: Number(row.lastCheck),
        silencedUntil: row.silencedUntil ? Number(row.silencedUntil) : null,
        recentLatencies: this.getRecentLatencyTicks(row.id, 20),
        notificationLevel: notifLevel,
      };
    });
  }

  public getServiceById(id: string): Service | null {
    const stmt = this.db.prepare(`
      SELECT id, name, url, status, latency_p95 as latencyP95, last_check as lastCheck, silenced_until as silencedUntil
      FROM services
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    const now = Date.now();
    const isUnderMaintenance = this.isServiceUnderMaintenance(row.id, now);

    return {
      id: row.id,
      name: row.name,
      url: row.url,
      status: isUnderMaintenance ? 'MAINTENANCE' : row.status,
      latencyP95: Number(row.latencyP95),
      lastCheck: Number(row.lastCheck),
      silencedUntil: row.silencedUntil ? Number(row.silencedUntil) : null,
      recentLatencies: this.getRecentLatencyTicks(row.id, 20),
      notificationLevel: this.getNotificationPreference(row.id),
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

  public getIncidentById(id: string): Incident | null {
    const stmt = this.db.prepare(`
      SELECT id, service_id as serviceId, title, status, severity,
             started_at as startedAt, resolved_at as resolvedAt,
             error_details as errorDetails, acknowledged_by as acknowledgedBy
      FROM incidents
      WHERE id = ?
    `);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapIncident(row);
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

  // --- Post-Mortem Methods ---
  public savePostMortem(pm: PostMortem): void {
    const stmt = this.db.prepare(`
      INSERT INTO post_mortems (
        id, incident_id, service_id, title, started_at, resolved_at,
        downtime_seconds, acknowledged_by, root_cause, remediation_action,
        failed_checks_count, markdown_report, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(incident_id) DO UPDATE SET
        markdown_report = excluded.markdown_report,
        root_cause = excluded.root_cause,
        remediation_action = excluded.remediation_action
    `);

    stmt.run(
      pm.id,
      pm.incidentId,
      pm.serviceId,
      pm.title,
      pm.startedAt,
      pm.resolvedAt,
      pm.downtimeSeconds,
      pm.acknowledgedBy || null,
      pm.rootCause,
      pm.remediationAction,
      pm.failedChecksCount,
      pm.markdownReport,
      pm.createdAt
    );
  }

  public getPostMortemByIncidentId(incidentId: string): PostMortem | null {
    const stmt = this.db.prepare(`
      SELECT * FROM post_mortems WHERE incident_id = ?
    `);
    const row = stmt.get(incidentId) as any;
    if (!row) return null;
    return {
      id: row.id,
      incidentId: row.incident_id,
      serviceId: row.service_id,
      title: row.title,
      startedAt: Number(row.started_at),
      resolvedAt: Number(row.resolved_at),
      downtimeSeconds: Number(row.downtime_seconds),
      acknowledgedBy: row.acknowledged_by || undefined,
      rootCause: row.root_cause,
      remediationAction: row.remediation_action,
      failedChecksCount: Number(row.failed_checks_count),
      markdownReport: row.markdown_report,
      createdAt: Number(row.created_at),
    };
  }

  public getPostMortems(limit = 20): PostMortem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM post_mortems ORDER BY created_at DESC LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];
    return rows.map((row) => ({
      id: row.id,
      incidentId: row.incident_id,
      serviceId: row.service_id,
      title: row.title,
      startedAt: Number(row.started_at),
      resolvedAt: Number(row.resolved_at),
      downtimeSeconds: Number(row.downtime_seconds),
      acknowledgedBy: row.acknowledged_by || undefined,
      rootCause: row.root_cause,
      remediationAction: row.remediation_action,
      failedChecksCount: Number(row.failed_checks_count),
      markdownReport: row.markdown_report,
      createdAt: Number(row.created_at),
    }));
  }

  // --- Maintenance Windows ---
  public createMaintenanceWindow(window: MaintenanceWindow): void {
    const stmt = this.db.prepare(`
      INSERT INTO maintenance_windows (id, service_id, title, starts_at, ends_at, created_by, reason, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      window.id,
      window.serviceId,
      window.title,
      window.startsAt,
      window.endsAt,
      window.createdBy,
      window.reason || null,
      window.active ? 1 : 0
    );
  }

  public getMaintenanceWindows(activeOnly = true): MaintenanceWindow[] {
    const now = Date.now();
    let query = `SELECT * FROM maintenance_windows`;
    if (activeOnly) {
      query += ` WHERE active = 1 AND ends_at > ?`;
      const stmt = this.db.prepare(query + ` ORDER BY starts_at ASC`);
      const rows = stmt.all(now) as any[];
      return rows.map(this.mapMaintenanceWindow);
    }
    const stmt = this.db.prepare(query + ` ORDER BY starts_at DESC LIMIT 30`);
    const rows = stmt.all() as any[];
    return rows.map(this.mapMaintenanceWindow);
  }

  public isServiceUnderMaintenance(serviceId: string, timestamp: number): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM maintenance_windows
      WHERE service_id = ? AND active = 1 AND starts_at <= ? AND ends_at >= ?
    `);
    const row = stmt.get(serviceId, timestamp, timestamp) as any;
    return row && Number(row.count) > 0;
  }

  private mapMaintenanceWindow(r: any): MaintenanceWindow {
    return {
      id: r.id,
      serviceId: r.service_id,
      title: r.title,
      startsAt: Number(r.starts_at),
      endsAt: Number(r.ends_at),
      createdBy: r.created_by,
      reason: r.reason || undefined,
      active: Number(r.active) === 1,
    };
  }

  // --- On-Call Management ---
  public getCurrentOnCall(): OnCallShift {
    const stmt = this.db.prepare(`
      SELECT * FROM on_call_shifts ORDER BY rowid DESC LIMIT 1
    `);
    const row = stmt.get() as any;
    if (row) {
      return {
        id: row.id,
        primaryOperator: row.primary_operator,
        secondaryOperator: row.secondary_operator || undefined,
        startedAt: Number(row.started_at),
        updatedAt: Number(row.updated_at),
        notes: row.notes || undefined,
      };
    }
    return {
      id: 'shift_default',
      primaryOperator: 'alexandrmotologa',
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  public setOnCall(primary: string, secondary?: string, notes?: string): OnCallShift {
    const now = Date.now();
    const id = `shift_${now}`;
    const stmt = this.db.prepare(`
      INSERT INTO on_call_shifts (id, primary_operator, secondary_operator, started_at, updated_at, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, primary, secondary || null, now, now, notes || null);
    return {
      id,
      primaryOperator: primary,
      secondaryOperator: secondary,
      startedAt: now,
      updatedAt: now,
      notes,
    };
  }

  // --- Notification Preferences ---
  public getNotificationPreference(serviceId: string): 'CRITICAL_LOUD' | 'SILENT' | 'MUTED' {
    const stmt = this.db.prepare(`
      SELECT level FROM notification_preferences WHERE service_id = ?
    `);
    const row = stmt.get(serviceId) as any;
    if (row && row.level) return row.level;
    return 'CRITICAL_LOUD';
  }

  public setNotificationPreference(
    serviceId: string,
    level: 'CRITICAL_LOUD' | 'SILENT' | 'MUTED'
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO notification_preferences (service_id, level, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(service_id) DO UPDATE SET
        level = excluded.level,
        updated_at = excluded.updated_at
    `);
    stmt.run(serviceId, level, Date.now());
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
