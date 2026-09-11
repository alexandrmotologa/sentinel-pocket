import React from 'react';
import { AlertOctagon, Check, Play, Clock, CheckCircle2, Brain, FileText } from 'lucide-react';
import { Incident, Service } from '../types.js';

interface IncidentCardProps {
  incident: Incident;
  service?: Service;
  onAcknowledge: (incidentId: string) => void;
  onOpenRunbook: (service: Service) => void;
  onOpenDiagnostics: (incident: Incident) => void;
  onOpenPostMortem: (incident: Incident) => void;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  service,
  onAcknowledge,
  onOpenRunbook,
  onOpenDiagnostics,
  onOpenPostMortem,
}) => {
  const isResolved = incident.status === 'RESOLVED';
  const isAcknowledged = incident.status === 'ACKNOWLEDGED';

  const formatElapsed = (startTime: number) => {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

  return (
    <div
      className={`p-3.5 rounded-2xl transition-all border ${
        isResolved
          ? 'bg-tg-secondaryBg/40 border-white/5 opacity-80'
          : incident.severity === 'CRITICAL'
          ? 'bg-red-950/20 border-red-500/30 shadow-md shadow-red-500/5'
          : 'bg-amber-950/20 border-amber-500/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`p-1.5 rounded-lg ${
              isResolved
                ? 'bg-emerald-500/10 text-emerald-400'
                : incident.severity === 'CRITICAL'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {isResolved ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertOctagon className="w-4 h-4 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-tg-text truncate">{incident.title}</h4>
            <div className="flex items-center gap-1.5 text-[11px] text-tg-hint">
              <span className="font-semibold text-blue-400">{service?.name || incident.serviceId}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatElapsed(incident.startedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Status Pill */}
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            isResolved
              ? 'bg-emerald-500/15 text-emerald-400'
              : isAcknowledged
              ? 'bg-blue-500/15 text-blue-400'
              : 'bg-red-500/20 text-red-400 animate-pulse'
          }`}
        >
          {incident.status}
        </span>
      </div>

      {/* Error Details */}
      {incident.errorDetails && (
        <div className="my-2 p-2 rounded-lg bg-black/20 border border-white/5 font-mono text-[11px] text-tg-hint leading-relaxed break-words">
          {incident.errorDetails}
        </div>
      )}

      {/* Triage Actions */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          {/* AI Root Cause Explainer button */}
          <button
            onClick={() => onOpenDiagnostics(incident)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-600/15 hover:bg-purple-600/25 text-purple-300 border border-purple-500/30 transition-all active:scale-95"
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>Diagnose</span>
          </button>

          {/* Post-Mortem Report Button */}
          {isResolved && (
            <button
              onClick={() => onOpenPostMortem(incident)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-tg-text border border-white/10 transition-all active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Post-Mortem</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isResolved && !isAcknowledged && (
            <button
              onClick={() => onAcknowledge(incident.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-tg-text border border-white/10 transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ack</span>
            </button>
          )}

          {!isResolved && service && (
            <button
              onClick={() => onOpenRunbook(service)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all active:scale-95"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Runbook</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
