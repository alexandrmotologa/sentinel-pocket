import React, { useState } from 'react';
import { X, Globe, Radio, Lock, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { ProbeResult, Service } from '../types.js';

interface ProbeModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: Service[];
  initialTarget?: string;
  onTriggerHaptic: (style: 'light' | 'medium' | 'heavy') => void;
}

export const ProbeModal: React.FC<ProbeModalProps> = ({
  isOpen,
  onClose,
  services,
  initialTarget = '',
  onTriggerHaptic,
}) => {
  const [target, setTarget] = useState(initialTarget);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProbe = async (targetUrl?: string) => {
    const urlToProbe = targetUrl || target;
    if (!urlToProbe.trim()) return;

    setIsLoading(true);
    setError(null);
    onTriggerHaptic('medium');

    try {
      const res = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: urlToProbe }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Probe failed');
      }
      setResult(data);
      onTriggerHaptic('light');
    } catch (err: any) {
      setError(err.message || 'Probe failed');
      onTriggerHaptic('heavy');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-tg-secondaryBg border border-white/10 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-tg-text">Instant Health Probe</h3>
              <p className="text-[11px] text-tg-hint">Ad-hoc HTTP, DNS, TTFB & SSL certificate inspection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-tg-hint hover:text-tg-text hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target input */}
        <div className="my-4">
          <label className="text-xs font-semibold text-tg-hint uppercase tracking-wider block mb-1.5">
            Probe Target (URL or Domain)
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 text-tg-hint absolute left-3 top-2.5" />
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="https://payments.internal.mesh/healthz"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/25 border border-white/10 text-tg-text placeholder-tg-hint/50 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <button
              onClick={() => handleProbe()}
              disabled={isLoading || !target.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Probe</span>}
            </button>
          </div>

          {/* Quick service selector pills */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {services.map((srv) => (
              <button
                key={srv.id}
                onClick={() => {
                  setTarget(srv.url);
                  handleProbe(srv.url);
                }}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-tg-hint hover:text-tg-text border border-white/5 transition-all"
              >
                {srv.name}
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs mb-4">
            {error}
          </div>
        )}

        {/* Results view */}
        {result && (
          <div className="space-y-3 pt-2 animate-fade-in">
            {/* Status overview */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                    result.statusCode && result.statusCode < 400
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {result.statusCode || 'FAIL'} {result.statusMessage || ''}
                </span>
                <span className="text-xs font-mono text-tg-hint">{result.protocol}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold font-mono text-tg-text">{result.totalTimeMs}ms</div>
                <div className="text-[10px] text-tg-hint">Total latency</div>
              </div>
            </div>

            {/* Latency Breakdown Waterfall */}
            <div className="p-3 rounded-xl bg-black/20 border border-white/5 text-xs space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-tg-hint font-semibold block">
                Network Waterfall
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-tg-hint flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-400" /> DNS Lookup
                  </span>
                  <span>{result.dnsLookupMs}ms</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-tg-hint flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-amber-400" /> Time to First Byte (TTFB)
                  </span>
                  <span className="font-semibold text-tg-text">{result.ttfbMs}ms</span>
                </div>
              </div>
            </div>

            {/* SSL Certificate Details */}
            {result.ssl && (
              <div className="p-3 rounded-xl bg-black/20 border border-white/5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-tg-hint font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-400" /> TLS / SSL Certificate
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                      result.ssl.valid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {result.ssl.daysRemaining} days remaining
                  </span>
                </div>
                <div className="text-[11px] text-tg-hint space-y-0.5">
                  <div>Issuer: <span className="text-tg-text">{result.ssl.issuer}</span></div>
                  <div>Expires: <span className="text-tg-text font-mono">{result.ssl.validTo}</span></div>
                  <div>Protocol: <span className="text-tg-text font-mono">{result.ssl.tlsVersion}</span></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
