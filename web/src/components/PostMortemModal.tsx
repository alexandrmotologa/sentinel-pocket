import { useState, useEffect } from 'react';
import { X, FileText, Copy, Check, Send, Loader2, Clock, AlertCircle } from 'lucide-react';
import { Incident, PostMortem } from '../types.js';

interface PostMortemModalProps {
  incident: Incident | null;
  isOpen: boolean;
  onClose: () => void;
  onTriggerHaptic: (style: 'light' | 'medium' | 'heavy') => void;
}

export const PostMortemModal: React.FC<PostMortemModalProps> = ({
  incident,
  isOpen,
  onClose,
  onTriggerHaptic,
}) => {
  const [postMortem, setPostMortem] = useState<PostMortem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !incident) {
      setPostMortem(null);
      setCopied(false);
      return;
    }

    const loadPostMortem = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/incidents/${incident.id}/postmortem`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'tma mock',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setPostMortem(data);
        }
      } catch (err) {
        console.error('Failed to load post-mortem:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPostMortem();
  }, [isOpen, incident]);

  if (!isOpen || !incident) return null;

  const handleCopy = () => {
    if (!postMortem) return;
    navigator.clipboard.writeText(postMortem.markdownReport);
    setCopied(true);
    onTriggerHaptic('medium');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl bg-tg-secondaryBg border border-white/10 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-tg-text">Incident Post-Mortem</h3>
              <p className="text-[11px] text-tg-hint">Automated RCA timeline & impact summary</p>
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
            <Loader2 className="w-6 h-6 animate-spin text-blue-400 mb-2" />
            <span>Compiling post-mortem telemetry & timeline...</span>
          </div>
        ) : postMortem ? (
          <div className="space-y-4 my-4">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-black/25 border border-white/5 text-center font-mono">
              <div>
                <div className="text-[10px] text-tg-hint uppercase">Downtime</div>
                <div className="text-sm font-bold text-tg-text flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  {postMortem.downtimeSeconds}s
                </div>
              </div>
              <div>
                <div className="text-[10px] text-tg-hint uppercase">Failed Checks</div>
                <div className="text-sm font-bold text-red-400 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {postMortem.failedChecksCount}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-tg-hint uppercase">Operator</div>
                <div className="text-xs font-bold text-emerald-400 truncate">
                  @{postMortem.acknowledgedBy || 'Sentinel'}
                </div>
              </div>
            </div>

            {/* Markdown Report Preview */}
            <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 text-xs text-tg-text font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
              {postMortem.markdownReport}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Markdown'}</span>
              </button>
              <button
                onClick={() => {
                  onTriggerHaptic('light');
                  alert('Post-mortem link generated! You can paste it into your Telegram ops channel.');
                }}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-tg-text border border-white/10 flex items-center justify-center gap-1.5 transition-all"
              >
                <Send className="w-4 h-4 text-blue-400" />
                <span>Share</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
