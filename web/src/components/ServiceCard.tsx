import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, BellOff, ArrowUpRight, Wrench } from 'lucide-react';
import { Service } from '../types.js';
import { LatencySparkline } from './LatencySparkline.js';

interface ServiceCardProps {
  service: Service;
  onOpenRunbook: (service: Service) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onOpenRunbook }) => {
  const isSilenced = service.silencedUntil && service.silencedUntil > Date.now();

  const getStatusBadge = () => {
    switch (service.status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Healthy
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            Degraded
          </span>
        );
      case 'DOWN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
            <XCircle className="w-3.5 h-3.5" />
            Down
          </span>
        );
    }
  };

  const latestTick = service.recentLatencies?.[service.recentLatencies.length - 1];
  const currentLatency = latestTick ? Math.round(latestTick.latencyMs) : Math.round(service.latencyP95);

  let borderStyle = 'border-white/5 hover:border-white/15';
  if (service.status === 'DOWN') {
    borderStyle = 'border-red-500/40 shadow-lg shadow-red-500/10 bg-red-950/20';
  } else if (service.status === 'DEGRADED') {
    borderStyle = 'border-amber-500/30 shadow-lg shadow-amber-500/5 bg-amber-950/10';
  }

  return (
    <div
      className={`p-3.5 rounded-2xl bg-tg-secondaryBg transition-all duration-200 border ${borderStyle}`}
    >
      {/* Top row: Name, URL, Status */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-tg-text truncate">{service.name}</h3>
            {isSilenced && (
              <span title="Alerts silenced" className="text-tg-hint">
                <BellOff className="w-3 h-3 text-amber-400" />
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-tg-hint truncate block opacity-75">
            {service.url}
          </span>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Middle row: Latency Sparkline and Metrics */}
      <div className="flex items-center justify-between gap-4 py-1.5 my-1 border-y border-white/5">
        <div>
          <div className="text-[10px] uppercase font-mono tracking-wider text-tg-hint">
            Current / P95
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-lg font-bold font-mono tracking-tight ${
                currentLatency > 1500
                  ? 'text-red-400'
                  : currentLatency > 300
                  ? 'text-amber-400'
                  : 'text-tg-text'
              }`}
            >
              {currentLatency}
              <span className="text-xs font-normal text-tg-hint">ms</span>
            </span>
            <span className="text-xs font-mono text-tg-hint">
              p95: {Math.round(service.latencyP95)}ms
            </span>
          </div>
        </div>

        {/* Sparkline chart */}
        <div className="flex-shrink-0">
          <LatencySparkline data={service.recentLatencies || []} width={130} height={34} />
        </div>
      </div>

      {/* Bottom row: Last check time & Remediation button */}
      <div className="flex items-center justify-between mt-2 pt-1 text-[11px] text-tg-hint">
        <span>Checked {new Date(service.lastCheck).toLocaleTimeString()}</span>
        <button
          onClick={() => onOpenRunbook(service)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-500/20 transition-all active:scale-95"
        >
          <Wrench className="w-3 h-3" />
          <span>Remediate</span>
          <ArrowUpRight className="w-3 h-3 opacity-60" />
        </button>
      </div>
    </div>
  );
};
