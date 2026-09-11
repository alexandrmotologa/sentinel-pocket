export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN';

export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type IncidentSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type RunbookStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export type RunbookActionId =
  | 'restart_container'
  | 'rollback_canary'
  | 'flush_cache'
  | 'silence_1h'
  | 'silence_24h';

export interface LatencyTick {
  id?: number;
  serviceId: string;
  timestamp: number;
  latencyMs: number;
  statusCode?: number;
}

export interface Service {
  id: string;
  name: string;
  url: string;
  status: ServiceStatus;
  latencyP95: number;
  lastCheck: number;
  recentLatencies?: LatencyTick[];
  silencedUntil?: number | null;
}

export interface Incident {
  id: string;
  serviceId: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  startedAt: number;
  resolvedAt: number | null;
  errorDetails?: string;
  acknowledgedBy?: string | null;
}

export interface RunbookExecution {
  id: string;
  runbookId: RunbookActionId | string;
  serviceId: string;
  triggeredBy: string;
  triggeredAt: number;
  status: RunbookStatus;
  output: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}
