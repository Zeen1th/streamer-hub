import { Download, Moon, Sun, Sparkles, Wrench, X, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../../i18n/translations';
import { rpc } from '../../rpc';
import { Channels } from '../../rpc/contracts';
import { resolveTheme } from '../../lib/theme';
import { useSettingsStore } from '../../store/settingsStore';
import { useUpdateStore } from '../../store/updateStore';
import { parseReleaseNotes } from '../../lib/releaseNotes';
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
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const releaseNotes = useUpdateStore((s) => s.releaseNotes);
  const installing = useUpdateStore((s) => s.installing);
  const installUpdate = useUpdateStore((s) => s.install);
  const checkForUpdate = useUpdateStore((s) => s.check);
  const debugPromptRequested = useUpdateStore((s) => s.debugPromptRequested);
  const clearDebugPrompt = useUpdateStore((s) => s.clearDebugPrompt);
  const [showUpdate, setShowUpdate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parsedNotes = parseReleaseNotes(releaseNotes, lang);
  const displayCurrentVersion = currentVersion && currentVersion !== '0.1.0' ? currentVersion : '0.3.9';

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
        <svg className="size-[19px] shrink-0" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="tb-tile-bg" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#242C36" />
              <stop offset="100%" stopColor="#11161B" />
            </linearGradient>
            <linearGradient id="tb-beacon-grad" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          {/* App Tile Squircle */}
          <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#tb-tile-bg)" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1.8" />
          {/* Outer Diamond Pulse Ring */}
          <rect x="14" y="14" width="36" height="36" rx="7.5" transform="rotate(45 32 32)" fill="none" stroke="url(#tb-beacon-grad)" strokeWidth="2.8" opacity="0.5" />
          {/* Mid Diamond Pulse Ring */}
          <rect x="19" y="19" width="26" height="26" rx="6" transform="rotate(45 32 32)" fill="none" stroke="url(#tb-beacon-grad)" strokeWidth="3.4" opacity="0.85" />
          {/* Central Core Diamond */}
          <rect x="24.5" y="24.5" width="15" height="15" rx="3.5" transform="rotate(45 32 32)" fill="url(#tb-beacon-grad)" />
          {/* Center Beacon Dot */}
          <circle cx="32" cy="32" r="2.8" fill="#FFFFFF" />
        </svg>
        <span className="font-sans text-[12.5px] font-bold tracking-tight text-ink">Streamer Hub</span>
        <span className="font-mono text-[10.5px] text-[#9AA3AF]">v0.3.9</span>
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
        <section
          data-drag-exclude
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          className="absolute end-3 top-9 z-50 w-[430px] max-w-[calc(100vw-24px)] rounded-xl border border-white/10 bg-[#171e25]/95 p-4 shadow-2xl backdrop-blur-md text-start select-text"
          aria-label={t(lang, 'updates.available')}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent-text border border-accent/25 shadow-inner">
                <Sparkles size={16} className="text-accent" />
              </div>
              <div>
                <h3 className="font-sans text-[13px] font-bold text-ink leading-tight">
                  {t(lang, 'updates.available')}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-muted" dir="ltr">
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 border border-white/[0.08]">
                    v{displayCurrentVersion}
                  </span>
                  <span className="text-accent font-sans">➜</span>
                  <span className="rounded bg-accent/20 px-1.5 py-0.5 font-semibold text-accent-text border border-accent/30">
                    v{latestVersion}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="grid size-6 place-items-center rounded-md text-muted hover:bg-white/[0.08] hover:text-ink transition-colors"
              onClick={() => setShowUpdate(false)}
              aria-label={t(lang, 'common.cancel')}
            >
              <X size={14} />
            </button>
          </div>

          {/* Release Notes Content */}
          <div className="mt-3 max-h-[290px] overflow-y-auto space-y-3 pe-1 font-sans text-[12px] leading-relaxed">
            {parsedNotes.whatsNew.length > 0 && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-400 text-[11.5px] mb-2">
                  <Sparkles size={13} className="shrink-0" />
                  <span>{t(lang, 'updates.whatsNew')}</span>
                </div>
                <ul className="space-y-1.5 text-ink/90 text-[11.5px]">
                  {parsedNotes.whatsNew.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-emerald-400/80 shrink-0 mt-1.5" />
                      <span className="break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedNotes.whatsFixed.length > 0 && (
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.06] p-2.5">
                <div className="flex items-center gap-1.5 font-semibold text-sky-400 text-[11.5px] mb-2">
                  <Wrench size={13} className="shrink-0" />
                  <span>{t(lang, 'updates.whatsFixed')}</span>
                </div>
                <ul className="space-y-1.5 text-ink/90 text-[11.5px]">
                  {parsedNotes.whatsFixed.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-sky-400/80 shrink-0 mt-1.5" />
                      <span className="break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedNotes.whatsNew.length === 0 && parsedNotes.whatsFixed.length === 0 && (
              <div className="rounded-lg border border-white/[0.08] bg-surface-2/60 p-2.5 text-muted">
                <p className="whitespace-pre-wrap break-words">{parsedNotes.rawSummary || releaseNotes || t(lang, 'updates.fallbackNotes')}</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-3.5 flex items-center justify-end gap-2 border-t border-white/[0.08] pt-3">
            <button
              type="button"
              className="h-[28px] rounded-md border border-white/10 bg-surface-2 px-3 text-[11.5px] font-medium text-muted hover:bg-surface-hover hover:text-ink transition-colors"
              onClick={() => setShowUpdate(false)}
            >
              {t(lang, 'updates.later')}
            </button>
            <button
              type="button"
              disabled={installing}
              className="flex h-[28px] items-center gap-1.5 rounded-md bg-accent-fill px-3.5 text-[11.5px] font-semibold text-on-accent hover:bg-accent disabled:cursor-not-allowed shadow transition-colors"
              onClick={async () => {
                const started = await installUpdate();
                if (!started) setMessage(t(lang, 'updates.installFailed'));
              }}
            >
              {installing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>{t(lang, 'updates.installing')}</span>
                </>
              ) : (
                <>
                  <Download size={13} />
                  <span>{t(lang, 'updates.installNow')}</span>
                </>
              )}
            </button>
          </div>
        </section>
      )}
    </header>
  );
}
