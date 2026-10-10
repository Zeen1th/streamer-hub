import { useState } from 'react';
import { Check, ListChecks, Plus, RotateCcw, X } from 'lucide-react';
import { useHomeLayoutStore } from '../../../../store/homeLayoutStore';
import { Input } from '../../../ui/Input';
import { cn } from '../../../../lib/cn';
import { useHomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

export function ChecklistWidget({ chrome }: WidgetProps) {
  const { h } = useHomeText();
  const items = useHomeLayoutStore((s) => s.checklist);
  const add = useHomeLayoutStore((s) => s.addChecklistItem);
  const toggle = useHomeLayoutStore((s) => s.toggleChecklistItem);
  const remove = useHomeLayoutStore((s) => s.removeChecklistItem);
  const reset = useHomeLayoutStore((s) => s.resetChecklist);
  const [draft, setDraft] = useState('');

  const done = items.filter((i) => i.done).length;
  const complete = items.length > 0 && done === items.length;

  const submit = () => {
    add(draft);
    setDraft('');
  };

  return (
    <WidgetCard
      id="checklist"
      title={h('w.checklist')}
      icon={<ListChecks size={15} className="text-emerald-300" />}
      {...chrome}
      actions={
        <button type="button" onClick={reset} disabled={done === 0} className="flex h-[24px] items-center gap-1 rounded-[6px] px-2 text-[11px] text-[#9aa3af] hover:bg-white/[0.08] hover:text-white disabled:opacity-35">
          <RotateCcw size={12} /> {h('check.reset')}
        </button>
      }
    >
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className={cn('font-medium', complete ? 'text-emerald-300' : 'text-[#9aa3af]')}>{complete ? h('check.allDone') : h('check.progress', { a: done, b: items.length })}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <div className={cn('h-full rounded-full transition-[width] duration-300', complete ? 'bg-emerald-400' : 'bg-[#6366f1]')} style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
      </div>

      <ul className="-me-1 max-h-[200px] space-y-1 overflow-y-auto pe-1">
        {items.length === 0 && <li className="py-3 text-center text-[12px] text-[#9aa3af]">{h('check.empty')}</li>}
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2.5 rounded-[8px] px-1.5 py-1 hover:bg-white/[0.04]">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              onClick={() => toggle(item.id)}
              className={cn('grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors', item.done ? 'border-emerald-400 bg-emerald-400 text-emerald-950' : 'border-white/[0.25] hover:border-white/[0.5]')}
            >
              {item.done && <Check size={12} strokeWidth={3} />}
            </button>
            <span className={cn('min-w-0 flex-1 truncate text-[12.5px]', item.done ? 'text-[#9aa3af] line-through' : 'text-white')} dir="auto">
              {item.text}
            </span>
            <button type="button" onClick={() => remove(item.id)} aria-label={h('check.remove')} title={h('check.remove')} className="grid size-[20px] place-items-center rounded-[5px] text-[#9aa3af] opacity-0 hover:bg-white/[0.1] hover:text-white focus:opacity-100 group-hover:opacity-100">
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center gap-1.5 pt-3">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder={h('check.placeholder')} className="h-[30px]" dir="auto" />
        <button type="button" onClick={submit} disabled={!draft.trim()} className="flex h-[30px] shrink-0 items-center gap-1 rounded-[6px] bg-white/[0.08] px-2.5 text-[11.5px] font-medium text-white hover:bg-white/[0.14] disabled:opacity-35">
          <Plus size={13} /> {h('check.add')}
        </button>
      </div>
    </WidgetCard>
  );
}
