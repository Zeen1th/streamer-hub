import { AlertTriangle, CheckCircle2, Keyboard, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { bindingAvailability } from '../../../lib/keybinds';
import type { ActionKeybind, KeybindAction, KeybindChord } from '../../../rpc/contracts';
import { useAutoReplyStore } from '../../../store/autoReplyStore';
import { useCounterStore } from '../../../store/counterStore';
import { useKeybindStore } from '../../../store/keybindStore';
import { Card } from '../../ui/Card';
import { Switch } from '../../ui/Switch';

interface Props { lang: 'en' | 'ar' }

const keyLabel = (key: string) => key.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Numpad ').replace('Arrow', '');
const chordLabel = (chord: KeybindChord) => [chord.modifier?.toUpperCase(), keyLabel(chord.key)].filter(Boolean).join(' + ');

export function KeybindSettings({ lang }: Props) {
  const counters = useCounterStore((state) => state.counters);
  const titleRules = useAutoReplyStore((state) => state.rules).filter((rule) => rule.titleActionEnabled && rule.titleTemplate?.trim());
  const bindings = useKeybindStore((state) => state.bindings);
  const registrations = useKeybindStore((state) => state.registrations);
  const save = useKeybindStore((state) => state.save);
  const remove = useKeybindStore((state) => state.remove);
  const statusById = useMemo(() => new Map(registrations.map((item) => [item.bindingId, item])), [registrations]);

  const text = lang === 'ar' ? {
    title: 'كل الاختصارات العامة', hint: 'راجع وأدر جميع الاختصارات هنا. أضف اختصاراً جديداً من إعدادات العداد أو إعداد عنوان البث.', empty: 'لا توجد اختصارات بعد. افتح عداداً أو إعداد عنوان بث لإضافة أول اختصار.', increase: 'زيادة', decrease: 'إنقاص', reset: 'إعادة ضبط', apply: 'تطبيق العنوان', active: 'يعمل عالمياً', disabled: 'متوقف', orphaned: 'الهدف لم يعد موجوداً', unavailable: 'تعذر التسجيل', delete: 'حذف',
  } : {
    title: 'All global keybinds', hint: 'Review and manage every shortcut here. Add new keybinds from a counter or stream-title setup.', empty: 'No keybinds yet. Open a counter or title setup to add the first one.', increase: 'Increase', decrease: 'Decrease', reset: 'Reset', apply: 'Apply title', active: 'Global and active', disabled: 'Disabled', orphaned: 'Target no longer exists', unavailable: 'Could not register', delete: 'Delete',
  };

  const actionLabel = (action: KeybindAction) => text[action];
  const targetName = (binding: ActionKeybind) => binding.targetType === 'counter'
    ? counters.find((counter) => counter.id === binding.targetId)?.name
    : (() => {
        const rule = titleRules.find((item) => item.id === binding.targetId);
        return rule?.titleTemplate?.trim() || rule?.triggers?.find(Boolean);
      })();

  return <Card title={<div className="flex items-center gap-2"><Keyboard size={17} className="text-primary" />{text.title}</div>}>
    <p className="font-sans text-xs leading-relaxed text-ink/65">{text.hint}</p>
    <div className="mt-5 space-y-2">
      {!bindings.length && <div className="border border-dashed border-ink/20 px-4 py-10 text-center font-sans text-xs leading-relaxed text-ink/50">{text.empty}</div>}
      {bindings.map((binding) => {
        const registration = statusById.get(binding.id);
        const availability = bindingAvailability(binding, counters, titleRules);
        const status = availability === 'orphaned' ? 'orphaned' : registration?.status ?? 'unsupported';
        const healthy = status === 'registered';
        return <div key={binding.id} className="grid gap-3 border border-rule bg-surface px-4 py-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center">
          <Switch checked={binding.enabled} onChange={(enabled) => void save(bindings.map((item) => item.id === binding.id ? { ...item, enabled } : item))} label={targetName(binding) ?? text.orphaned} />
          <div className="min-w-0"><div className="truncate font-sans text-sm font-bold text-ink">{targetName(binding) ?? text.orphaned} · {actionLabel(binding.action)}</div><div className={`mt-1 flex items-center gap-1.5 font-sans text-[11px] ${healthy ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{healthy ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}{status === 'registered' ? text.active : status === 'disabled' ? text.disabled : status === 'orphaned' ? text.orphaned : registration?.error ?? text.unavailable}</div></div>
          <kbd className="border border-ink/25 bg-surface-2 px-3 py-2 font-mono text-xs font-bold text-ink">{chordLabel(binding.chord)}</kbd>
          <button type="button" className="grid size-9 place-items-center border border-ink/20 text-ink/55 hover:border-danger hover:bg-danger/10 hover:text-danger" title={text.delete} aria-label={text.delete} onClick={() => void remove(binding.id)}><Trash2 size={15} /></button>
        </div>;
      })}
    </div>
  </Card>;
}
