import { AlertTriangle, CheckCircle2, Keyboard, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { bindingAvailability, chordConflict, chordFromKeyboardEvent } from '../../../lib/keybinds';
import type { ActionKeybind, KeybindAction, KeybindChord, KeybindTargetType } from '../../../rpc/contracts';
import { useAutoReplyStore } from '../../../store/autoReplyStore';
import { useCounterStore } from '../../../store/counterStore';
import { useKeybindStore } from '../../../store/keybindStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Switch } from '../../ui/Switch';

interface Props { lang: 'en' | 'ar' }

const keyLabel = (key: string) => key
  .replace(/^Key/, '')
  .replace(/^Digit/, '')
  .replace(/^Numpad/, 'Numpad ')
  .replace('Arrow', '');

const chordLabel = (chord: KeybindChord) => [chord.modifier?.toUpperCase(), keyLabel(chord.key)].filter(Boolean).join(' + ');

export function KeybindSettings({ lang }: Props) {
  const counters = useCounterStore((state) => state.counters);
  const titleRules = useAutoReplyStore((state) => state.rules).filter((rule) => rule.titleActionEnabled && rule.titleTemplate?.trim());
  const bindings = useKeybindStore((state) => state.bindings);
  const registrations = useKeybindStore((state) => state.registrations);
  const saving = useKeybindStore((state) => state.saving);
  const save = useKeybindStore((state) => state.save);
  const remove = useKeybindStore((state) => state.remove);
  const [targetType, setTargetType] = useState<KeybindTargetType>('counter');
  const [targetId, setTargetId] = useState(counters[0]?.id ?? '');
  const [action, setAction] = useState<KeybindAction>('increase');
  const [chord, setChord] = useState<KeybindChord | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captureRef = useRef<HTMLButtonElement>(null);

  const targets = targetType === 'counter' ? counters : titleRules;
  useEffect(() => {
    if (!targets.some((target) => target.id === targetId)) setTargetId(targets[0]?.id ?? '');
  }, [targetId, targets]);
  useEffect(() => { if (capturing) captureRef.current?.focus(); }, [capturing]);

  const statusById = useMemo(() => new Map(registrations.map((item) => [item.bindingId, item])), [registrations]);
  const text = lang === 'ar' ? {
    title: 'اختصارات البث العامة', hint: 'تحكم بالعدادات وعنوان البث حتى عند تصغير التطبيق.', type: 'نوع الإجراء', counter: 'عداد', streamTitle: 'عنوان البث', target: 'الهدف', action: 'الإجراء', key: 'الاختصار', capture: 'اضغط الاختصار', listening: 'بانتظار مفتاح أو مفتاحين…', add: 'إضافة الاختصار', empty: 'لا توجد اختصارات بعد.', increase: 'زيادة', decrease: 'إنقاص', reset: 'إعادة ضبط', apply: 'تطبيق العنوان', conflict: 'هذا الاختصار مستخدم بالفعل.', invalid: 'استخدم مفتاحاً واحداً، أو مفتاح تعديل مع مفتاح آخر.', normalWarning: 'المفاتيح العادية قد تعمل أثناء الكتابة.', registered: 'يعمل عالمياً', disabled: 'متوقف', orphaned: 'الهدف لم يعد موجوداً', unavailable: 'تعذر تسجيل الاختصار', delete: 'حذف', noTargets: 'أنشئ هدفاً مناسباً أولاً.',
  } : {
    title: 'Global stream keybinds', hint: 'Control counters and stream titles even while the app is minimized.', type: 'Action type', counter: 'Counter', streamTitle: 'Stream title', target: 'Target', action: 'Action', key: 'Keybind', capture: 'Press keybind', listening: 'Waiting for one or two keys…', add: 'Add keybind', empty: 'No keybinds yet.', increase: 'Increase', decrease: 'Decrease', reset: 'Reset', apply: 'Apply title', conflict: 'That keybind is already assigned.', invalid: 'Use one key, or one modifier together with another key.', normalWarning: 'Normal keys may trigger while you are typing.', registered: 'Global and active', disabled: 'Disabled', orphaned: 'Target no longer exists', unavailable: 'Could not register', delete: 'Delete', noTargets: 'Create a matching target first.',
  };

  const actionLabel = (value: KeybindAction) => text[value];
  const targetName = (binding: ActionKeybind) => binding.targetType === 'counter'
    ? counters.find((counter) => counter.id === binding.targetId)?.name
    : (() => {
        const rule = titleRules.find((item) => item.id === binding.targetId);
        return rule?.titleTemplate?.trim() || rule?.triggers?.find(Boolean) || (lang === 'ar' ? 'إعداد عنوان' : 'Title setup');
      })();

  const addBinding = async () => {
    if (!targetId || !chord) { setError(text.noTargets); return; }
    if (chordConflict(chord, bindings)) { setError(text.conflict); return; }
    const binding: ActionKeybind = { id: crypto.randomUUID(), enabled: true, targetType, targetId, action, chord };
    await save([...bindings, binding]);
    setChord(null);
    setError(null);
  };

  return <Card title={<div className="flex items-center gap-2"><Keyboard size={17} className="text-primary" />{text.title}</div>}>
    <p className="font-sans text-xs leading-relaxed text-ink/65">{text.hint}</p>
    <div className="mt-5 grid gap-3 border border-ink/15 bg-surface-2 p-4 lg:grid-cols-[0.8fr_1.2fr_0.8fr_1fr_auto] lg:items-end">
      <label className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-ink/65">{text.type}
        <select className="mt-2 h-10 w-full border border-ink/25 bg-surface px-3 text-sm text-ink outline-none focus:border-primary" value={targetType} onChange={(event) => { const next = event.target.value as KeybindTargetType; setTargetType(next); setAction('increase'); setTargetId(''); }}>
          <option value="counter">{text.counter}</option><option value="title">{text.streamTitle}</option>
        </select>
      </label>
      <label className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-ink/65">{text.target}
        <select className="mt-2 h-10 w-full border border-ink/25 bg-surface px-3 text-sm text-ink outline-none focus:border-primary" value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={!targets.length}>
          {!targets.length && <option value="">{text.noTargets}</option>}
          {targetType === 'counter' ? counters.map((target) => <option key={target.id} value={target.id}>{target.name}</option>) : titleRules.map((target) => <option key={target.id} value={target.id}>{target.titleTemplate?.trim() || target.triggers?.find(Boolean) || text.streamTitle}</option>)}
        </select>
      </label>
      <label className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-ink/65">{text.action}
        <select className="mt-2 h-10 w-full border border-ink/25 bg-surface px-3 text-sm text-ink outline-none focus:border-primary" value={action} onChange={(event) => setAction(event.target.value as KeybindAction)}>
          <option value="increase">{text.increase}</option><option value="decrease">{text.decrease}</option><option value="reset">{text.reset}</option>{targetType === 'title' && <option value="apply">{text.apply}</option>}
        </select>
      </label>
      <div><div className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-ink/65">{text.key}</div>
        <button ref={captureRef} type="button" className={`mt-2 h-10 w-full border px-3 font-mono text-xs font-bold outline-none ${capturing ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-ink/25 bg-surface text-ink hover:border-primary/70'}`} onClick={() => { setCapturing(true); setError(null); }} onBlur={() => setCapturing(false)} onKeyDown={(event) => {
          event.preventDefault(); event.stopPropagation();
          if (event.code === 'Escape') { setCapturing(false); return; }
          const next = chordFromKeyboardEvent(event.nativeEvent);
          if (!next) { setError(text.invalid); return; }
          if (chordConflict(next, bindings)) { setError(text.conflict); return; }
          setChord(next); setCapturing(false); setError(null);
        }}>{capturing ? text.listening : chord ? chordLabel(chord) : text.capture}</button>
      </div>
      <Button onClick={addBinding} disabled={!targetId || !chord || saving}><Plus size={14} />{text.add}</Button>
      {(error || (chord && !chord.modifier && /^(Key|Digit)/.test(chord.key))) && <div className={`lg:col-span-5 flex items-center gap-2 text-xs ${error ? 'text-danger' : 'text-amber-700 dark:text-amber-300'}`}><AlertTriangle size={14} />{error ?? text.normalWarning}</div>}
    </div>

    <div className="mt-4 space-y-2">
      {!bindings.length && <div className="border border-dashed border-ink/20 px-4 py-8 text-center font-sans text-xs text-ink/50">{text.empty}</div>}
      {bindings.map((binding) => {
        const registration = statusById.get(binding.id);
        const availability = bindingAvailability(binding, counters, titleRules);
        const status = availability === 'orphaned' ? 'orphaned' : registration?.status ?? 'unsupported';
        const healthy = status === 'registered';
        return <div key={binding.id} className="grid gap-3 border border-ink/15 bg-surface px-4 py-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center">
          <Switch checked={binding.enabled} onChange={(enabled) => void save(bindings.map((item) => item.id === binding.id ? { ...item, enabled } : item))} label={targetName(binding) ?? text.orphaned} />
          <div className="min-w-0"><div className="truncate font-sans text-sm font-bold text-ink">{targetName(binding) ?? text.orphaned} · {actionLabel(binding.action)}</div><div className={`mt-1 flex items-center gap-1.5 font-sans text-[11px] ${healthy ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{healthy ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}{status === 'registered' ? text.registered : status === 'disabled' ? text.disabled : status === 'orphaned' ? text.orphaned : registration?.error ?? text.unavailable}</div></div>
          <kbd className="border border-ink/25 bg-surface-2 px-3 py-2 font-mono text-xs font-bold text-ink shadow-sm">{chordLabel(binding.chord)}</kbd>
          <button type="button" className="grid size-9 place-items-center border border-ink/20 text-ink/55 hover:border-danger hover:bg-danger/10 hover:text-danger" title={text.delete} onClick={() => void remove(binding.id)}><Trash2 size={15} /></button>
        </div>;
      })}
    </div>
  </Card>;
}
