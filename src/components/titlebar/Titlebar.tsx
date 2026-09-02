import { Download, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n/translations';
import { rpc } from '../../rpc';
import { Channels } from '../../rpc/contracts';
import { resolveTheme } from '../../lib/theme';
import { useSettingsStore } from '../../store/settingsStore';
import { useUpdateStore } from '../../store/updateStore';
import { ConnectionIndicators } from './ConnectionIndicators';
import { WindowControls } from './WindowControls';

export function Titlebar() {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const lang = language === 'ar' ? 'ar' : 'en';
  const systemIsDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const resolvedTheme = resolveTheme(theme, systemIsDark);
  const updateAvailable = useUpdateStore((s) => s.updateAvailable);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const releaseNotes = useUpdateStore((s) => s.releaseNotes);
  const installing = useUpdateStore((s) => s.installing);
  const installUpdate = useUpdateStore((s) => s.install);
  const checkForUpdate = useUpdateStore((s) => s.check);
  const [showUpdate, setShowUpdate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <header
      dir="ltr"
      className="relative z-50 flex h-8 shrink-0 select-none items-center justify-between border-b border-hair bg-surface-2 ps-3"
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as HTMLElement | null)?.closest('[data-drag-exclude]')) return;
        rpc.invoke(Channels.WindowBeginDrag).catch(() => undefined);
      }}
      onDoubleClick={() => rpc.invoke(Channels.WindowMaximizeToggle).catch(() => undefined)}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-[9px] bg-accent" />
        <span className="font-sans text-[11px] font-extrabold uppercase tracking-[.08em] text-ink">Streamer Hub</span>
      </div>
      <div data-drag-exclude className="flex h-full items-center">
        {message && <span role="status" className="px-2 font-mono text-[10px] text-muted">{message}</span>}
        {updateAvailable && (
          <button type="button" className="flex h-full items-center gap-1 border-x border-hair px-2 font-sans text-[10px] font-semibold text-accent-text" onClick={() => setShowUpdate((value) => !value)}>
            <Download size={12} aria-hidden /> {t(lang, 'updates.available')} · v{latestVersion}
          </button>
        )}
        <ConnectionIndicators />
        <button
          type="button"
          className="h-full px-2 font-sans text-[10px] font-semibold text-muted hover:bg-accent-soft hover:text-ink"
          title={t(lang, 'titlebar.language')}
          onClick={() => setLanguage(lang === 'ar' ? 'en' : 'ar')}
        >
          <span dir="ltr">{lang === 'ar' ? 'EN' : 'عربي'}</span>
        </button>
        <button
          type="button"
          className="grid h-full w-8 place-items-center text-muted hover:bg-accent-soft hover:text-ink"
          title={t(lang, 'titlebar.appearance')}
          aria-label={t(lang, 'titlebar.appearance')}
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>
        {!updateAvailable && (
          <button
            type="button"
            disabled={installing}
            className="grid h-full w-8 place-items-center text-muted hover:bg-accent-soft hover:text-ink disabled:opacity-45"
            title={t(lang, 'updates.check')}
            aria-label={t(lang, 'updates.check')}
            onClick={async () => {
              const result = await checkForUpdate();
              if (result?.updateAvailable) setShowUpdate(true);
              else setMessage(t(lang, 'updates.upToDate'));
            }}
          >
            <Download size={12} />
          </button>
        )}
        <WindowControls />
      </div>
      {showUpdate && updateAvailable && (
        <section className="absolute right-[120px] top-8 z-50 w-[360px] border-2 border-rule bg-surface p-3 text-start" aria-label={t(lang, 'updates.available')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-sans text-[13px] font-extrabold text-ink">{t(lang, 'updates.available')} · v{latestVersion}</div>
              <p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[11px] text-muted">{releaseNotes || t(lang, 'updates.fallbackNotes')}</p>
            </div>
            <button type="button" className="px-1 text-ink" onClick={() => setShowUpdate(false)}>x</button>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="h-[26px] border border-rule px-2 text-[11px]" onClick={() => setShowUpdate(false)}>{t(lang, 'common.cancel')}</button>
            <button type="button" disabled={installing} className="h-[26px] bg-accent-fill px-2 font-semibold text-on-accent disabled:opacity-45" onClick={() => void installUpdate()}>
              {installing ? t(lang, 'updates.installing') : t(lang, 'updates.installNow')}
            </button>
          </div>
        </section>
      )}
    </header>
  );
}
