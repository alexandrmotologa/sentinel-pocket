import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  ArrowUpRight,
  Radio,
  Volume2,
  VolumeX,
  Volume1,
  Calendar,
} from 'lucide-react';
import { Service, SloMetrics } from '../types.js';
import { LatencySparkline } from './LatencySparkline.js';
import { SloBurnRateBadge } from './SloBurnRateBadge.js';

interface ServiceCardProps {
  service: Service;
  slo?: SloMetrics | null;
  onOpenRunbook: (service: Service) => void;
  onOpenProbe: (service: Service) => void;
  onToggleNotificationLevel?: (serviceId: string) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  slo,
  onOpenRunbook,
  onOpenProbe,
  onToggleNotificationLevel,
}) => {
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
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            <Calendar className="w-3.5 h-3.5" />
            Maintenance
          </span>
        );
    }
  };

  const getNotifIcon = () => {
    switch (service.notificationLevel) {
      case 'SILENT':
        return (
          <span title="Silent (No sound)">
            <Volume1 className="w-3.5 h-3.5 text-amber-400" />
          </span>
        );
      case 'MUTED':
        return (
          <span title="Muted (No Telegram push)">
            <VolumeX className="w-3.5 h-3.5 text-red-400" />
          </span>
        );
      default:
        return (
          <span title="Loud (Priority sound)">
            <Volume2 className="w-3.5 h-3.5 text-tg-hint hover:text-tg-text" />
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
  } else if (service.status === 'MAINTENANCE') {
    borderStyle = 'border-indigo-500/30 bg-indigo-950/10';
  }

  return (
    <div className={`p-3.5 rounded-2xl bg-tg-secondaryBg transition-all duration-200 border ${borderStyle}`}>
      {/* Top row: Name, URL, Status */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-tg-text truncate">{service.name}</h3>
            {onToggleNotificationLevel && (
              <button
                onClick={() => onToggleNotificationLevel(service.id)}
                className="p-1 rounded-md hover:bg-white/5 transition-colors"
              >
                {getNotifIcon()}
              </button>
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

      {/* SLO Burn Rate Badge (Compact) */}
      <div className="py-1">
        <SloBurnRateBadge slo={slo} compact={true} />
      </div>

      {/* Bottom row: Action Buttons */}
      <div className="flex items-center justify-between mt-2 pt-1 text-[11px] text-tg-hint border-t border-white/5">
        <span>Checked {new Date(service.lastCheck).toLocaleTimeString()}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onOpenProbe(service)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-tg-text border border-white/10 transition-all active:scale-95"
            title="Probe target ad-hoc"
          >
            <Radio className="w-3 h-3 text-blue-400" />
            <span>Probe</span>
          </button>

          <button
            onClick={() => onOpenRunbook(service)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 border border-blue-500/30 transition-all active:scale-95"
          >
            <Wrench className="w-3 h-3" />
            <span>Remediate</span>
            <ArrowUpRight className="w-3 h-3 opacity-60" />
          </button>
        </div>
      </div>
    </div>
  );
};
