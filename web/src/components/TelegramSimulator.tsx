import React, { useState } from 'react';
import { Smartphone, ChevronLeft, MoreVertical, Github, Sun, Moon } from 'lucide-react';
import { TelegramUser } from '../types.js';

interface TelegramSimulatorProps {
  children: React.ReactNode;
  user: TelegramUser | null;
  onSelectUser: (user: TelegramUser) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

const MOCK_USERS: TelegramUser[] = [
  { id: 10001, first_name: 'Alexandr', last_name: 'Motologa', username: 'alexandrmotologa', is_premium: true },
  { id: 20002, first_name: 'DevOps', last_name: 'OnCall', username: 'devops_oncall' },
  { id: 30003, first_name: 'Canary', last_name: 'Admin', username: 'canary_admin' },
];

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({
  children,
  user,
  onSelectUser,
  isDark,
  onToggleTheme,
}) => {
  const [deviceFrameEnabled, setDeviceFrameEnabled] = useState(true);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start p-0 sm:p-6 text-slate-100 selection:bg-blue-600/30">
      {/* Top Banner for Standalone Web mode */}
      <div className="w-full max-w-xl mb-4 hidden sm:flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-slate-200">Telegram Mini App Simulator</span>
          <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
            Browser Preview
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mock user selector */}
          <select
            value={user?.id || 10001}
            onChange={(e) => {
              const selected = MOCK_USERS.find((u) => u.id === Number(e.target.value));
              if (selected) onSelectUser(selected);
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {MOCK_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                👤 {u.first_name} (@{u.username})
              </option>
            ))}
          </select>

          {/* Theme switcher */}
          <button
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light' : 'Switch to Dark'}
            className="p-1 rounded text-slate-400 hover:text-slate-200"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-400" />}
          </button>

          {/* Toggle Bezel Frame */}
          <button
            onClick={() => setDeviceFrameEnabled(!deviceFrameEnabled)}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            {deviceFrameEnabled ? 'Full Window' : 'Phone Frame'}
          </button>

          {/* GitHub Link */}
          <a
            href="https://github.com/alexandrmotologa/sentinel-pocket"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>
        </div>
      </div>

      {/* Mobile Chassis Container */}
      <div
        className={`w-full transition-all duration-300 ${
          deviceFrameEnabled
            ? 'sm:max-w-[430px] sm:rounded-[44px] sm:shadow-2xl sm:shadow-blue-500/10 sm:border-[8px] sm:border-slate-800 overflow-hidden'
            : 'max-w-xl'
        }`}
      >
        {/* Simulated Telegram App Top Bar */}
        <div className="bg-tg-headerBg px-4 py-2.5 border-b border-white/5 flex items-center justify-between text-tg-text select-none">
          <div className="flex items-center gap-2">
            <ChevronLeft className="w-5 h-5 text-blue-400 cursor-pointer" />
            <div>
              <div className="text-xs font-bold leading-tight">Sentinel Pocket</div>
              <div className="text-[10px] text-tg-hint leading-none">bot</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MoreVertical className="w-4 h-4 text-tg-hint cursor-pointer" />
          </div>
        </div>

        {/* Application Content */}
        <div className="min-h-[640px] max-h-[85vh] overflow-y-auto bg-tg-bg text-tg-text">
          {children}
        </div>
      </div>

      {/* Footer cross-promotion */}
      <footer className="mt-6 text-center text-xs text-slate-500 hidden sm:block">
        Companion app to{' '}
        <a
          href="https://github.com/alexandrmotologa/sentinel"
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:underline"
        >
          alexandrmotologa/sentinel
        </a>{' '}
        &{' '}
        <a
          href="https://github.com/alexandrmotologa/canarymesh"
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:underline"
        >
          canarymesh
        </a>
      </footer>
    </div>
  );
};
