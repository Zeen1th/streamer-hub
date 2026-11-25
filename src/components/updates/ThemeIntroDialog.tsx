import { Check, Palette } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { t } from '../../i18n/translations';
import { useSettingsStore } from '../../store/settingsStore';
import { useTourStore } from '../../store/tourStore';
import { useUpdateStore } from '../../store/updateStore';

/*
 * One-time "new look" window for people who updated: shows the Dark and Fluent themes side by side.
 * Picking one switches the whole app live behind the window, so the streamer sees the real thing.
 * New installs never see it (they choose in Settings), and it waits until What's New and the tour are closed.
 */

const SEEN_KEY = 'streamer-hub-theme-intro-seen';

// Decided at load, before this session writes anything: only someone with earlier app data is an updater
const IS_UPDATER = (() => {
  try {
    if (localStorage.getItem(SEEN_KEY) === '1') return false;
    return Object.keys(localStorage).some((key) => key.startsWith('streamer-hub-') && key !== SEEN_KEY);
  } catch {
    return false;
  }
})();

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // storage unavailable: the window may show again next launch
  }
}

type Look = 'dark' | 'fluent';

/** Colors for the small drawn preview. Inline styles on purpose, so the Fluent skin never recolors the Dark preview. */
const PALETTE: Record<Look, { window: string; side: string; content: string; card: string; line: string; text: string; accent: string; onAccent: string; radius: number; border: string }> = {
  dark: { window: '#1a2228', side: '#1a2228', content: '#23282e', card: '#2e3438', line: '#3a4249', text: '#e8ecf2', accent: '#6366f1', onAccent: '#ffffff', radius: 3, border: 'rgba(255,255,255,0.08)' },
  fluent: { window: 'rgba(34,34,40,0.72)', side: 'transparent', content: 'rgba(255,255,255,0.05)', card: 'rgba(255,255,255,0.07)', line: 'rgba(255,255,255,0.16)', text: '#ffffff', accent: '#a5b4fc', onAccent: '#12142b', radius: 5, border: 'rgba(255,255,255,0.09)' },
};

function ThemePreview({ look }: { look: Look }) {
  const p = PALETTE[look];
  const bar = (width: string, color = p.line, height = 5): CSSProperties => ({ width, height, borderRadius: 3, background: color });
  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        height: 150,
        borderRadius: 8,
        overflow: 'hidden',
        // Fluent sits on a soft wallpaper tint, like Acrylic over the desktop
        background: look === 'fluent' ? 'radial-gradient(80% 90% at 15% 20%, #4b3aa0 0%, transparent 60%), radial-gradient(70% 80% at 90% 90%, #146d86 0%, transparent 60%), #15161d' : '#12171c',
        padding: look === 'fluent' ? 10 : 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          height: '100%',
          borderRadius: look === 'fluent' ? 7 : 0,
          border: look === 'fluent' ? `1px solid ${p.border}` : 'none',
          background: p.window,
          backdropFilter: look === 'fluent' ? 'blur(18px)' : undefined,
          overflow: 'hidden',
        }}
      >
        {/* Side menu */}
        <div style={{ width: '28%', background: p.side, borderInlineEnd: look === 'dark' ? `1px solid ${p.border}` : 'none', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ position: 'relative', padding: '4px 6px', borderRadius: p.radius, background: look === 'dark' ? '#2a3138' : 'rgba(255,255,255,0.08)' }}>
            <span style={{ position: 'absolute', insetInlineStart: 0, top: 4, width: 2, height: 7, borderRadius: 2, background: p.accent }} />
            <div style={bar('70%', p.text)} />
          </div>
          <div style={{ padding: '0 6px' }}><div style={bar('55%')} /></div>
          <div style={{ padding: '0 6px' }}><div style={bar('60%')} /></div>
        </div>
        {/* Page */}
        <div
          style={{
            flex: 1,
            background: p.content,
            borderStartStartRadius: look === 'fluent' ? 7 : 0,
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={bar('38%', p.text, 7)} />
            <div style={{ width: 34, height: 11, borderRadius: p.radius, background: p.accent }} />
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 7px', borderRadius: p.radius, background: p.card, border: `1px solid ${p.border}` }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={bar(row === 1 ? '45%' : '55%', p.text, 4)} />
                <div style={bar('30%', p.line, 3)} />
              </div>
              <div style={{ position: 'relative', width: 16, height: 9, borderRadius: 5, background: row === 2 ? 'transparent' : p.accent, border: row === 2 ? `1px solid ${p.line}` : 'none' }}>
                <span style={{ position: 'absolute', top: row === 2 ? 1 : 2, insetInlineStart: row === 2 ? 1 : 9, width: 5, height: 5, borderRadius: 3, background: row === 2 ? p.line : p.onAccent }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ThemeIntroDialog() {
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const whatsNewOpen = useUpdateStore((s) => s.whatsNewOpen);
  const tourOpen = useTourStore((s) => s.open);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(!IS_UPDATER);

  // Wait for the language choice, What's New and the tour, then a short pause so windows never stack
  useEffect(() => {
    if (done || open || language === '' || whatsNewOpen || tourOpen) return;
    const timer = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(timer);
  }, [done, open, language, whatsNewOpen, tourOpen]);

  if (!open) return null;

  const current: Look = theme === 'fluent' ? 'fluent' : 'dark';
  const close = () => {
    markSeen();
    setDone(true);
    setOpen(false);
  };

  const options: { look: Look; name: string; hint: string }[] = [
    { look: 'dark', name: t(lang, 'settings.themeDark'), hint: t(lang, 'themeIntro.darkHint') },
    { look: 'fluent', name: t(lang, 'settings.themeFluent'), hint: t(lang, 'themeIntro.fluentHint') },
  ];

  return (
    <div
      role="presentation"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-intro-title"
        className="w-full max-w-[640px] rounded-[10px] border border-white/[0.1] bg-[#1a2228] p-6 text-ink shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-[6px] bg-accent/15 text-accent-text">
            <Palette size={16} aria-hidden />
          </span>
          <h2 id="theme-intro-title" className="font-sans text-[18px] font-semibold text-ink">
            {t(lang, 'themeIntro.title')}
          </h2>
        </div>
        <p className="mt-2 font-sans text-[13px] leading-relaxed text-muted">{t(lang, 'themeIntro.body')}</p>

        <div role="radiogroup" aria-label={t(lang, 'settings.theme')} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((option) => {
            const selected = current === option.look;
            return (
              <button
                key={option.look}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(option.look)}
                className={`rounded-[8px] border p-2 text-start transition-colors ${
                  selected ? 'border-accent bg-accent/10' : 'border-white/[0.08] hover:border-white/[0.18]'
                }`}
              >
                <ThemePreview look={option.look} />
                <div className="flex items-center justify-between gap-2 px-1.5 pb-1 pt-2.5">
                  <span className="font-sans text-[14px] font-semibold text-ink">{option.name}</span>
                  {selected && (
                    <span className="grid size-5 place-items-center rounded-full bg-accent text-on-accent">
                      <Check size={12} strokeWidth={3} aria-hidden />
                    </span>
                  )}
                </div>
                <p className="px-1.5 pb-1 font-sans text-[12px] leading-snug text-muted">{option.hint}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="font-sans text-[12px] text-muted">{t(lang, 'themeIntro.later')}</span>
          <button
            type="button"
            onClick={close}
            className="h-[34px] rounded-[4px] bg-accent px-4 font-sans text-[13px] font-semibold text-on-accent transition-colors hover:bg-accent-hover"
          >
            {t(lang, current === 'fluent' ? 'themeIntro.keepFluent' : 'themeIntro.keepDark')}
          </button>
        </div>
      </section>
    </div>
  );
}
