import type { PointerEvent } from 'react';
import { rpc } from '../../rpc';
import { Channels, type WindowResizeEdge } from '../../rpc/contracts';
import { useConnectionStore } from '../../store/connectionStore';

const HANDLES: ReadonlyArray<{ edge: WindowResizeEdge; className: string }> = [
  { edge: 'top', className: 'left-2 right-2 top-0 h-[6px] cursor-n-resize' },
  { edge: 'right', className: 'bottom-2 right-0 top-2 w-[6px] cursor-e-resize' },
  { edge: 'bottom', className: 'bottom-0 left-2 right-2 h-[6px] cursor-s-resize' },
  { edge: 'left', className: 'bottom-2 left-0 top-2 w-[6px] cursor-w-resize' },
  { edge: 'top-left', className: 'left-0 top-0 size-2 cursor-nw-resize' },
  { edge: 'top-right', className: 'right-0 top-0 size-2 cursor-ne-resize' },
  { edge: 'bottom-right', className: 'bottom-0 right-0 size-2 cursor-se-resize' },
  { edge: 'bottom-left', className: 'bottom-0 left-0 size-2 cursor-sw-resize' },
];

function beginResize(edge: WindowResizeEdge, event: PointerEvent<HTMLDivElement>) {
  if (event.button !== 0) return;
  rpc.invoke(Channels.WindowBeginResize, { edge }).catch(() => undefined);
}

export function WindowResizeHandles() {
  const isMaximized = useConnectionStore((state) => state.isMaximized);
  if (isMaximized) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" aria-hidden="true">
      {HANDLES.map(({ edge, className }) => (
        <div
          key={edge}
          data-window-resize={edge}
          className={`pointer-events-auto absolute ${className}`}
          onPointerDown={(event) => beginResize(edge, event)}
        />
      ))}
    </div>
  );
}
