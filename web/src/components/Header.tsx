import React from 'react';
import { Shield, Radio, Sun, Moon, Zap, User, Wrench, Search } from 'lucide-react';
import { TelegramUser } from '../types.js';

interface HeaderProps {
  isConnected: boolean;
  user: TelegramUser | null;
  isDark: boolean;
  onToggleTheme: () => void;
  onTriggerAnomaly: () => void;
  onOpenProbe: () => void;
  onOpenMaintenance: () => void;
  healthyCount: number;
  totalServices: number;
  openIncidentCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  user,
  isDark,
  onToggleTheme,
  onTriggerAnomaly,
  onOpenProbe,
  onOpenMaintenance,
  healthyCount,
  totalServices,
  openIncidentCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-tg-secondaryBg/90 backdrop-blur-md border-b border-white/5 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
            <Shield className="w-5 h-5" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-tg-secondaryBg ${
                isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-tight text-tg-text">Sentinel Pocket</h1>
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                SRE Pro
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-tg-hint">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse-subtle" />
              <span>{isConnected ? 'Telemetry Live' : 'Reconnecting...'}</span>
              <span>•</span>
              <span className="text-emerald-400 font-medium font-mono">
                {healthyCount}/{totalServices} UP (99.9% SLO)
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions & Tools */}
        <div className="flex items-center gap-1.5">
          {/* Ad-hoc Probe Modal Button */}
          <button
            onClick={onOpenProbe}
            title="Instant Probe"
            className="p-1.5 rounded-lg text-tg-hint hover:text-tg-text hover:bg-white/5 transition-all active:scale-95"
          >
            <Search className="w-4 h-4 text-blue-400" />
          </button>

          {/* Maintenance Scheduler Button */}
          <button
            onClick={onOpenMaintenance}
            title="Scheduled Maintenance"
            className="p-1.5 rounded-lg text-tg-hint hover:text-tg-text hover:bg-white/5 transition-all active:scale-95"
          >
            <Wrench className="w-4 h-4 text-indigo-400" />
          </button>

          {/* Quick Demo Anomaly Trigger */}
          <button
            onClick={onTriggerAnomaly}
            title="Inject Anomaly (Demo)"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all active:scale-95"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Spike</span>
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            className="p-1.5 rounded-lg text-tg-hint hover:text-tg-text hover:bg-white/5 transition-all active:scale-95"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
          </button>

          {/* User Badge */}
          {user && (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-white/10">
              <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 text-xs font-semibold">
                {user.first_name?.[0] || <User className="w-3.5 h-3.5" />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warning banner if open incidents exist */}
      {openIncidentCount > 0 && (
        <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-red-300 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span>{openIncidentCount} Active Incident{openIncidentCount > 1 ? 's' : ''} Detected</span>
          </div>
          <span className="text-[11px] text-red-300/80 font-mono">Triage Required</span>
        </div>
      )}
    </header>
  );
};
