import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Eye, Image as ImageIcon, MousePointer2, Redo2, Sparkles, Trash2, Tv, Undo2, X } from 'lucide-react';
import { CHAT_OVERLAY_CANVAS } from '../../../rpc/contracts';
import {
  DEFAULT_SNAP,
  RESIZE_HANDLES,
  clampToCanvas,
  fitScale,
  moveRect,
  nearestAnchor,
  resizeRect,
  screenToCanvas,
  snapRect,
  type Rect,
  type ResizeHandle,
  type SnapGuide,
} from '../../../lib/canvasGeometry';
import { ChatScene } from '../../../overlay/ChatScene';
import type { ChatOverlayPart } from '../../../overlay/ChatMessageCard';
import { useChatOverlayStore, selectVisibleChatMessages } from '../../../store/chatOverlayStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { t } from '../../../i18n/translations';
import { Button } from '../../ui/Button';
import { editSampleMessages } from './sampleMessages';

export type CanvasMode = 'preview' | 'edit';

interface ChatCanvasProps {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  selectedPart: ChatOverlayPart | null;
  onSelectPart: (part: ChatOverlayPart | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

type ZoomSetting = 'fit' | 0.5 | 1;

interface DragState {
  kind: 'move' | 'resize';
  handle: ResizeHandle | null;
  startRect: Rect;
  startPointer: { x: number; y: number };
  altKey: boolean;
}

export function ChatCanvas({
  mode,
  onModeChange,
  selectedPart,
  onSelectPart,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ChatCanvasProps) {
  const store = useChatOverlayStore();
  const settings = store.settings;
  const liveMessages = selectVisibleChatMessages(store);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [zoom, setZoom] = useState<ZoomSetting>('fit');
  const [fit, setFit] = useState(0.35);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [draftRect, setDraftRect] = useState<Rect | null>(null);

  const isEdit = mode === 'edit';
  const scale = zoom === 'fit' ? fit : zoom;

  const messages = useMemo(
    () => (isEdit ? editSampleMessages(lang) : liveMessages),
    [isEdit, lang, liveMessages],
  );

  // Measure the viewport so 'Fit' tracks panel resizes.
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setFit(fitScale({ width: rect.width - 24, height: rect.height - 24 }, CHAT_OVERLAY_CANVAS));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const blockRect: Rect = draftRect ?? {
    x: settings.block.x,
    y: settings.block.y,
    width: settings.block.width,
    height: settings.block.height,
  };

  const commitRect = useCallback(
    (rect: Rect) => {
      const clamped = clampToCanvas(rect, CHAT_OVERLAY_CANVAS);
      void store.updateSettings({
        block: { ...clamped, anchor: nearestAnchor(clamped, CHAT_OVERLAY_CANVAS) },
      });
    },
    [store],
  );

  // Pointer drag is tracked on the window so the gesture survives the cursor
  // leaving the stage, and only commits (one undo entry) on release.
  useEffect(() => {
    if (!isEdit) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const stage = stageRef.current;
      if (!drag || !stage) return;

      const origin = stage.getBoundingClientRect();
      const pointer = screenToCanvas({ x: event.clientX, y: event.clientY }, origin, scale);
      const dx = pointer.x - drag.startPointer.x;
      const dy = pointer.y - drag.startPointer.y;

      const moved =
        drag.kind === 'move'
          ? moveRect(drag.startRect, dx, dy, CHAT_OVERLAY_CANVAS)
          : resizeRect(drag.startRect, drag.handle!, dx, dy, CHAT_OVERLAY_CANVAS);

      // Alt suppresses snapping for pixel-exact placement.
      const snapped =
        drag.kind === 'move'
          ? snapRect(moved, CHAT_OVERLAY_CANVAS, { ...DEFAULT_SNAP, disabled: event.altKey })
          : { rect: moved, guides: [] };

      setDraftRect(snapped.rect);
      setGuides(snapped.guides);
    };

    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setGuides([]);
      if (!drag) return;
      setDraftRect((current) => {
        if (current) commitRect(current);
        return null;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isEdit, scale, commitRect]);

  const startDrag = (kind: 'move' | 'resize', handle: ResizeHandle | null) => (event: React.PointerEvent) => {
    if (!isEdit) return;
    event.preventDefault();
    event.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    const origin = stage.getBoundingClientRect();
    dragRef.current = {
      kind,
      handle,
      startRect: blockRect,
      startPointer: screenToCanvas({ x: event.clientX, y: event.clientY }, origin, scale),
      altKey: event.altKey,
    };
  };

  // Arrow keys nudge the block; Shift makes it a coarse step.
  useEffect(() => {
    if (!isEdit) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if (event.key === 'Escape') {
        onSelectPart(null);
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const move = delta[event.key];
      if (!move) return;
      event.preventDefault();
      commitRect(moveRect(blockRect, move[0], move[1], CHAT_OVERLAY_CANVAS));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isEdit, blockRect, commitRect, onRedo, onUndo, onSelectPart]);

  const loadBackdrop = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBackdrop(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const sendTestMessage = () => {
    const samples = editSampleMessages(lang);
    const pick = samples[Math.floor(Math.random() * samples.length)];
    store.addMessage({
      id: `test-${Date.now()}`,
      username: pick.username,
      userId: pick.userId,
      isBroadcaster: pick.isBroadcaster,
      isMod: pick.isMod,
      isVip: pick.isVip,
      isSubscriber: pick.isSubscriber,
      message: pick.message,
      emotes: pick.emotes,
      color: pick.color,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div className="slab flex h-full flex-col overflow-hidden">
      <style>{canvasChromeStyles}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Tv size={16} className="text-primary" />
          <h2 className="font-display text-base uppercase tracking-[0.04em] text-ink">
            {t(lang, 'chat.preview.title')}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-ink/25">
            <button
              type="button"
              onClick={() => onModeChange('preview')}
              className={modeButtonClass(!isEdit)}
            >
              <Eye size={13} /> {t(lang, 'chat.canvas.preview')}
            </button>
            <button
              type="button"
              onClick={() => onModeChange('edit')}
              className={modeButtonClass(isEdit)}
            >
              <MousePointer2 size={13} /> {t(lang, 'chat.canvas.edit')}
            </button>
          </div>

          <select
            value={String(zoom)}
            onChange={(e) => setZoom(e.target.value === 'fit' ? 'fit' : (Number(e.target.value) as 0.5 | 1))}
            className="h-8 border border-ink/25 bg-surface-2 px-2 font-mono text-xs text-ink"
            aria-label={t(lang, 'chat.canvas.zoom')}
          >
            <option value="fit">{t(lang, 'chat.canvas.zoomFit')}</option>
            <option value="0.5">50%</option>
            <option value="1">100%</option>
          </select>

          {isEdit && (
            <>
              <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} title="Ctrl+Z">
                <Undo2 size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo} title="Ctrl+Shift+Z">
                <Redo2 size={14} />
              </Button>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 border border-ink/25 px-2 font-sans text-xs font-bold uppercase tracking-wider text-ink/80 hover:bg-ink/5">
                <ImageIcon size={13} />
                {t(lang, 'chat.canvas.backdrop')}
                <input type="file" accept="image/*" className="hidden" onChange={loadBackdrop} />
              </label>
              {backdrop && (
                <Button variant="ghost" size="sm" onClick={() => setBackdrop(null)} title={t(lang, 'chat.canvas.backdropClear')}>
                  <X size={14} />
                </Button>
              )}
            </>
          )}

          {!isEdit && (
            <>
              <Button variant="outline" size="sm" onClick={sendTestMessage}>
                <Sparkles size={14} /> {t(lang, 'chat.preview.test')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => store.clearMessages()}>
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative flex-1 overflow-auto bg-[radial-gradient(#8a4f1d15_1px,transparent_1px)] [background-size:16px_16px] p-3"
        onClick={() => isEdit && onSelectPart(null)}
      >
        <div
          ref={stageRef}
          className="co-stage relative"
          style={{
            width: CHAT_OVERLAY_CANVAS.width * scale,
            height: CHAT_OVERLAY_CANVAS.height * scale,
          }}
        >
          <div
            className="co-stage-inner"
            style={{
              width: CHAT_OVERLAY_CANVAS.width,
              height: CHAT_OVERLAY_CANVAS.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {backdrop ? (
              <img className="co-backdrop" src={backdrop} alt="" />
            ) : (
              <div className="co-checker" />
            )}

            <ChatScene
              settings={settings}
              messages={messages}
              lang={lang}
              alwaysRenderBlock={isEdit}
              selectedPart={isEdit ? selectedPart : null}
              onSelectPart={isEdit ? (part) => onSelectPart(part) : undefined}
              overlayChrome={
                isEdit ? (
                  <BlockFrame
                    rect={blockRect}
                    guides={guides}
                    onStartMove={startDrag('move', null)}
                    onStartResize={(handle) => startDrag('resize', handle)}
                  />
                ) : null
              }
            />
          </div>
        </div>
      </div>

      <div className="border-t border-ink/15 px-5 py-2 font-mono text-[11px] text-ink/55">
        {isEdit
          ? `${Math.round(blockRect.x)}, ${Math.round(blockRect.y)}  ·  ${Math.round(blockRect.width)} × ${Math.round(blockRect.height)}  ·  ${t(lang, 'chat.canvas.hint')}`
          : t(lang, 'chat.canvas.previewHint')}
      </div>
    </div>
  );
}

interface BlockFrameProps {
  rect: Rect;
  guides: SnapGuide[];
  onStartMove: (event: React.PointerEvent) => void;
  onStartResize: (handle: ResizeHandle) => (event: React.PointerEvent) => void;
}

function BlockFrame({ rect, guides, onStartMove, onStartResize }: BlockFrameProps) {
  return (
    <>
      {guides.map((guide, index) => (
        <div
          key={`${guide.axis}-${guide.position}-${index}`}
          className="co-guide"
          style={
            guide.axis === 'x'
              ? { left: guide.position, top: 0, width: 2, height: '100%' }
              : { top: guide.position, left: 0, height: 2, width: '100%' }
          }
        />
      ))}
      <div
        className="co-frame"
        style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        onPointerDown={onStartMove}
      >
        {RESIZE_HANDLES.map((handle) => (
          <span
            key={handle}
            className={`co-handle co-handle--${handle}`}
            onPointerDown={onStartResize(handle)}
          />
        ))}
      </div>
    </>
  );
}

function modeButtonClass(active: boolean): string {
  return [
    'inline-flex h-8 items-center gap-1.5 px-2.5 font-sans text-xs font-bold uppercase tracking-wider transition-colors',
    active ? 'bg-primary text-on-primary' : 'bg-transparent text-ink/70 hover:bg-ink/5',
  ].join(' ');
}

/*
 * Editor chrome only. None of this is part of the overlay itself, which is why
 * it lives here rather than in overlay.css.
 */
const canvasChromeStyles = `
  .co-stage-inner { position: relative; }
  .co-checker {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(45deg, #00000014 25%, transparent 25%),
      linear-gradient(-45deg, #00000014 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #00000014 75%),
      linear-gradient(-45deg, transparent 75%, #00000014 75%);
    background-size: 40px 40px;
    background-position: 0 0, 0 20px, 20px -20px, -20px 0px;
  }
  .co-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .co-frame {
    position: absolute;
    outline: 2px solid var(--primary, #8b5cf6);
    outline-offset: 0;
    cursor: move;
    z-index: 20;
  }
  .co-guide {
    position: absolute;
    background: #22d3ee;
    z-index: 30;
    pointer-events: none;
  }
  .co-handle {
    position: absolute;
    width: 14px;
    height: 14px;
    background: #fff;
    border: 2px solid var(--primary, #8b5cf6);
  }
  .co-handle--nw { left: -7px; top: -7px; cursor: nwse-resize; }
  .co-handle--n  { left: calc(50% - 7px); top: -7px; cursor: ns-resize; }
  .co-handle--ne { right: -7px; top: -7px; cursor: nesw-resize; }
  .co-handle--e  { right: -7px; top: calc(50% - 7px); cursor: ew-resize; }
  .co-handle--se { right: -7px; bottom: -7px; cursor: nwse-resize; }
  .co-handle--s  { left: calc(50% - 7px); bottom: -7px; cursor: ns-resize; }
  .co-handle--sw { left: -7px; bottom: -7px; cursor: nesw-resize; }
  .co-handle--w  { left: -7px; top: calc(50% - 7px); cursor: ew-resize; }

  [data-part] { cursor: pointer; }
  [data-selected='true'] {
    outline: 2px dashed #22d3ee;
    outline-offset: 2px;
  }
`;
