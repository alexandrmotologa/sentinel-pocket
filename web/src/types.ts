export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'MAINTENANCE';

export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type IncidentSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type RunbookStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export type RunbookActionId =
  | 'restart_container'
  | 'rollback_canary'
  | 'flush_cache'
  | 'silence_1h'
  | 'silence_24h'
  | 'webhook';

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
  notificationLevel?: 'CRITICAL_LOUD' | 'SILENT' | 'MUTED';
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

export interface PostMortem {
  id: string;
  incidentId: string;
  serviceId: string;
  title: string;
  startedAt: number;
  resolvedAt: number;
  downtimeSeconds: number;
  acknowledgedBy?: string;
  rootCause: string;
  remediationAction: string;
  failedChecksCount: number;
  markdownReport: string;
  createdAt: number;
}

export interface DiagnosticsResult {
  incidentId: string;
  serviceId: string;
  probableCause: string;
  confidenceScore: number;
  recommendedRunbook: RunbookActionId | string;
  reasoning: string[];
  anomalousMetrics: {
    latencyP95: number;
    errorRate: string;
    lastStatusCode?: number;
  };
}

export interface SloMetrics {
  serviceId: string;
  uptimeTarget: number;
  actualUptimePercentage: number;
  totalChecks: number;
  failedChecks: number;
  totalErrorBudgetMinutes: number;
  remainingBudgetMinutes: number;
  budgetDepletedPercentage: number;
  burnRateMultiplier: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface ProbeResult {
  target: string;
  protocol: 'HTTP' | 'HTTPS' | 'TCP';
  statusCode?: number;
  statusMessage?: string;
  dnsLookupMs: number;
  ttfbMs: number;
  totalTimeMs: number;
  ssl?: {
    valid: boolean;
    issuer?: string;
    validTo?: string;
    daysRemaining: number;
    tlsVersion?: string;
  };
  headers?: Record<string, string>;
  isReachable: boolean;
  timestamp: number;
}

export interface MaintenanceWindow {
  id: string;
  serviceId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  createdBy: string;
  reason?: string;
  active: boolean;
}

export interface OnCallShift {
  id: string;
  primaryOperator: string;
  secondaryOperator?: string;
  startedAt: number;
  updatedAt: number;
  notes?: string;
}
