import { Download, Flame, Languages } from 'lucide-react';
import { t } from '../../i18n/translations';
import { isMockMode, rpc } from '../../rpc';
import { Channels } from '../../rpc/contracts';
import { useSettingsStore } from '../../store/settingsStore';
import { ConnectionIndicators } from './ConnectionIndicators';
import { WindowControls } from './WindowControls';
import { useUpdateStore } from '../../store/updateStore';

export function Titlebar() {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const lang = language === 'ar' ? 'ar' : 'en';
  const updateAvailable = useUpdateStore((s) => s.updateAvailable);
  const releaseUrl = useUpdateStore((s) => s.downloadUrl || s.releaseUrl);

  return (
    <header
      dir="ltr"
      className="relative z-50 flex h-10 shrink-0 select-none items-center justify-between border-b border-ink/15 bg-surface ps-4"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('[data-drag-exclude]')) return;
        rpc.invoke(Channels.WindowBeginDrag).catch(() => undefined);
      }}
      onDoubleClick={() => {
        rpc.invoke(Channels.WindowMaximizeToggle).catch(() => undefined);
      }}
    >
      <div className="flex items-center gap-2.5">
        <Flame size={13} className="text-primary" aria-hidden />
        <span dir="ltr" className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-ink">
          Streamer Hub
        </span>
      </div>
      <div className="flex h-full items-center">
        {isMockMode && (
          <span
            data-drag-exclude
            className="me-4 border border-dashed border-warning/60 px-2 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.15em] text-warning"
          >
            {t(lang, 'titlebar.devMock')}
          </span>
        )}
        <div data-drag-exclude className="flex h-full items-center gap-4">
          <button
            type="button"
            aria-label={t(lang, 'titlebar.language')}
            title={t(lang, 'titlebar.language')}
            onClick={() => setLanguage(lang === 'ar' ? 'en' : 'ar')}
            className="flex h-7 items-center gap-1.5 border border-ink/25 bg-surface-2 px-2 font-sans text-xs font-bold uppercase tracking-[0.08em] text-ink/75 transition-colors duration-150 hover:border-ink/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Languages size={13} aria-hidden />
            <span dir="ltr">{lang === 'ar' ? 'EN' : 'عربي'}</span>
          </button>
          <ConnectionIndicators />
          <button
            type="button"
            aria-label={updateAvailable ? 'Update available' : 'Check for updates'}
            title={updateAvailable ? 'Update available' : 'Check for updates'}
            onClick={() => window.open(releaseUrl, '_blank', 'noopener,noreferrer')}
            className={`flex h-7 items-center gap-1.5 border px-2 font-sans text-xs font-bold uppercase tracking-[0.08em] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${updateAvailable ? 'border-primary bg-primary text-white hover:bg-primary/90' : 'border-ink/25 bg-surface-2 text-ink/75 hover:border-ink/50'}`}
          >
            <Download size={13} aria-hidden />
            {updateAvailable && <span>Update</span>}
          </button>
          <WindowControls />
        </div>
      </div>
    </header>
  );
}
