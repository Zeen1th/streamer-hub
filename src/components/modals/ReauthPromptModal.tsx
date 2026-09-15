import { useEffect, useState } from 'react';
import { Shield, KeyRound, CheckCircle2, X } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { rpc } from '../../rpc';
import { Channels } from '../../rpc/contracts';
import { t } from '../../i18n/translations';
import { Button } from '../ui/Button';

export const REAUTH_STORAGE_KEY = 'streamer-hub-reauth-prompt-v0.3.0';

export function ReauthPromptModal() {
  const [open, setOpen] = useState(false);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    try {
      const shown = localStorage.getItem(REAUTH_STORAGE_KEY);
      if (!shown) {
        setOpen(true);
      }
    } catch {
      // ignore storage errors
    }

    // Allow manual testing via window event
    const handleTrigger = () => setOpen(true);
    window.addEventListener('streamer-hub-test-reauth-prompt', handleTrigger);
    return () => window.removeEventListener('streamer-hub-test-reauth-prompt', handleTrigger);
  }, []);

  if (!open) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(REAUTH_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setOpen(false);
  };

  const handleReauth = async () => {
    handleDismiss();
    try {
      await rpc.invoke(Channels.TwitchAuthorize);
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reauth-modal-title"
        className="flex w-full max-w-[500px] flex-col overflow-hidden rounded-[12px] border border-white/[0.14] bg-[#1a2228] text-[#f8fafc] shadow-2xl animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/[0.08] bg-[#151c21] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-[8px] bg-[#9146FF]/20 text-[#A970FF] border border-[#9146FF]/35 shadow-[0_0_12px_rgba(145,70,255,0.25)]">
              <Shield size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="reauth-modal-title"
                  className="font-sans text-[15px] font-bold text-white tracking-tight"
                >
                  {t(lang, 'reauthPrompt.title')}
                </h2>
                <span className="rounded bg-[#9146FF]/25 border border-[#9146FF]/40 px-1.5 py-0.2 font-mono text-[9.5px] font-bold uppercase text-[#c499ff]">
                  v0.3.0
                </span>
              </div>
              <p className="font-sans text-[11.5px] text-[#9aa3af]">
                {t(lang, 'reauthPrompt.subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex size-7 items-center justify-center rounded-[5px] text-[#9aa3af] hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* Content */}
        <div className="space-y-4 p-5 bg-[#1a2228]">
          <p className="font-sans text-xs leading-relaxed text-[#cbd5e1]">
            {t(lang, 'reauthPrompt.desc')}
          </p>

          {/* Benefit Points */}
          <div className="space-y-2 rounded-lg border border-white/[0.08] bg-[#141a1f] p-3.5">
            <div className="flex items-start gap-2.5 text-xs text-[#e2e8f0]">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>{t(lang, 'reauthPrompt.benefit1')}</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#e2e8f0]">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>{t(lang, 'reauthPrompt.benefit2')}</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#e2e8f0]">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>{t(lang, 'reauthPrompt.benefit3')}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="flex items-center justify-end gap-2.5 border-t border-white/[0.08] bg-[#151c21] px-5 py-3.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-slate-300 hover:text-white hover:bg-white/[0.08] text-xs h-8 px-3"
          >
            {t(lang, 'reauthPrompt.laterBtn')}
          </Button>

          <button
            type="button"
            onClick={handleReauth}
            className="flex h-8 items-center gap-1.5 rounded-[6px] bg-[#9146FF] px-3.5 font-sans text-xs font-semibold text-white shadow-md hover:bg-[#772ce8] transition-colors cursor-pointer"
          >
            <KeyRound size={13} strokeWidth={2.2} />
            <span>{t(lang, 'reauthPrompt.authorizeBtn')}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
