import React from 'react';
import { History, CheckCircle2, XCircle, User } from 'lucide-react';
import { RunbookExecution } from '../types.js';

interface AuditLogViewerProps {
  history: RunbookExecution[];
  onRefresh: () => void;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ history, onRefresh }) => {
  return (
    <div className="p-4 rounded-2xl bg-tg-secondaryBg border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-tg-hint" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-tg-text">
            Remediation Audit Trail
          </h3>
        </div>
        <button
          onClick={onRefresh}
          className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {history.length === 0 ? (
        <div className="py-6 text-center text-xs text-tg-hint">
          No remediation actions logged yet.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          {history.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs font-mono"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {item.status === 'SUCCESS' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  )}
                  <span className="font-bold text-tg-text truncate">{item.runbookId}</span>
                  <span className="text-tg-hint opacity-50">on</span>
                  <span className="text-blue-400 truncate">{item.serviceId}</span>
                </div>
                <span className="text-[10px] text-tg-hint shrink-0">
                  {new Date(item.triggeredAt).toLocaleTimeString()}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-tg-hint mb-1">
                <User className="w-3 h-3 text-tg-hint/70" />
                <span>@{item.triggeredBy}</span>
              </div>

              <p className="text-[11px] text-tg-hint/80 leading-relaxed font-sans break-words">
                {item.output}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
