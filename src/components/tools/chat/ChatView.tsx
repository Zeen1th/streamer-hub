import { useState } from 'react';
import { useSettingsStore } from '../../../store/settingsStore';
import type { ChatOverlayPart } from '../../../overlay/ChatMessageCard';
import { ChatCanvas, type CanvasMode } from './ChatCanvas';
import { ChatSettingsPanel } from './ChatSettingsPanel';
import { useSettingsHistory } from './useSettingsHistory';
import { t } from '../../../i18n/translations';

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
    <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] bg-surface-3" aria-label={t(lang, 'workspace.overlay')}>
      <div className="min-h-0 min-w-0">
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
      <div className="min-h-0 border-s-2 border-rule bg-surface-2">
        <ChatSettingsPanel selectedPart={selectedPart} />
      </div>
    </section>
  );
}
