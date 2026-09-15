import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../../../store/settingsStore';
import type { ChatOverlayPart } from '../../../overlay/ChatMessageCard';
import {
  clampChatInspectorWidth,
  DEFAULT_CHAT_INSPECTOR_WIDTH,
  MAX_CHAT_INSPECTOR_WIDTH,
  MIN_CHAT_INSPECTOR_WIDTH,
} from '../../../lib/chatOverlay';
import { ChatCanvas, type CanvasMode } from './ChatCanvas';
import { ChatOverlayBar } from './ChatOverlayBar';
import { ChatSettingsPanel } from './ChatSettingsPanel';
import { useSettingsHistory } from './useSettingsHistory';
import { ChatTargetProvider, type ChatTarget } from './ChatTargetContext';
import { t } from '../../../i18n/translations';

const STORAGE_KEY = 'streamer-hub-chat-inspector-width';

export interface ChatViewProps {
  target?: ChatTarget;
}

export function ChatView({ target = 'overlay' }: ChatViewProps) {
  return (
    <ChatTargetProvider target={target}>
      <ChatViewInner target={target} />
    </ChatTargetProvider>
  );
}

function ChatViewInner({ target }: { target: ChatTarget }) {
  const containerRef = useRef<HTMLElement | null>(null);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const isRtl = lang === 'ar';
  const [mode, setMode] = useState<CanvasMode>('preview');
  const [selectedPart, setSelectedPart] = useState<ChatOverlayPart | null>(null);
  const { undo, redo, canUndo, canRedo } = useSettingsHistory();
  const [isDragging, setIsDragging] = useState(false);

  const storageKey = target === 'obs-chat' ? 'streamer-hub-obs-chat-inspector-width' : STORAGE_KEY;

  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? Number(raw) : NaN;
      if (!Number.isNaN(parsed) && parsed > 0) {
        return clampChatInspectorWidth(parsed);
      }
    }
    return DEFAULT_CHAT_INSPECTOR_WIDTH;
  });

  const changeMode = (next: CanvasMode) => {
    setMode(next);
    if (next === 'preview') setSelectedPart(null);
  };

  const updateWidth = (nextWidth: number) => {
    const containerWidth = containerRef.current?.getBoundingClientRect().width;
    const clamped = clampChatInspectorWidth(nextWidth, containerWidth);
    setInspectorWidth(clamped);
    try {
      localStorage.setItem(storageKey, String(clamped));
    } catch {
      // ignore storage error
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = inspectorWidth;
    const container = containerRef.current;
    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaX = isRtl ? (moveEvent.clientX - startX) : (startX - moveEvent.clientX);
      const targetWidth = startWidth + deltaX;
      const containerWidth = container?.getBoundingClientRect().width;
      const clamped = clampChatInspectorWidth(targetWidth, containerWidth);
      setInspectorWidth(clamped);
      try {
        localStorage.setItem(storageKey, String(clamped));
      } catch {
        // ignore storage error
      }
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 16;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      updateWidth(isRtl ? inspectorWidth - step : inspectorWidth + step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      updateWidth(isRtl ? inspectorWidth + step : inspectorWidth - step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      updateWidth(DEFAULT_CHAT_INSPECTOR_WIDTH);
    }
  };

  // Re-clamp if the container resizes and space is constrained
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setInspectorWidth((curr) => clampChatInspectorWidth(curr, entry.contentRect.width));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {target === 'overlay' && <ChatOverlayBar />}
      <section
        ref={containerRef}
        className="relative grid min-h-0 flex-1 bg-surface-3"
        style={{
          gridTemplateColumns: `minmax(0,1fr) ${inspectorWidth}px`,
        }}
        aria-label={target === 'obs-chat' ? (lang === 'ar' ? 'شات OBS' : 'OBS Chat') : t(lang, 'workspace.overlay')}
      >
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
        <div className="relative min-h-0 border-s-2 border-rule bg-surface-2">
          {/* Resize Divider */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t(lang, 'workspace.resizeInspector')}
            aria-valuenow={inspectorWidth}
            aria-valuemin={MIN_CHAT_INSPECTOR_WIDTH}
            aria-valuemax={MAX_CHAT_INSPECTOR_WIDTH}
            tabIndex={0}
            title={t(lang, 'workspace.resizeInspector')}
            onPointerDown={handlePointerDown}
            onDoubleClick={() => updateWidth(DEFAULT_CHAT_INSPECTOR_WIDTH)}
            onKeyDown={handleKeyDown}
            className="group absolute -start-[5px] top-0 bottom-0 z-20 w-[9px] cursor-col-resize select-none touch-none focus-visible:outline-none"
          >
            <div
              className={`absolute inset-y-0 start-[3px] w-[2px] transition-colors ${
                isDragging
                  ? 'bg-accent'
                  : 'bg-transparent group-hover:bg-accent/70 group-focus-visible:bg-accent'
              }`}
            />
          </div>
          <ChatSettingsPanel selectedPart={selectedPart} />
        </div>
      </section>
    </div>
  );
}

