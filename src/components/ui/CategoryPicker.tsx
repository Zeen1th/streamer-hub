import { Gamepad2, Loader2, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { rpc } from '../../rpc';
import { Channels, type TwitchCategory } from '../../rpc/contracts';

const TEXT = {
  en: {
    label: 'Category',
    hint: 'When the title updates, the stream switches to this category too. Leave empty to keep the current category.',
    search: 'Search Twitch categories',
    none: 'No category found',
    offline: 'Connect Twitch to search categories',
    clear: 'Remove category',
  },
  ar: {
    label: 'الفئة',
    hint: 'عندما يتحدث العنوان، يتحول البث إلى هذه الفئة أيضاً. اتركها فارغة لتبقى الفئة الحالية.',
    search: 'ابحث في فئات تويتش',
    none: 'لا توجد فئة بهذا الاسم',
    offline: 'اربط تويتش للبحث في الفئات',
    clear: 'إزالة الفئة',
  },
};

function BoxArt({ url, size }: { url?: string; size: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-[52px] w-[39px]' : 'h-9 w-[27px]';
  if (!url) {
    return (
      <span className={`${cls} grid shrink-0 place-items-center rounded-[3px] bg-white/[0.06] text-muted`}>
        <Gamepad2 size={size === 'md' ? 16 : 13} />
      </span>
    );
  }
  return <img src={url} alt="" className={`${cls} shrink-0 rounded-[3px] object-cover`} loading="lazy" />;
}

/**
 * Twitch-style category field: search by name, results with box art, the chosen category shown as a card.
 * `null` means "keep whatever category the stream has".
 */
export function CategoryPicker({
  value,
  onChange,
  lang,
  disabled,
  hint,
}: {
  value: TwitchCategory | null | undefined;
  onChange(category: TwitchCategory | null): void;
  lang: 'en' | 'ar';
  disabled?: boolean;
  /** Replaces the default "switches when the title updates" hint (for a picker that applies right away). */
  hint?: string;
}) {
  const tx = TEXT[lang];
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<TwitchCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setItems([]);
      setError(null);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await rpc.invoke(Channels.TwitchSearchCategories, { query: q });
        if (id !== requestId.current) return;
        setItems(res.items ?? []);
        setError(res.ok ? null : tx.offline);
      } catch {
        if (id === requestId.current) setError(tx.offline);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, tx.offline]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const pick = (category: TwitchCategory) => {
    onChange(category);
    setQuery('');
    setItems([]);
    setOpen(false);
  };

  return (
    <div className="space-y-1.5" ref={boxRef}>
      <label className="font-sans text-[12px] font-medium text-zinc-300">{tx.label}</label>
      {value ? (
        <div className="flex items-center gap-3 rounded-md border border-white/[0.1] bg-[#11131a] p-2 pe-3">
          <BoxArt url={value.boxArtUrl} size="md" />
          <bdi className="min-w-0 flex-1 truncate font-sans text-[13px] font-semibold text-ink">{value.name}</bdi>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label={tx.clear}
            title={tx.clear}
            className="grid size-7 shrink-0 place-items-center rounded text-muted hover:bg-white/[0.06] hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && items[0]) {
                e.preventDefault();
                pick(items[0]);
              }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder={tx.search}
            aria-label={tx.search}
            dir="auto"
            className="h-9 w-full rounded-md border border-white/[0.1] bg-[#11131a] ps-8 pe-8 font-sans text-[13px] text-ink placeholder:text-muted outline-none focus:border-accent/60 disabled:opacity-50"
          />
          {loading && <Loader2 size={14} className="absolute end-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted" />}
          {open && query.trim() && !loading && (
            <div
              role="listbox"
              className="absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-[300px] overflow-y-auto rounded-md border border-white/[0.1] bg-[#151820] p-1 shadow-2xl"
            >
              {error ? (
                <div className="px-3 py-2.5 text-[12px] text-amber-300">{error}</div>
              ) : items.length === 0 ? (
                <div className="px-3 py-2.5 text-[12px] text-muted">{tx.none}</div>
              ) : (
                items.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => pick(category)}
                    className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-start hover:bg-white/[0.06]"
                  >
                    <BoxArt url={category.boxArtUrl} size="sm" />
                    <bdi className="min-w-0 truncate font-sans text-[13px] text-ink">{category.name}</bdi>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
      <p className="font-sans text-[11px] leading-relaxed text-muted">{hint ?? tx.hint}</p>
    </div>
  );
}
