import { Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n/translations';
import { CHANGELOG, changelogSince, compareVersions, LATEST_CHANGELOG_VERSION, type ChangelogEntry } from '../../lib/changelog';
import { isMockMode } from '../../rpc';
import { useConnectionStore } from '../../store/connectionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useUpdateStore } from '../../store/updateStore';
import { Button } from '../ui/Button';

const LAST_SEEN_KEY = 'streamer-hub-last-seen-version';
/** Last release before this window existed: anyone with older data is treated as coming from it. */
const LEGACY_BASELINE = '0.4.7';

// Decided at load, before this session writes anything, so a brand-new install is not shown history it never lived through.
const HAD_PRIOR_DATA = (() => {
  try {
    return Object.keys(localStorage).some((key) => key.startsWith('streamer-hub-') && key !== LAST_SEEN_KEY);
  } catch {
    return false;
  }
})();

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeLastSeen(version: string) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version);
  } catch {
    // storage unavailable: the window may show again next launch
  }
}

/** Shows what changed after an update (in the user's language), or on demand from Settings. */
export function WhatsNewDialog() {
  const open = useUpdateStore((s) => s.whatsNewOpen);
  const openWhatsNew = useUpdateStore((s) => s.openWhatsNew);
  const closeWhatsNew = useUpdateStore((s) => s.closeWhatsNew);
  const statusReceived = useConnectionStore((s) => s.statusReceived);
  const coreVersion = useConnectionStore((s) => s.coreVersion);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [autoEntries, setAutoEntries] = useState<ChangelogEntry[] | null>(null);
  const [checked, setChecked] = useState(false);

  // In the browser preview there is no real host version, so pretend to be the newest release.
  const current = isMockMode || !coreVersion ? LATEST_CHANGELOG_VERSION : coreVersion;

  useEffect(() => {
    if (checked || !statusReceived || !coreVersion || language === '') return;
    setChecked(true);
    const stored = readLastSeen();
    const lastSeen = stored ?? (HAD_PRIOR_DATA ? LEGACY_BASELINE : null);
    if (lastSeen === null) {
      writeLastSeen(current); // fresh install: nothing to announce
      return;
    }
    const entries = changelogSince(lastSeen, current);
    if (entries.length === 0) {
      if (stored !== current && compareVersions(current, lastSeen) > 0) writeLastSeen(current);
      return;
    }
    setAutoEntries(entries);
    openWhatsNew();
  }, [checked, statusReceived, coreVersion, language, current, openWhatsNew]);

  const entries = useMemo(
    () => autoEntries ?? CHANGELOG.filter((e) => compareVersions(e.version, current) <= 0),
    [autoEntries, current],
  );

  if (!open || entries.length === 0) return null;

  const close = () => {
    writeLastSeen(current);
    setAutoEntries(null);
    closeWhatsNew();
  };

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="flex max-h-[85vh] w-full max-w-[540px] flex-col overflow-hidden rounded-[12px] border border-white/[0.14] bg-[#1a2228] text-[#f8fafc] shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[#151c21] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-[8px] border border-accent/35 bg-accent/15 text-accent-text">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 id="whats-new-title" className="font-sans text-[15px] font-bold tracking-tight text-white">
                {autoEntries ? t(lang, 'whatsNew.title', { version: current }) : t(lang, 'whatsNew.titleManual')}
              </h2>
              <p className="font-sans text-[11.5px] text-muted">
                {autoEntries ? t(lang, 'whatsNew.subtitle') : `v${current}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t(lang, 'whatsNew.gotIt')}
            className="grid size-7 place-items-center rounded text-muted transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <X size={15} />
          </button>
        </header>

        <div className="app-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {entries.map((entry) => {
            const section = lang === 'ar' ? entry.ar : entry.en;
            return (
              <article key={entry.version} className="space-y-2.5">
                {entries.length > 1 && (
                  <div dir="ltr" className={`font-mono text-[12px] font-bold text-accent-text ${lang === 'ar' ? 'text-end' : ''}`}>
                    v{entry.version}
                  </div>
                )}
                {section.added.length > 0 && (
                  <div>
                    <div className="mb-1 font-sans text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      {t(lang, 'whatsNew.added')}
                    </div>
                    <ul className="list-disc space-y-1.5 ps-5 font-sans text-[12.5px] leading-relaxed text-zinc-200 marker:text-emerald-500/70">
                      {section.added.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {section.fixed.length > 0 && (
                  <div>
                    <div className="mb-1 font-sans text-[11px] font-bold uppercase tracking-wider text-sky-400">
                      {t(lang, 'whatsNew.fixed')}
                    </div>
                    <ul className="list-disc space-y-1.5 ps-5 font-sans text-[12.5px] leading-relaxed text-zinc-200 marker:text-sky-500/70">
                      {section.fixed.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <footer className="flex justify-end border-t border-white/[0.08] bg-[#151c21] px-5 py-3">
          <Button size="sm" onClick={close} className="bg-accent font-semibold text-white hover:bg-accent-hover">
            {t(lang, 'whatsNew.gotIt')}
          </Button>
        </footer>
      </section>
    </div>
  );
}
