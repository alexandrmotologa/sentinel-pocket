import { useState, useEffect } from 'react';
import { X, Brain, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { DiagnosticsResult, Incident, RunbookActionId } from '../types.js';

interface DiagnosticsModalProps {
  incident: Incident | null;
  isOpen: boolean;
  onClose: () => void;
  onExecuteRunbook: (actionId: RunbookActionId, serviceId: string, reason?: string) => Promise<string>;
  onTriggerHaptic: (style: 'light' | 'medium' | 'heavy') => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  incident,
  isOpen,
  onClose,
  onExecuteRunbook,
  onTriggerHaptic,
}) => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !incident) {
      setDiagnostics(null);
      setExecutionOutput(null);
      return;
    }

    const fetchDiag = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/incidents/${incident.id}/diagnostics`, {
          headers: { Authorization: 'tma mock' },
        });
        if (res.ok) {
          const data = await res.json();
          setDiagnostics(data);
        }
      } catch (e) {
        console.error('Diagnostics failed:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiag();
  }, [isOpen, incident]);

  if (!isOpen || !incident) return null;

  const handleRunRecommended = async () => {
    if (!diagnostics) return;
    setIsExecuting(true);
    onTriggerHaptic('heavy');

    try {
      const out = await onExecuteRunbook(
        diagnostics.recommendedRunbook as RunbookActionId,
        incident.serviceId,
        `Remediation via Root-Cause Explainer: ${diagnostics.probableCause}`
      );
      setExecutionOutput(out);
      onTriggerHaptic('medium');
    } catch (err: any) {
      setExecutionOutput(`Failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-tg-secondaryBg border border-white/10 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-tg-text">Root Cause Explainer</h3>
              <p className="text-[11px] text-tg-hint truncate max-w-xs">{incident.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-tg-hint hover:text-tg-text hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-tg-hint text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400 mb-2" />
            <span>Correlating telemetry & canary deployment state...</span>
          </div>
        ) : diagnostics ? (
          <div className="space-y-4 my-4 animate-fade-in">
            {/* Probable cause card */}
            <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-purple-400 font-semibold">
                  Probable Root Cause
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  {diagnostics.confidenceScore}% Confidence
                </span>
              </div>
              <h4 className="text-sm font-bold text-tg-text mb-2 leading-snug">
                {diagnostics.probableCause}
              </h4>
              <div className="flex items-center gap-3 text-[11px] font-mono text-tg-hint pt-2 border-t border-white/5">
                <div>P95: <span className="text-red-400 font-bold">{diagnostics.anomalousMetrics.latencyP95}ms</span></div>
                <div>Errors: <span className="text-amber-400 font-bold">{diagnostics.anomalousMetrics.errorRate}</span></div>
                <div>Last Code: <span className="text-tg-text font-bold">HTTP {diagnostics.anomalousMetrics.lastStatusCode}</span></div>
              </div>
            </div>

            {/* Evidence & Reasoning */}
            <div className="p-3.5 rounded-2xl bg-black/20 border border-white/5 space-y-2 text-xs">
              <span className="text-[10px] uppercase font-mono tracking-wider text-tg-hint font-semibold block">
                Telemetry Evidence
              </span>
              <ul className="space-y-1.5 text-[11px] text-tg-hint">
                {diagnostics.reasoning.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Execution Result */}
            {executionOutput && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{executionOutput}</span>
              </div>
            )}

            {/* Recommended Runbook Action Button */}
            {!executionOutput && (
              <button
                onClick={handleRunRecommended}
                disabled={isExecuting}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing Remediation...</span>
                  </>
                ) : (
                  <>
                    <span>Apply Recommended: {diagnostics.recommendedRunbook}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
