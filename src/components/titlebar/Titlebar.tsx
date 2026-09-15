import { Download, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../../i18n/translations';
import { rpc } from '../../rpc';
import { Channels } from '../../rpc/contracts';
import { resolveTheme } from '../../lib/theme';
import { useSettingsStore } from '../../store/settingsStore';
import { useUpdateStore } from '../../store/updateStore';
import { WindowControls } from './WindowControls';

export function Titlebar() {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const lastDarkTheme = useSettingsStore((s) => s.lastDarkTheme);
  const lang = language === 'ar' ? 'ar' : 'en';
  const systemIsDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const resolvedTheme = resolveTheme(theme, systemIsDark);
  const updateAvailable = useUpdateStore((s) => s.updateAvailable);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const releaseNotes = useUpdateStore((s) => s.releaseNotes);
  const installing = useUpdateStore((s) => s.installing);
  const installUpdate = useUpdateStore((s) => s.install);
  const checkForUpdate = useUpdateStore((s) => s.check);
  const debugPromptRequested = useUpdateStore((s) => s.debugPromptRequested);
  const clearDebugPrompt = useUpdateStore((s) => s.clearDebugPrompt);
  const [showUpdate, setShowUpdate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!debugPromptRequested) return;
    setShowUpdate(true);
    clearDebugPrompt();
  }, [clearDebugPrompt, debugPromptRequested]);

  return (
    <header
      dir="ltr"
      className="relative z-50 flex h-8 shrink-0 select-none items-center justify-between border-b border-white/[0.08] bg-[#1a2228] ps-3"
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as HTMLElement | null)?.closest('[data-drag-exclude]')) return;
        rpc.invoke(Channels.WindowBeginDrag).catch(() => undefined);
      }}
      onDoubleClick={() => rpc.invoke(Channels.WindowMaximizeToggle).catch(() => undefined)}
    >
      <div className="flex items-center gap-2.5">
        <svg className="size-[18px] shrink-0" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="tb-bm" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8B6BF0" />
              <stop offset="55%" stopColor="#5B6CF0" />
              <stop offset="100%" stopColor="#1E8FE0" />
            </linearGradient>
          </defs>
          <rect x="22" y="4" width="27" height="27" rx="8" transform="rotate(45 35.5 17.5)" fill="none" stroke="url(#tb-bm)" strokeWidth="6" />
          <rect x="15" y="23" width="27" height="27" rx="8" transform="rotate(45 28.5 36.5)" fill="url(#tb-bm)" />
        </svg>
        <span className="font-sans text-[12.5px] font-bold tracking-tight text-ink">Streamer Hub</span>
        <span className="font-mono text-[10.5px] text-[#9AA3AF]">v0.3.0</span>
      </div>
      <div data-drag-exclude className="flex h-full items-center gap-1 pe-1">
        {message && <span role="status" className="px-2 font-mono text-[10px] text-muted">{message}</span>}
        {updateAvailable && (
          <button type="button" className="flex h-[24px] items-center gap-1 rounded-[4px] border border-accent/40 bg-accent-soft px-2 font-sans text-[10px] font-semibold text-accent-text hover:bg-accent/20" onClick={() => setShowUpdate((value) => !value)}>
            <Download size={12} aria-hidden /> {t(lang, 'updates.available')} · v{latestVersion}
          </button>
        )}
        <button
          type="button"
          className="flex h-[24px] items-center rounded-[4px] px-2 font-sans text-[11px] font-medium text-muted hover:bg-white/[0.06] hover:text-ink transition-colors"
          title={t(lang, 'titlebar.language')}
          onClick={() => setLanguage(lang === 'ar' ? 'en' : 'ar')}
        >
          <span dir="ltr">{lang === 'ar' ? 'EN' : 'عربي'}</span>
        </button>
        <button
          type="button"
          className="grid h-[24px] w-7 place-items-center rounded-[4px] text-muted hover:bg-white/[0.06] hover:text-ink transition-colors"
          title={t(lang, 'titlebar.appearance')}
          aria-label={t(lang, 'titlebar.appearance')}
          onClick={() => setTheme(resolvedTheme === 'light' ? (lastDarkTheme || 'dark') : 'light')}
        >
          {resolvedTheme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
        </button>
        {!updateAvailable && (
          <button
            type="button"
            disabled={installing}
            className="grid h-[24px] w-7 place-items-center rounded-[4px] text-muted hover:bg-white/[0.06] hover:text-ink disabled:cursor-not-allowed transition-colors"
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
        <section data-drag-exclude className="absolute right-[120px] top-8 z-50 w-[360px] rounded-lg border border-rule bg-surface-3 p-4 shadow-xl text-start" aria-label={t(lang, 'updates.available')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-sans text-[13px] font-bold text-ink">{t(lang, 'updates.available')} · v{latestVersion}</div>
              <p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[11px] text-muted">{releaseNotes || t(lang, 'updates.fallbackNotes')}</p>
            </div>
            <button type="button" className="px-1 text-muted hover:text-ink rounded" onClick={() => setShowUpdate(false)}>✕</button>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="h-[26px] rounded-md border border-rule bg-surface-2 px-2.5 text-[11px] hover:bg-surface-hover" onClick={() => setShowUpdate(false)}>{t(lang, 'common.cancel')}</button>
            <button type="button" disabled={installing} className="h-[26px] rounded-md bg-accent-fill px-3 font-semibold text-on-accent hover:bg-accent disabled:cursor-not-allowed shadow-sm" onClick={async () => {
              const started = await installUpdate();
              if (!started) setMessage(t(lang, 'updates.installFailed'));
            }}>
              {installing ? t(lang, 'updates.installing') : t(lang, 'updates.installNow')}
            </button>
          </div>
        </section>
      )}
    </header>
  );
}
