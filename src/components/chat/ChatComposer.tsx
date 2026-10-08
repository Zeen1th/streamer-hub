import { Send, Smile } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { applySuggestion, computeAssist, type Suggestion } from '../../lib/chatInputAssist';

export interface ComposerNotice {
  message: string;
  ok: boolean;
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  /** Viewer names for @ and /command name suggestions. */
  users: readonly string[];
  /** Emote name -> image url, for ":kek" suggestions and the picker. */
  emotes: Readonly<Record<string, string>>;
  lang: 'en' | 'ar';
  disabled?: boolean;
  /** Result of the last slash command; shown briefly above the box. */
  notice?: ComposerNotice | null;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Compact = the small OBS dock; otherwise the roomier in-app Chat tab. */
  compact?: boolean;
  sendLabel?: string;
  leading?: React.ReactNode;
}

const T = {
  en: { emotes: 'Emotes', search: 'Search emotes', none: 'No emotes loaded yet', send: 'Send' },
  ar: { emotes: 'الإيموجي', search: 'ابحث عن إيموجي', none: 'لم تُحمَّل إيموجيات بعد', send: 'إرسال' },
};

/** Chat box with slash-command help, @name and :emote suggestions, and an emote picker. */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  users,
  emotes,
  lang,
  disabled,
  notice,
  inputRef,
  compact,
  sendLabel,
  leading,
}: ChatComposerProps) {
  const fallbackRef = useRef<HTMLInputElement | null>(null);
  const ref = inputRef ?? fallbackRef;
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const text = T[lang];

  const assist = useMemo(
    () => (dismissedFor === value ? null : computeAssist(value, { users, emotes, lang }, caret)),
    [value, users, emotes, lang, caret, dismissedFor],
  );
  const suggestions = assist?.suggestions ?? [];

  useEffect(() => setActive(0), [value]);

  const focusAt = (position: number) => {
    window.requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(position, position);
      setCaret(position);
    });
  };

  const accept = (suggestion: Suggestion) => {
    if (!assist) return;
    const next = applySuggestion(value, assist, suggestion);
    onChange(next.value);
    focusAt(next.caret);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((i) => (i + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissedFor(value);
        return;
      }
      const chosen = suggestions[active];
      if (event.key === 'Tab' && chosen) {
        event.preventDefault();
        accept(chosen);
        return;
      }
      // Enter picks the highlighted suggestion, unless what is typed already is that suggestion (then it sends)
      if (event.key === 'Enter' && chosen && chosen.insert.trim() !== value.slice(assist!.replaceStart, assist!.replaceEnd).trim()) {
        event.preventDefault();
        accept(chosen);
      }
    }
  };

  const insertEmote = (name: string) => {
    const base = value && !/\s$/.test(value) ? `${value} ` : value;
    const next = `${base}${name} `;
    onChange(next);
    setPickerOpen(false);
    setPickerQuery('');
    focusAt(next.length);
  };

  const pickerEntries = useMemo(() => {
    if (!pickerOpen) return [];
    const q = pickerQuery.trim().toLowerCase();
    return Object.entries(emotes)
      .filter(([name]) => !q || name.toLowerCase().includes(q))
      .slice(0, 240);
  }, [pickerOpen, pickerQuery, emotes]);

  const inputClass = compact
    ? 'h-7 text-xs px-2.5 rounded'
    : 'h-8 text-xs px-3 rounded-md';

  return (
    <div className="relative shrink-0" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {notice && (
        <div
          role="status"
          className={`border-t px-2.5 py-1 text-[11px] font-medium ${
            notice.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
          }`}
        >
          <span dir="auto">{notice.message}</span>
        </div>
      )}

      {suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute inset-x-1.5 bottom-full z-30 mb-1 max-h-56 overflow-y-auto rounded-md border border-white/[0.16] bg-[#111820] p-1 shadow-2xl"
        >
          {suggestions.map((s, index) => (
            <li key={`${s.type}-${s.label}`} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => accept(s)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-start text-[12px] ${
                  index === active ? 'bg-accent/25 text-white' : 'text-slate-200 hover:bg-white/[0.06]'
                }`}
              >
                {s.imageUrl && <img src={s.imageUrl} alt="" className="h-5 w-auto max-w-[2.2rem] object-contain" loading="lazy" />}
                <span className="font-mono font-semibold" dir="ltr">{s.label}</span>
                {s.detail && <span className="ms-auto truncate text-[11px] text-slate-400">{s.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {pickerOpen && (
        <div className="absolute bottom-full end-1.5 z-40 mb-1 w-[300px] max-w-[calc(100%-12px)] rounded-lg border border-white/[0.16] bg-[#111820] p-2 shadow-2xl">
          <input
            autoFocus
            type="text"
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            placeholder={text.search}
            className="mb-2 h-7 w-full rounded border border-white/15 bg-[#0b1015] px-2 text-xs text-white outline-none focus:border-accent"
          />
          {pickerEntries.length === 0 ? (
            <div className="px-1 py-3 text-center text-[11.5px] text-slate-400">{text.none}</div>
          ) : (
            <div className="grid max-h-[220px] grid-cols-7 gap-1 overflow-y-auto">
              {pickerEntries.map(([name, url]) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => insertEmote(name)}
                  className="grid size-9 place-items-center rounded hover:bg-white/[0.1]"
                >
                  <img src={url} alt={name} className="max-h-7 max-w-[2rem] object-contain" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className={`flex items-center gap-1.5 border-t border-white/10 bg-[#182026] select-text ${compact ? 'h-9 px-2' : 'p-2.5 gap-2'}`}
      >
        {leading}
        <input
          ref={ref}
          type="text"
          dir="auto"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setDismissedFor(null);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? value.length)}
          onClick={(e) => setCaret(e.currentTarget.selectionStart ?? value.length)}
          placeholder={placeholder}
          className={`${inputClass} flex-1 border border-white/15 bg-[#0f1418] font-sans text-white outline-none placeholder:text-slate-400 focus:border-accent`}
        />
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          title={text.emotes}
          aria-label={text.emotes}
          aria-expanded={pickerOpen}
          className={`grid shrink-0 place-items-center rounded border border-white/15 text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white ${compact ? 'size-7' : 'size-8'} ${pickerOpen ? 'bg-white/[0.1] text-white' : 'bg-[#0f1418]'}`}
        >
          <Smile size={compact ? 14 : 15} />
        </button>
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          title={sendLabel ?? text.send}
          className={`flex shrink-0 items-center justify-center gap-1 rounded bg-accent px-3 text-xs font-bold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-default disabled:opacity-40 ${compact ? 'h-7' : 'h-8'}`}
        >
          <Send size={compact ? 12 : 13} strokeWidth={2.5} />
          {!compact && <span>{sendLabel ?? text.send}</span>}
        </button>
      </form>
    </div>
  );
}
