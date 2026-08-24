import { Download, Flame, Languages } from 'lucide-react';
import { useState } from 'react';
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
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const releaseNotes = useUpdateStore((s) => s.releaseNotes);
  const installing = useUpdateStore((s) => s.installing);
  const installUpdate = useUpdateStore((s) => s.install);
  const checkForUpdate = useUpdateStore((s) => s.check);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [showUpdatePanel, setShowUpdatePanel] = useState(false);

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
            title={installing ? 'Installing update' : updateAvailable ? 'Update available' : 'Check for updates'}
            disabled={installing}
            onClick={async () => {
              setUpdateMessage(null);
              const result = await checkForUpdate();
              if (result?.updateAvailable) {
                setShowUpdatePanel(true);
                return;
              }
              setUpdateMessage(t(lang, 'updates.upToDate'));
              window.setTimeout(() => setUpdateMessage(null), 3500);
            }}
            className={`flex h-7 items-center gap-1.5 border px-2 font-sans text-xs font-bold uppercase tracking-[0.08em] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${updateAvailable ? 'border-primary bg-primary text-white hover:bg-primary/90' : 'border-ink/25 bg-surface-2 text-ink/75 hover:border-ink/50'}`}
          >
            <Download size={13} aria-hidden />
            {installing ? <span>Updating...</span> : updateAvailable && <span>Update</span>}
          </button>
          {updateMessage && <span role="status" className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-success">{updateMessage}</span>}
          {showUpdatePanel && updateAvailable && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !installing) setShowUpdatePanel(false); }}>
              <section role="dialog" aria-modal="true" aria-labelledby="update-dialog-title" className="slab w-full max-w-lg p-6 text-start shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p id="update-dialog-title" className="font-display text-lg uppercase tracking-[0.08em] text-ink">{t(lang, 'updates.available')} · v{latestVersion}</p>
                    <p className="mt-2 text-xs text-ink/65">{installing ? t(lang, 'updates.installing') : t(lang, 'updates.available')}</p>
                  </div>
                  {!installing && <button type="button" aria-label="Close update details" onClick={() => setShowUpdatePanel(false)} className="text-lg leading-none text-ink/60 hover:text-ink">×</button>}
                </div>
                <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap border-t border-ink/10 pt-3 text-xs leading-relaxed text-ink/75">{releaseNotes || t(lang, 'updates.fallbackNotes')}</div>
                {installing ? <div className="mt-4 h-1.5 overflow-hidden bg-ink/10"><div className="update-progress h-full w-2/5 bg-primary" /></div> : <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowUpdatePanel(false)} className="border border-ink/25 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-ink/70">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button><button type="button" onClick={() => { void installUpdate(); }} className="bg-primary px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-on-primary">{lang === 'ar' ? 'تحديث الآن' : 'Update now'}</button></div>}
              </section>
            </div>
          )}
          <WindowControls />
        </div>
      </div>
    </header>
  );
}

