import { AlertOctagon, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../i18n/translations';
import { rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

/** Read by index.html on the next start: wipes anything a store wrote back after the reset. */
const RESET_PENDING_KEY = 'streamer-hub-reset-pending';

function snapshotStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) out[key] = localStorage.getItem(key) ?? '';
    }
  } catch {
    // nothing to keep
  }
  return out;
}

/**
 * Settings > System: put the whole app back to default. Asked three times; the settings and the page's storage (stats,
 * leaderboards, layout) are backed up first, and the Twitch and OBS logins are kept.
 */
export function ResetCard() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  // 0 = closed, 1..3 = which "are you sure" is showing
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reset = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await rpc.invoke(Channels.SettingsResetAll, { webStorage: snapshotStorage() });
      if (!res.ok) {
        setMessage(t(lang, 'reset.failed'));
        setBusy(false);
        setStep(0);
        return;
      }
      try {
        localStorage.clear();
        localStorage.setItem(RESET_PENDING_KEY, '1');
      } catch {
        // the host already reset the settings
      }
      setMessage(t(lang, res.restarting ? 'reset.restarting' : 'reset.restartManually'));
      if (!res.restarting) window.setTimeout(() => window.location.reload(), 1500);
    } catch {
      setMessage(t(lang, 'reset.failed'));
      setBusy(false);
      setStep(0);
    }
  };

  const questions = ['reset.confirm1', 'reset.confirm2', 'reset.confirm3'] as const;
  const nextLabels = ['reset.next1', 'reset.next2', 'reset.doIt'] as const;

  return (
    <Card className="border-rose-500/30">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <AlertOctagon size={18} className="mt-0.5 shrink-0 text-rose-400" />
          <div className="min-w-0">
            <h3 className="font-sans text-[14px] font-bold tracking-tight text-rose-200">{t(lang, 'reset.title')}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{t(lang, 'reset.desc')}</p>
          </div>
        </div>

        {step === 0 ? (
          <div>
            <Button variant="danger" onClick={() => setStep(1)} disabled={busy}>
              <RotateCcw size={14} />
              {t(lang, 'reset.button')}
            </Button>
          </div>
        ) : (
          <div role="alertdialog" aria-live="assertive" className="flex flex-col gap-3 rounded-md border border-rose-500/40 bg-rose-500/10 p-3">
            <div className="font-mono text-[11px] tracking-wide text-rose-300">{t(lang, 'reset.stepOf', { n: step })}</div>
            <p className="text-[12.5px] leading-relaxed text-rose-100">{t(lang, questions[step - 1])}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(0)} disabled={busy}>{t(lang, 'reset.cancel')}</Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => (step < 3 ? setStep(step + 1) : void reset())}
                className={step === 3 ? 'bg-rose-600/80 text-white hover:bg-rose-600' : undefined}
              >
                {t(lang, nextLabels[step - 1])}
              </Button>
            </div>
          </div>
        )}

        {message && <p className="text-[12px] text-rose-200">{message}</p>}
      </div>
    </Card>
  );
}
