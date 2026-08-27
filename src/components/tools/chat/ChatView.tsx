import { Tv } from 'lucide-react';
import { t } from '../../../i18n/translations';
import { useSettingsStore } from '../../../store/settingsStore';
import { ChatPreview } from './ChatPreview';
import { ChatSettingsPanel } from './ChatSettingsPanel';

export function ChatView() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  return (
    <div>
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <Tv size={22} className="text-primary" aria-hidden />
          <h1 className="font-display text-3xl uppercase leading-none text-ink">
            {t(lang, 'chat.title')}
          </h1>
        </div>
        <div className="mt-5 h-px bg-ink/20">
          <div className="h-px w-56 bg-primary" />
        </div>
        <p className="mt-4 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-ink/65">
          {t(lang, 'chat.subtitle')}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        {/* Live Preview Panel */}
        <div className="xl:col-span-7 flex flex-col min-h-[520px]">
          <ChatPreview />
        </div>

        {/* Customization & Settings Panel */}
        <div className="xl:col-span-5">
          <ChatSettingsPanel />
        </div>
      </div>
    </div>
  );
}
