import { useState } from 'react';
import { Tv } from 'lucide-react';
import { t } from '../../../i18n/translations';
import { useSettingsStore } from '../../../store/settingsStore';
import type { ChatOverlayPart } from '../../../overlay/ChatMessageCard';
import { ChatCanvas, type CanvasMode } from './ChatCanvas';
import { ChatSettingsPanel } from './ChatSettingsPanel';
import { useSettingsHistory } from './useSettingsHistory';

export function ChatView() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const [mode, setMode] = useState<CanvasMode>('preview');
  const [selectedPart, setSelectedPart] = useState<ChatOverlayPart | null>(null);
  const { undo, redo, canUndo, canRedo } = useSettingsHistory();

  const changeMode = (next: CanvasMode) => {
    setMode(next);
    if (next === 'preview') setSelectedPart(null);
  };

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
        <div className="xl:col-span-7 flex flex-col min-h-[560px]">
          <ChatCanvas
            mode={mode}
            onModeChange={changeMode}
            selectedPart={selectedPart}
            onSelectPart={setSelectedPart}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>

        <div className="xl:col-span-5 max-h-[calc(100vh-14rem)]">
          <ChatSettingsPanel selectedPart={selectedPart} />
        </div>
      </div>
    </div>
  );
}
