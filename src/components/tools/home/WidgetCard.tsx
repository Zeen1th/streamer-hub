import { useState, type DragEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, GripVertical, X } from 'lucide-react';
import { WIDGET_SIZES, widgetMeta, type WidgetId, type WidgetSize } from '../../../lib/homeLayout';
import { cn } from '../../../lib/cn';
import { useHomeText } from './homeText';

/** Literal class names so Tailwind can see them. Narrow windows stack everything. */
const SPAN: Record<WidgetSize, string> = {
  4: 'col-span-12 md:col-span-6 xl:col-span-4',
  6: 'col-span-12 lg:col-span-6',
  8: 'col-span-12 xl:col-span-8',
  12: 'col-span-12',
};

/** Layout controls HomeView hands to every widget so it can render inside its own card. */
export interface WidgetChrome {
  size: WidgetSize;
  editing: boolean;
  isFirst: boolean;
  isLast: boolean;
  onResize: (size: WidgetSize) => void;
  onNudge: (direction: -1 | 1) => void;
  onRemove: () => void;
  onDropOn: (draggedId: WidgetId) => void;
}

/** What every widget component receives. */
export interface WidgetProps {
  chrome: WidgetChrome;
  config: Record<string, string>;
  setConfig: (patch: Record<string, string>) => void;
}

interface WidgetCardProps extends WidgetChrome {
  id: WidgetId;
  title: string;
  icon: ReactNode;
  /** Extra header controls (tabs, selects). Hidden while editing the layout. */
  actions?: ReactNode;
  children: ReactNode;
}

export function WidgetCard({ id, title, icon, size, editing, isFirst, isLast, onResize, onNudge, onRemove, onDropOn, actions, children }: WidgetCardProps) {
  const { h } = useHomeText();
  const [over, setOver] = useState(false);
  const sizes = widgetMeta(id).sizes;

  const dragProps = editing
    ? {
        draggable: true,
        onDragStart: (e: DragEvent) => {
          e.dataTransfer.setData('text/x-home-widget', id);
          e.dataTransfer.effectAllowed = 'move';
        },
        onDragOver: (e: DragEvent) => {
          if (!e.dataTransfer.types.includes('text/x-home-widget')) return;
          e.preventDefault();
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setOver(false);
          const dragged = e.dataTransfer.getData('text/x-home-widget') as WidgetId;
          if (dragged && dragged !== id) onDropOn(dragged);
        },
      }
    : {};

  return (
    <section
      className={cn(
        'relative flex min-h-[150px] min-w-0 flex-col rounded-[10px] border bg-[#2e3438] p-4 transition-[border-color,box-shadow] duration-150',
        SPAN[size],
        editing ? 'cursor-grab border-dashed border-[#6366f1]/45 active:cursor-grabbing' : 'border-white/[0.08] hover:border-white/[0.14]',
        over && 'border-[#6366f1] shadow-[0_0_0_2px_rgba(99,102,241,0.35)]',
      )}
      aria-label={title}
      {...dragProps}
    >
      <header className="mb-3 flex min-h-[28px] items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {editing && <GripVertical size={15} className="shrink-0 text-[#9aa3af]" aria-hidden />}
          <span className="grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-white/[0.06] text-[#cbd3e6]">{icon}</span>
          <h3 className="truncate font-sans text-[13px] font-bold text-white">{title}</h3>
        </div>
        {!editing && actions}
      </header>

      {editing && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[7px] border border-white/[0.08] bg-[#1a2228] p-1.5" onPointerDown={(e) => e.stopPropagation()}>
          <span className="ps-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#9aa3af]">{h('edit.width')}</span>
          <div className="flex gap-1">
            {WIDGET_SIZES.filter((s) => sizes.includes(s)).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onResize(s)}
                aria-pressed={size === s}
                className={cn(
                  'h-[22px] min-w-[30px] rounded-[5px] px-1.5 text-[11px] font-semibold',
                  size === s ? 'bg-[#6366f1] text-white' : 'bg-white/[0.05] text-[#9aa3af] hover:bg-white/[0.1] hover:text-white',
                )}
              >
                {h(`size.${s}` as const)}
              </button>
            ))}
          </div>
          <div className="ms-auto flex items-center gap-1">
            <button type="button" disabled={isFirst} onClick={() => onNudge(-1)} title={h('edit.moveEarlier')} aria-label={h('edit.moveEarlier')} className="grid size-[22px] place-items-center rounded-[5px] text-[#9aa3af] hover:bg-white/[0.1] hover:text-white disabled:opacity-30">
              <ArrowLeft size={13} />
            </button>
            <button type="button" disabled={isLast} onClick={() => onNudge(1)} title={h('edit.moveLater')} aria-label={h('edit.moveLater')} className="grid size-[22px] place-items-center rounded-[5px] text-[#9aa3af] hover:bg-white/[0.1] hover:text-white disabled:opacity-30">
              <ArrowRight size={13} />
            </button>
            <button type="button" onClick={onRemove} title={h('edit.remove')} aria-label={h('edit.remove')} className="grid size-[22px] place-items-center rounded-[5px] text-rose-300 hover:bg-rose-500/20">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div className={cn('flex min-h-0 flex-1 flex-col', editing && 'pointer-events-none select-none opacity-60')}>{children}</div>
    </section>
  );
}
