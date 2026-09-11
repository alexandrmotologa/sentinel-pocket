import { useState, useEffect } from 'react';
import { X, Calendar, Wrench, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { MaintenanceWindow, Service } from '../types.js';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: Service[];
  onTriggerHaptic: (style: 'light' | 'medium' | 'heavy') => void;
  onRefreshServices: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  onClose,
  services,
  onTriggerHaptic,
  onRefreshServices,
}) => {
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id || 'srv_payments');
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [reason, setReason] = useState('');
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchWindows = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/maintenance', {
        headers: { Authorization: 'tma mock' },
      });
      if (res.ok) {
        const data = await res.json();
        setWindows(data);
      }
    } catch (e) {
      console.error('Failed to load maintenance windows:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWindows();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    onTriggerHaptic('heavy');

    const startsAt = Date.now();
    const endsAt = startsAt + durationMinutes * 60 * 1000;

    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'tma mock',
        },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          title,
          startsAt,
          endsAt,
          reason,
        }),
      });

      if (res.ok) {
        setTitle('');
        setReason('');
        await fetchWindows();
        onRefreshServices();
        onTriggerHaptic('medium');
      }
    } catch (err) {
      console.error('Failed to create maintenance window:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-tg-secondaryBg border border-white/10 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-tg-text">Maintenance Planner</h3>
              <p className="text-[11px] text-tg-hint">Schedule downtime windows & suppress false alarms</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-tg-hint hover:text-tg-text hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create Window Form */}
        <div className="space-y-3 my-4 p-3.5 rounded-2xl bg-black/20 border border-white/5">
          <span className="text-[10px] uppercase font-mono tracking-wider text-tg-hint font-semibold block">
            Schedule New Window
          </span>

          {/* Service Selector */}
          <div>
            <label className="text-[11px] text-tg-hint mb-1 block font-medium">Target Service</label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-tg-bg border border-white/10 text-tg-text focus:outline-none focus:border-indigo-500"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title input */}
          <div>
            <label className="text-[11px] text-tg-hint mb-1 block font-medium">Maintenance Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Database schema migration & failover"
              className="w-full px-3 py-2 text-xs rounded-xl bg-tg-bg border border-white/10 text-tg-text placeholder-tg-hint/50 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Duration Presets */}
          <div>
            <label className="text-[11px] text-tg-hint mb-1 block font-medium">Duration</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[30, 60, 120, 240].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setDurationMinutes(mins);
                    onTriggerHaptic('light');
                  }}
                  className={`py-1.5 text-xs font-mono font-semibold rounded-lg border transition-all ${
                    durationMinutes === mins
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-white/5 text-tg-hint border-white/5 hover:border-white/15'
                  }`}
                >
                  {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={isSubmitting || !title.trim()}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 mt-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
            <span>Activate Maintenance Window</span>
          </button>
        </div>

        {/* Existing Windows List */}
        <div className="space-y-2 pt-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-tg-hint font-semibold block">
            Active & Upcoming Windows ({windows.length})
          </span>

          {isLoading ? (
            <div className="py-6 text-center text-xs text-tg-hint">Loading windows...</div>
          ) : windows.length === 0 ? (
            <div className="p-4 rounded-xl bg-white/5 text-center text-xs text-tg-hint">
              No active maintenance windows scheduled.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {windows.map((win) => {
                const srv = services.find((s) => s.id === win.serviceId);
                const isNow = Date.now() >= win.startsAt && Date.now() <= win.endsAt;
                return (
                  <div
                    key={win.id}
                    className={`p-3 rounded-xl border text-xs ${
                      isNow
                        ? 'bg-indigo-950/20 border-indigo-500/40'
                        : 'bg-black/20 border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-tg-text truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{win.title}</span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase font-mono ${
                          isNow ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/10 text-tg-hint'
                        }`}
                      >
                        {isNow ? 'ACTIVE NOW' : 'SCHEDULED'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-tg-hint">
                      <span>Target: {srv?.name || win.serviceId}</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        Ends {new Date(win.endsAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
