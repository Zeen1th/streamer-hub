import { Square, Maximize2, Minus, X } from 'lucide-react';
import { t } from '../../i18n/translations';
import { rpc } from '../../rpc';
import { Channels } from '../../rpc/contracts';
import { useConnectionStore } from '../../store/connectionStore';
import { useSettingsStore } from '../../store/settingsStore';

const controlClass =
  'flex h-full w-12 items-center justify-center text-ink/80 transition-colors duration-100 hover:bg-ink/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary';

export function WindowControls() {
  const isMaximized = useConnectionStore((s) => s.isMaximized);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  return (
    <div className="flex h-full items-stretch border-s border-ink/15">
      <button
        type="button"
        aria-label={t(lang, 'window.minimize')}
        title={t(lang, 'window.minimize')}
        className={controlClass}
        onClick={() => {
          rpc.invoke(Channels.WindowMinimize).catch(() => undefined);
        }}
      >
        <Minus size={14} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label={isMaximized ? t(lang, 'window.restore') : t(lang, 'window.maximize')}
        title={isMaximized ? t(lang, 'window.restore') : t(lang, 'window.maximize')}
        className={controlClass}
        onClick={() => {
          rpc.invoke(Channels.WindowMaximizeToggle).catch(() => undefined);
        }}
      >
        {isMaximized ? <Maximize2 size={13} strokeWidth={2.5} /> : <Square size={12} strokeWidth={2.5} />}
      </button>
      <button
        type="button"
        aria-label={t(lang, 'window.close')}
        title={t(lang, 'window.close')}
        className="flex h-full w-12 items-center justify-center text-ink/80 transition-colors duration-100 hover:bg-danger hover:text-on-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        onClick={() => {
          rpc.invoke(Channels.WindowClose).catch(() => undefined);
        }}
      >
        <X size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}
