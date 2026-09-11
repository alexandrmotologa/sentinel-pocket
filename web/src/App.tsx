import { useState, useEffect, useCallback } from 'react';
import { Server, AlertOctagon, History, ShieldCheck, Activity } from 'lucide-react';
import { AuditLogViewer } from './components/AuditLogViewer.js';
import { DiagnosticsModal } from './components/DiagnosticsModal.js';
import { Header } from './components/Header.js';
import { IncidentCard } from './components/IncidentCard.js';
import { MaintenanceModal } from './components/MaintenanceModal.js';
import { OnCallBanner } from './components/OnCallBanner.js';
import { PostMortemModal } from './components/PostMortemModal.js';
import { ProbeModal } from './components/ProbeModal.js';
import { RunbookModal } from './components/RunbookModal.js';
import { ServiceCard } from './components/ServiceCard.js';
import { TelegramSimulator } from './components/TelegramSimulator.js';
import { useSSE } from './hooks/useSSE.js';
import { useTelegram } from './hooks/useTelegram.js';
import {
  Incident,
  OnCallShift,
  RunbookActionId,
  RunbookExecution,
  Service,
  SloMetrics,
} from './types.js';

export function App() {
  const {
    isInsideTelegram,
    user,
    setUser,
    initData,
    isDark,
    toggleTheme,
    triggerHaptic,
    triggerNotificationHaptic,
  } = useTelegram();

  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [history, setHistory] = useState<RunbookExecution[]>([]);
  const [sloMap, setSloMap] = useState<Record<string, SloMetrics>>({});
  const [onCall, setOnCall] = useState<OnCallShift | null>(null);

  // Modals state
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isRunbookOpen, setIsRunbookOpen] = useState(false);

  const [isProbeOpen, setIsProbeOpen] = useState(false);
  const [probeTarget, setProbeTarget] = useState('');

  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  const [diagnosticsIncident, setDiagnosticsIncident] = useState<Incident | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const [postMortemIncident, setPostMortemIncident] = useState<Incident | null>(null);
  const [isPostMortemOpen, setIsPostMortemOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'services' | 'incidents' | 'audit'>('services');
  const [isLoading, setIsLoading] = useState(true);

  // Auth header generator
  const getAuthHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      Authorization: `tma ${initData || 'mock'}`,
    };
  }, [initData]);

  // Initial data fetch
  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [srvRes, incRes, histRes, onCallRes] = await Promise.all([
        fetch('/api/services', { headers }),
        fetch('/api/incidents', { headers }),
        fetch('/api/runbook/history', { headers }),
        fetch('/api/oncall', { headers }),
      ]);

      if (srvRes.ok) {
        const srvData: Service[] = await srvRes.json();
        setServices(srvData);

        // Fetch SLO for each service in parallel
        for (const s of srvData) {
          fetch(`/api/services/${s.id}/slo`, { headers })
            .then((r) => r.ok ? r.json() : null)
            .then((slo: SloMetrics | null) => {
              if (slo) {
                setSloMap((prev) => ({ ...prev, [s.id]: slo }));
              }
            })
            .catch(() => {});
        }
      }

      if (incRes.ok) {
        const data = await incRes.json();
        setIncidents(data);
      }

      if (histRes.ok) {
        const data = await histRes.json();
        setHistory(data);
      }

      if (onCallRes.ok) {
        const data = await onCallRes.json();
        setOnCall(data);
      }
    } catch (err) {
      console.error('Failed to fetch initial telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle live Server-Sent Events
  const handleTick = useCallback((tick: any) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== tick.serviceId) return s;
        const currentTicks = s.recentLatencies || [];
        const nextTicks = [...currentTicks.slice(-19), tick];
        return {
          ...s,
          lastCheck: tick.timestamp,
          recentLatencies: nextTicks,
        };
      })
    );
  }, []);

  const handleServiceUpdated = useCallback((updated: Service) => {
    setServices((prev) =>
      prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
    );
  }, []);

  const handleIncidentEvent = useCallback(
    (data: { type: 'CREATED' | 'UPDATED'; incident: Incident }) => {
      setIncidents((prev) => {
        const existingIdx = prev.findIndex((i) => i.id === data.incident.id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = data.incident;
          return next;
        }
        return [data.incident, ...prev];
      });

      if (data.type === 'CREATED') {
        triggerNotificationHaptic('error');
      }
    },
    [triggerNotificationHaptic]
  );

  const { isConnected } = useSSE({
    onTick: handleTick,
    onServiceUpdated: handleServiceUpdated,
    onIncidentEvent: handleIncidentEvent,
  });

  // Action: Acknowledge Incident
  const handleAcknowledge = async (incidentId: string) => {
    triggerHaptic('medium');
    try {
      const res = await fetch(`/api/incidents/${incidentId}/ack`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ acknowledgedBy: user?.username || user?.first_name }),
      });
      if (res.ok) {
        setIncidents((prev) =>
          prev.map((i) =>
            i.id === incidentId
              ? { ...i, status: 'ACKNOWLEDGED', acknowledgedBy: user?.username || 'Operator' }
              : i
          )
        );
        triggerNotificationHaptic('success');
      }
    } catch (err) {
      console.error('Failed to acknowledge incident:', err);
    }
  };

  // Action: Trigger Runbook Execution
  const handleExecuteRunbook = async (
    runbookId: RunbookActionId,
    serviceId: string,
    reason?: string
  ): Promise<string> => {
    const res = await fetch('/api/runbook/trigger', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ runbookId, serviceId, reason }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Remediation failed');
    }

    setHistory((prev) => [data, ...prev]);
    fetchData();
    return data.output;
  };

  // Action: Handover On-Call
  const handleHandover = async (newOperator: string) => {
    const res = await fetch('/api/oncall/handover', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ primaryOperator: newOperator }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOnCall(updated);
    }
  };

  // Action: Toggle Notification Level
  const handleToggleNotification = async (serviceId: string) => {
    const current = services.find((s) => s.id === serviceId)?.notificationLevel || 'CRITICAL_LOUD';
    const next = current === 'CRITICAL_LOUD' ? 'SILENT' : current === 'SILENT' ? 'MUTED' : 'CRITICAL_LOUD';

    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, notificationLevel: next } : s))
    );

    await fetch('/api/notifications/preferences', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ serviceId, level: next }),
    });
  };

  // Action: Quick Anomaly Trigger (Demo)
  const handleTriggerAnomaly = async () => {
    triggerHaptic('heavy');
    try {
      await fetch('/api/anomaly/trigger', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ serviceId: 'srv_payments' }),
      });
      fetchData();
    } catch (err) {
      console.error('Failed to inject anomaly:', err);
    }
  };

  const openIncidents = incidents.filter((i) => i.status === 'OPEN' || i.status === 'ACKNOWLEDGED');
  const healthyCount = services.filter((s) => s.status === 'HEALTHY').length;

  const content = (
    <div className="flex flex-col min-h-full pb-8">
      {/* Cockpit Top Bar */}
      <Header
        isConnected={isConnected}
        user={user}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onTriggerAnomaly={handleTriggerAnomaly}
        onOpenProbe={() => {
          setProbeTarget(services[0]?.url || 'https://payments.internal.mesh/healthz');
          setIsProbeOpen(true);
        }}
        onOpenMaintenance={() => setIsMaintenanceOpen(true)}
        healthyCount={healthyCount}
        totalServices={services.length}
        openIncidentCount={openIncidents.length}
      />

      {/* On-Call Duty Banner */}
      <OnCallBanner
        onCall={onCall}
        onHandover={handleHandover}
        onTriggerHaptic={triggerHaptic}
      />

      {/* Navigation Tabs */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex rounded-xl bg-white/5 p-1 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveTab('services');
              triggerHaptic('light');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'services'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Services</span>
            <span className="text-[10px] font-mono opacity-80">({services.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('incidents');
              triggerHaptic('light');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all relative ${
              activeTab === 'incidents'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Incidents</span>
            {openIncidents.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {openIncidents.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('audit');
              triggerHaptic('light');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <main className="flex-1 px-4 py-3 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-tg-hint text-xs">
            <Activity className="w-8 h-8 animate-spin text-blue-500 mb-2" />
            <span>Synchronizing telemetry stream...</span>
          </div>
        ) : (
          <>
            {/* Services Tab */}
            {activeTab === 'services' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-tg-hint font-medium px-1">
                  <span>Cluster Endpoints</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Flap Protected & SLO Tracked
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {services.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      slo={sloMap[service.id]}
                      onOpenRunbook={(srv) => {
                        setSelectedService(srv);
                        setIsRunbookOpen(true);
                        triggerHaptic('medium');
                      }}
                      onOpenProbe={(srv) => {
                        setProbeTarget(srv.url);
                        setIsProbeOpen(true);
                        triggerHaptic('light');
                      }}
                      onToggleNotificationLevel={handleToggleNotification}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Incidents Tab */}
            {activeTab === 'incidents' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-tg-hint font-medium px-1">
                  <span>Active & Recent Alerts</span>
                  <span>{incidents.length} Total</span>
                </div>

                {incidents.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-tg-secondaryBg border border-white/5 text-center text-xs text-tg-hint">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-tg-text">No active incidents</p>
                    <p className="mt-1 opacity-70">All endpoints are responding within normal SLA limits.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {incidents.map((incident) => {
                      const srv = services.find((s) => s.id === incident.serviceId);
                      return (
                        <IncidentCard
                          key={incident.id}
                          incident={incident}
                          service={srv}
                          onAcknowledge={handleAcknowledge}
                          onOpenRunbook={(targetSrv) => {
                            setSelectedService(targetSrv);
                            setIsRunbookOpen(true);
                            triggerHaptic('medium');
                          }}
                          onOpenDiagnostics={(inc) => {
                            setDiagnosticsIncident(inc);
                            setIsDiagnosticsOpen(true);
                            triggerHaptic('light');
                          }}
                          onOpenPostMortem={(inc) => {
                            setPostMortemIncident(inc);
                            setIsPostMortemOpen(true);
                            triggerHaptic('light');
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Audit Trail Tab */}
            {activeTab === 'audit' && (
              <AuditLogViewer history={history} onRefresh={fetchData} />
            )}
          </>
        )}
      </main>

      {/* 1-Tap Runbook Action Modal */}
      <RunbookModal
        service={selectedService}
        isOpen={isRunbookOpen}
        onClose={() => {
          setIsRunbookOpen(false);
          setSelectedService(null);
        }}
        onExecute={handleExecuteRunbook}
        onTriggerHaptic={triggerHaptic}
      />

      {/* Instant Probe Modal */}
      <ProbeModal
        isOpen={isProbeOpen}
        onClose={() => setIsProbeOpen(false)}
        services={services}
        initialTarget={probeTarget}
        onTriggerHaptic={triggerHaptic}
      />

      {/* Root-Cause Explainer Modal */}
      <DiagnosticsModal
        incident={diagnosticsIncident}
        isOpen={isDiagnosticsOpen}
        onClose={() => {
          setIsDiagnosticsOpen(false);
          setDiagnosticsIncident(null);
        }}
        onExecuteRunbook={handleExecuteRunbook}
        onTriggerHaptic={triggerHaptic}
      />

      {/* Post-Mortem Report Modal */}
      <PostMortemModal
        incident={postMortemIncident}
        isOpen={isPostMortemOpen}
        onClose={() => {
          setIsPostMortemOpen(false);
          setPostMortemIncident(null);
        }}
        onTriggerHaptic={triggerHaptic}
      />

      {/* Maintenance Planner Modal */}
      <MaintenanceModal
        isOpen={isMaintenanceOpen}
        onClose={() => setIsMaintenanceOpen(false)}
        services={services}
        onTriggerHaptic={triggerHaptic}
        onRefreshServices={fetchData}
      />
    </div>
  );

  // If inside Telegram WebApp, render directly. Otherwise, wrap in Telegram Simulator!
  if (isInsideTelegram) {
    return content;
  }

  return (
    <TelegramSimulator
      user={user}
      onSelectUser={(u) => {
        setUser(u);
        triggerHaptic('light');
      }}
      isDark={isDark}
      onToggleTheme={toggleTheme}
    >
      {content}
    </TelegramSimulator>
  );
}
