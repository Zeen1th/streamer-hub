import { Download, Loader2, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../../i18n/translations';
import { useSettingsStore } from '../../store/settingsStore';
import { useUpdateStore } from '../../store/updateStore';
import { Button } from '../ui/Button';

/** Bottom corner notice for automatic updates: countdown, "waits for next launch", installing, or failed. */
export function AutoUpdateToast() {
  const pending = useUpdateStore((s) => s.pendingAutoInstall);
  const deferredVersion = useUpdateStore((s) => s.deferredVersion);
  const installing = useUpdateStore((s) => s.installing);
  const failedVersion = useUpdateStore((s) => s.autoInstallError);
  const confirm = useUpdateStore((s) => s.confirmAutoInstall);
  const cancel = useUpdateStore((s) => s.cancelAutoInstall);
  const dismissDeferred = useUpdateStore((s) => s.dismissDeferred);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending) return;
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, [pending]);

  useEffect(() => {
    if (pending && now >= pending.deadline) void confirm();
  }, [pending, now, confirm]);

  let body: React.ReactNode = null;
  let tone = 'border-accent/30';

  if (installing) {
    body = (
      <div className="flex items-center gap-2.5 text-[12.5px]">
        <Loader2 size={16} className="shrink-0 animate-spin text-accent" />
        <span>{t(lang, 'updates.autoInstalling')}</span>
      </div>
    );
  } else if (pending) {
    const seconds = Math.max(0, Math.ceil((pending.deadline - now) / 1000));
    body = (
      <>
        <div className="flex items-start gap-2.5 text-[12.5px]">
          <Download size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>{t(lang, 'updates.autoCountdown', { version: pending.version, seconds })}</span>
        </div>
        <div className="mt-2.5 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={cancel}>{t(lang, 'updates.cancel')}</Button>
          <Button size="sm" onClick={() => void confirm()}>{t(lang, 'updates.installNow')}</Button>
        </div>
      </>
    );
  } else if (failedVersion) {
    tone = 'border-amber-500/40';
    body = (
      <>
        <div className="flex items-start gap-2.5 text-[12.5px]">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <span>{t(lang, 'updates.autoFailed', { version: failedVersion })}</span>
        </div>
        <div className="mt-2.5 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => useUpdateStore.setState({ autoInstallError: null })}>
            {t(lang, 'updates.dismiss')}
          </Button>
        </div>
      </>
    );
  } else if (deferredVersion) {
    body = (
      <>
        <div className="flex items-start gap-2.5 text-[12.5px]">
          <Download size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>{t(lang, 'updates.deferred', { version: deferredVersion })}</span>
          <button
            type="button"
            onClick={dismissDeferred}
            aria-label={t(lang, 'updates.dismiss')}
            className="ms-auto grid size-5 shrink-0 place-items-center rounded text-muted hover:text-white"
          >
            <X size={13} />
          </button>
        </div>
      </>
    );
  }

  if (!body) return null;

  return (
    <div
      role="status"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className={`fixed bottom-4 end-4 z-[55] w-[340px] max-w-[calc(100vw-32px)] rounded-lg border bg-[#171e25]/95 p-3.5 text-ink shadow-2xl backdrop-blur-md ${tone}`}
    >
      {body}
    </div>
  );
}
