import React, { useState } from 'react';
import { X, RefreshCw, RotateCcw, Trash2, BellOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { RunbookActionId, Service } from '../types.js';

interface RunbookModalProps {
  service: Service | null;
  isOpen: boolean;
  onClose: () => void;
  onExecute: (actionId: RunbookActionId, serviceId: string, reason?: string) => Promise<string>;
  onTriggerHaptic: (style: 'light' | 'medium' | 'heavy') => void;
}

const RUNBOOK_OPTIONS: {
  id: RunbookActionId;
  title: string;
  description: string;
  icon: any;
  badge?: string;
}[] = [
  {
    id: 'restart_container',
    title: 'Restart Container',
    description: 'Signals the orchestrator to cycle container instances and reset connection pools.',
    icon: RefreshCw,
  },
  {
    id: 'rollback_canary',
    title: 'Rollback Canary Deployment',
    description: 'Shifts 100% ingress traffic to stable baseline via CanaryMesh.',
    icon: RotateCcw,
    badge: 'CanaryMesh',
  },
  {
    id: 'flush_cache',
    title: 'Flush Session Cache',
    description: 'Purges stale in-memory and Redis cache keys for this cluster.',
    icon: Trash2,
  },
  {
    id: 'silence_1h',
    title: 'Silence Alerts (1 Hour)',
    description: 'Suppresses push notifications and bot alerts while investigating.',
    icon: BellOff,
  },
];

export const RunbookModal: React.FC<RunbookModalProps> = ({
  service,
  isOpen,
  onClose,
  onExecute,
  onTriggerHaptic,
}) => {
  const [selectedAction, setSelectedAction] = useState<RunbookActionId>('restart_container');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  if (!isOpen || !service) return null;

  const handleActionClick = (id: RunbookActionId) => {
    setSelectedAction(id);
    onTriggerHaptic('light');
    setResultMessage(null);
  };

  const handleExecute = async () => {
    setIsLoading(true);
    setResultMessage(null);
    setIsError(false);
    onTriggerHaptic('heavy');

    try {
      const output = await onExecute(selectedAction, service.id, reason);
      setResultMessage(output);
      setIsError(false);
      onTriggerHaptic('medium');
    } catch (err: any) {
      setResultMessage(err.message || 'Execution failed');
      setIsError(true);
      onTriggerHaptic('heavy');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-tg-secondaryBg border border-white/10 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-blue-400 font-semibold">
              Remediation Cockpit
            </span>
            <h3 className="text-base font-bold text-tg-text">{service.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-tg-hint hover:text-tg-text hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Selection List */}
        <div className="space-y-2.5 my-4">
          <label className="text-xs font-semibold text-tg-hint uppercase tracking-wider block">
            Select Runbook
          </label>
          {RUNBOOK_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedAction === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => handleActionClick(opt.id)}
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10'
                    : 'bg-white/5 border-white/5 hover:border-white/15'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-white/10 text-tg-hint'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-tg-text">{opt.title}</span>
                    {opt.badge && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-tg-hint mt-0.5 leading-snug">{opt.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reason / Note input */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-tg-hint uppercase tracking-wider block mb-1.5">
            Audit Reason (Optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Resolving memory leak after v2.4 rollout"
            className="w-full px-3 py-2 text-xs rounded-xl bg-black/25 border border-white/10 text-tg-text placeholder-tg-hint/50 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Result Message Banner */}
        {resultMessage && (
          <div
            className={`p-3 rounded-xl mb-4 flex items-start gap-2.5 text-xs ${
              isError
                ? 'bg-red-500/15 border border-red-500/30 text-red-300'
                : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
            }`}
          >
            {isError ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="leading-relaxed">{resultMessage}</div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleExecute}
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Executing Runbook...</span>
            </>
          ) : (
            <span>Execute 1-Tap Remediation</span>
          )}
        </button>
      </div>
    </div>
  );
};
