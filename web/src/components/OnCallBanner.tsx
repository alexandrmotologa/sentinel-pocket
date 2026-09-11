import React, { useState } from 'react';
import { UserCheck, ArrowRightLeft } from 'lucide-react';
import { OnCallShift } from '../types.js';

interface OnCallBannerProps {
  onCall: OnCallShift | null;
  onHandover: (newOperator: string) => Promise<void>;
  onTriggerHaptic: (style: 'light' | 'medium' | 'heavy') => void;
}

export const OnCallBanner: React.FC<OnCallBannerProps> = ({
  onCall,
  onHandover,
  onTriggerHaptic,
}) => {
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [newOperator, setNewOperator] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!onCall) return null;

  const handleTransfer = async () => {
    if (!newOperator.trim()) return;
    setIsSubmitting(true);
    onTriggerHaptic('heavy');
    try {
      await onHandover(newOperator.trim().replace('@', ''));
      setIsHandoverOpen(false);
      setNewOperator('');
      onTriggerHaptic('medium');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-2 bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-blue-950/40 border-b border-white/5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-blue-500/20 text-blue-300">
            <UserCheck className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-tg-hint block leading-none">
              On-Call Duty
            </span>
            <span className="font-bold text-tg-text">
              @{onCall.primaryOperator}
              {onCall.secondaryOperator && (
                <span className="font-normal text-tg-hint text-[11px]">
                  {' '}(Backup: @{onCall.secondaryOperator})
                </span>
              )}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setIsHandoverOpen(!isHandoverOpen);
            onTriggerHaptic('light');
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-tg-text border border-white/10 transition-all"
        >
          <ArrowRightLeft className="w-3 h-3 text-blue-400" />
          <span>Handover</span>
        </button>
      </div>

      {/* Handover expandable form */}
      {isHandoverOpen && (
        <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center gap-2 animate-fade-in">
          <input
            type="text"
            value={newOperator}
            onChange={(e) => setNewOperator(e.target.value)}
            placeholder="@telegram_handle"
            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-black/40 border border-white/10 text-tg-text focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            onClick={handleTransfer}
            disabled={isSubmitting || !newOperator.trim()}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Transferring...' : 'Confirm'}
          </button>
          <button
            onClick={() => setIsHandoverOpen(false)}
            className="px-2 py-1.5 text-xs text-tg-hint hover:text-tg-text"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
