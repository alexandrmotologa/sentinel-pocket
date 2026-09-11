import React from 'react';
import { Flame, Gauge } from 'lucide-react';
import { SloMetrics } from '../types.js';

interface SloBurnRateBadgeProps {
  slo?: SloMetrics | null;
  compact?: boolean;
}

export const SloBurnRateBadge: React.FC<SloBurnRateBadgeProps> = ({ slo, compact = false }) => {
  if (!slo) return null;

  const isCritical = slo.burnRateMultiplier >= 10 || slo.status === 'CRITICAL';
  const isWarning = slo.burnRateMultiplier > 2 || slo.status === 'WARNING';

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] font-mono">
        <span
          className={`flex items-center gap-0.5 px-1.5 py-0.2 rounded font-semibold ${
            isCritical
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
              : isWarning
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}
          title={`Error Budget Burn Rate: ${slo.burnRateMultiplier}x nominal`}
        >
          <Flame className="w-3 h-3" />
          <span>{slo.burnRateMultiplier}x burn</span>
        </span>
        <span className="text-tg-hint opacity-75">
          {slo.remainingBudgetMinutes}m budget left
        </span>
      </div>
    );
  }

  return (
    <div className="p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs font-mono">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1 text-tg-hint">
          <Gauge className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] uppercase tracking-wider font-semibold">30-Day SLA Target</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              isCritical
                ? 'bg-red-500/20 text-red-400'
                : isWarning
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-emerald-500/15 text-emerald-400'
            }`}
          >
            <Flame className="w-3 h-3" />
            {slo.burnRateMultiplier}x Burn Rate
          </span>
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-base font-bold text-tg-text">{slo.actualUptimePercentage}%</span>
          <span className="text-[10px] text-tg-hint ml-1 font-sans">/ {slo.uptimeTarget}% goal</span>
        </div>
        <div className="text-right text-[11px] text-tg-hint">
          <span className="text-tg-text font-bold">{slo.remainingBudgetMinutes}</span> / {slo.totalErrorBudgetMinutes} min budget
        </div>
      </div>

      {/* Budget Progress Bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.max(5, 100 - slo.budgetDepletedPercentage)}%` }}
        />
      </div>
    </div>
  );
};
