import { AlertTriangle, Keyboard, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { chordConflict, chordFromKeyboardEvent, keybindActionsForTarget } from '../../../lib/keybinds';
import type { ActionKeybind, KeybindAction, KeybindChord, KeybindTargetType } from '../../../rpc/contracts';
import { useKeybindStore } from '../../../store/keybindStore';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';

interface Props {
  lang: 'en' | 'ar';
  targetType: KeybindTargetType;
  targetId: string;
}

const keyLabel = (key: string) => key.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Numpad ').replace('Arrow', '');
const chordLabel = (chord: KeybindChord) => [chord.modifier?.toUpperCase(), keyLabel(chord.key)].filter(Boolean).join(' + ');

export function FeatureKeybindEditor({ lang, targetType, targetId }: Props) {
  const bindings = useKeybindStore((state) => state.bindings);
  const registrations = useKeybindStore((state) => state.registrations);
  const saving = useKeybindStore((state) => state.saving);
  const save = useKeybindStore((state) => state.save);
  const remove = useKeybindStore((state) => state.remove);
  const [action, setAction] = useState<KeybindAction>('increase');
  const [chord, setChord] = useState<KeybindChord | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captureRef = useRef<HTMLButtonElement>(null);
  const targetBindings = bindings.filter((binding) => binding.targetType === targetType && binding.targetId === targetId);
  const statusById = useMemo(() => new Map(registrations.map((item) => [item.bindingId, item])), [registrations]);
  const actions = keybindActionsForTarget(targetType);

  useEffect(() => { if (capturing) captureRef.current?.focus(); }, [capturing]);

  const text = lang === 'ar' ? {
    title: 'اختصارات عامة', hint: 'أضف اختصاراً لهذا العنصر وسيعمل حتى عند تصغير التطبيق.', action: 'الإجراء', key: 'الاختصار', capture: 'اضغط الاختصار', listening: 'بانتظار مفتاح أو مفتاحين…', add: 'إضافة', increase: 'زيادة', decrease: 'إنقاص', reset: 'إعادة ضبط', apply: 'تطبيق العنوان', conflict: 'هذا الاختصار مستخدم بالفعل.', invalid: 'استخدم مفتاحاً واحداً، أو مفتاح تعديل مع مفتاح آخر.', warning: 'المفاتيح العادية قد تعمل أثناء الكتابة.', empty: 'لا توجد اختصارات لهذا العنصر.', active: 'يعمل عالمياً', disabled: 'متوقف', unavailable: 'تعذر التسجيل', delete: 'حذف',
  } : {
    title: 'Global keybinds', hint: 'Add a shortcut for this item. It works even while the app is minimized.', action: 'Action', key: 'Keybind', capture: 'Press keybind', listening: 'Waiting for one or two keys…', add: 'Add', increase: 'Increase', decrease: 'Decrease', reset: 'Reset', apply: 'Apply title', conflict: 'That keybind is already assigned.', invalid: 'Use one key, or one modifier together with another key.', warning: 'Normal keys may trigger while you are typing.', empty: 'No keybinds for this item.', active: 'Global and active', disabled: 'Disabled', unavailable: 'Could not register', delete: 'Delete',
  };

  const add = async () => {
    if (!chord) return;
    if (chordConflict(chord, bindings)) { setError(text.conflict); return; }
    const binding: ActionKeybind = { id: crypto.randomUUID(), enabled: true, targetType, targetId, action, chord };
    await save([...bindings, binding]);
    setChord(null);
    setError(null);
  };

  return <div className="border border-ink/15 bg-surface px-4 py-4">
    <div className="flex items-start gap-3">
      <Keyboard size={17} className="mt-0.5 shrink-0 text-primary" />
      <div><div className="font-display text-base uppercase tracking-[0.04em] text-ink">{text.title}</div><p className="mt-1 font-sans text-xs leading-relaxed text-ink/60">{text.hint}</p></div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[0.8fr_1fr_auto] sm:items-end">
      <label className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-ink/65">{text.action}
        <select className="mt-2 h-10 w-full border border-ink/25 bg-surface-2 px-3 text-sm text-ink outline-none focus:border-primary" value={action} onChange={(event) => setAction(event.target.value as KeybindAction)}>
          {actions.map((item) => <option key={item} value={item}>{text[item]}</option>)}
        </select>
      </label>
      <div><div className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-ink/65">{text.key}</div>
        <button ref={captureRef} type="button" className={`mt-2 h-10 w-full border px-3 font-mono text-xs font-bold outline-none ${capturing ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-ink/25 bg-surface-2 text-ink hover:border-primary/70'}`} onClick={() => { setCapturing(true); setError(null); }} onBlur={() => setCapturing(false)} onKeyDown={(event) => {
          event.preventDefault(); event.stopPropagation();
          if (event.code === 'Escape') { setCapturing(false); return; }
          const next = chordFromKeyboardEvent(event.nativeEvent);
          if (!next) { setError(text.invalid); return; }
          if (chordConflict(next, bindings)) { setError(text.conflict); return; }
          setChord(next); setCapturing(false); setError(null);
        }}>{capturing ? text.listening : chord ? chordLabel(chord) : text.capture}</button>
      </div>
      <Button onClick={add} disabled={!chord || saving}><Plus size={14} />{text.add}</Button>
    </div>
    {(error || (chord && !chord.modifier && /^(Key|Digit)/.test(chord.key))) && <div className={`mt-3 flex items-center gap-2 text-xs ${error ? 'text-danger' : 'text-amber-700 dark:text-amber-300'}`}><AlertTriangle size={14} />{error ?? text.warning}</div>}
    <div className="mt-4 space-y-2">
      {!targetBindings.length && <div className="border border-dashed border-ink/20 px-3 py-4 text-center font-sans text-xs text-ink/50">{text.empty}</div>}
      {targetBindings.map((binding) => {
        const registration = statusById.get(binding.id);
        const healthy = registration?.status === 'registered';
        return <div key={binding.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border border-ink/15 bg-surface-2 px-3 py-2.5">
          <Switch checked={binding.enabled} onChange={(enabled) => void save(bindings.map((item) => item.id === binding.id ? { ...item, enabled } : item))} label={text[binding.action]} />
          <div className="min-w-0"><div className="truncate font-sans text-xs font-bold text-ink">{text[binding.action]}</div><div className={`mt-0.5 text-[10px] ${healthy ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{healthy ? text.active : registration?.status === 'disabled' ? text.disabled : registration?.error ?? text.unavailable}</div></div>
          <kbd className="border border-ink/25 bg-surface px-2.5 py-1.5 font-mono text-[11px] font-bold text-ink">{chordLabel(binding.chord)}</kbd>
          <button type="button" className="grid size-8 place-items-center border border-ink/20 text-ink/55 hover:border-danger hover:bg-danger/10 hover:text-danger" title={text.delete} aria-label={text.delete} onClick={() => void remove(binding.id)}><Trash2 size={14} /></button>
        </div>;
      })}
    </div>
  </div>;
}
