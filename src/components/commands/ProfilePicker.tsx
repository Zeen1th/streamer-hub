import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { t } from '../../i18n/translations';
import { cn } from '../../lib/cn';
import { useProfileStore } from '../../store/profileStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type Mode =
  | { kind: 'list' }
  | { kind: 'rename'; id: string }
  | { kind: 'create'; sourceId: string | null }
  | { kind: 'delete'; id: string };

/**
 * Commands toolbar: the live command profile and a menu to switch, add, duplicate, rename or delete profiles.
 * A profile is a whole set of counters, replies, sequences and hotkeys; switching is instant.
 */

/** "8 commands" with Arabic number agreement (أمر واحد، أمران، 3-10 أوامر، 11+ أمراً). */
function commandCount(lang: 'en' | 'ar', n: number): string {
  if (n === 1) return t(lang, 'profiles.summaryOne');
  if (n === 2) return t(lang, 'profiles.summaryTwo');
  if (n >= 3 && n <= 10) return t(lang, 'profiles.summaryFew', { n });
  return t(lang, 'profiles.summary', { n });
}
export function ProfilePicker({ lang }: { lang: 'en' | 'ar' }) {
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const busy = useProfileStore((s) => s.busy);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const active = profiles.find((p) => p.id === activeId);
  const total = (p: { counters: number; replies: number; sequences: number }) => p.counters + p.replies + p.sequences;

  const close = () => {
    setOpen(false);
    setMode({ kind: 'list' });
    setError(null);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (mode.kind === 'list') close();
        else setMode({ kind: 'list' });
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, mode.kind]);

  if (!active) return null;

  const run = async (action: () => Promise<boolean>, onDone?: () => void) => {
    setError(null);
    try {
      if (await action()) {
        onDone?.();
        return;
      }
    } catch {
      void 0;
    }
    setError(t(lang, 'profiles.failed'));
  };

  const startRename = (id: string, name: string) => {
    setDraft(name);
    setMode({ kind: 'rename', id });
  };

  const startCreate = (sourceId: string | null) => {
    const source = profiles.find((p) => p.id === sourceId);
    setDraft(source ? t(lang, 'profiles.copyName', { name: source.name }) : t(lang, 'profiles.defaultNewName'));
    setMode({ kind: 'create', sourceId });
  };

  const submitDraft = () => {
    const name = draft.trim();
    if (!name) return;
    if (mode.kind === 'rename') {
      void run(() => useProfileStore.getState().rename(mode.id, name), () => setMode({ kind: 'list' }));
    } else if (mode.kind === 'create') {
      const store = useProfileStore.getState();
      void run(
        async () => {
          const id = mode.sourceId ? await store.duplicate(mode.sourceId, name) : await store.add(name);
          return id !== null;
        },
        () => setMode({ kind: 'list' }),
      );
    }
  };

  const deleting = mode.kind === 'delete' ? profiles.find((p) => p.id === mode.id) : null;

  return (
    <div ref={rootRef} className="relative" data-profile-picker>
      <Button
        size="sm"
        variant="outline"
        aria-haspopup="menu"
        aria-expanded={open}
        title={t(lang, 'profiles.label')}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn('max-w-[190px]', open && 'border-white/[0.18] bg-white/[0.08] text-white')}
      >
        <Layers size={12} className="shrink-0 text-[#A5B4FC]" aria-hidden />
        <span dir="auto" className="truncate">{active.name}</span>
        <ChevronDown size={12} className={cn('shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </Button>

      {open && (
        <div
          role="menu"
          aria-label={t(lang, 'profiles.title')}
          className="absolute start-0 top-[calc(100%+6px)] z-40 w-[310px] overflow-hidden rounded-[8px] border border-white/[0.12] bg-[#1A2228] text-start shadow-2xl"
        >
          <div className="border-b border-white/[0.08] bg-[#151C21] px-3 py-2">
            <div dir="auto" className={cn('text-[#9AA3AF]', lang === 'ar' ? 'font-sans text-[11.5px] font-bold' : 'font-mono text-[10px] font-semibold uppercase tracking-wider')}>{t(lang, 'profiles.title')}</div>
            <p dir="auto" className="mt-1 text-[11px] leading-snug text-[#8993a3]">{t(lang, 'profiles.hint')}</p>
          </div>

          <ul className="max-h-[260px] overflow-y-auto p-1">
            {profiles.map((profile) => {
              const isActive = profile.id === activeId;
              if (mode.kind === 'rename' && mode.id === profile.id) {
                return (
                  <li key={profile.id} className="flex items-center gap-1 p-1">
                    <NameField value={draft} onChange={setDraft} onSubmit={submitDraft} lang={lang} />
                    <Button size="sm" onClick={submitDraft} disabled={!draft.trim()}>{t(lang, 'profiles.save')}</Button>
                  </li>
                );
              }
              return (
                <li key={profile.id} className="group flex items-center gap-0.5">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    disabled={busy}
                    title={isActive ? undefined : t(lang, 'profiles.switchTo', { name: profile.name })}
                    onClick={() => (isActive ? close() : void run(() => useProfileStore.getState().switchTo(profile.id), close))}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 rounded-[5px] px-2 py-1.5 text-start transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6366F1]',
                      isActive && 'bg-white/[0.05]',
                    )}
                  >
                    <span className="grid size-4 shrink-0 place-items-center">
                      {isActive && <Check size={13} className="text-emerald-400" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span dir="auto" className="block truncate text-left text-[12.5px] font-semibold text-white">{profile.name}</span>
                      <span dir="auto" className={cn('block truncate text-left text-[#8993a3]', lang === 'ar' ? 'font-sans text-[11px]' : 'font-mono text-[10px]')}>
                        {isActive ? `${t(lang, 'profiles.active')} · ` : ''}{commandCount(lang, total(profile))}
                      </span>
                    </span>
                  </button>
                  <span className="flex shrink-0 items-center opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconButton label={t(lang, 'profiles.rename')} onClick={() => startRename(profile.id, profile.name)}><Pencil size={12} /></IconButton>
                    <IconButton
                      label={t(lang, 'profiles.delete')}
                      disabled={profiles.length <= 1}
                      title={profiles.length <= 1 ? t(lang, 'profiles.deleteLast') : undefined}
                      onClick={() => setMode({ kind: 'delete', id: profile.id })}
                    >
                      <Trash2 size={12} />
                    </IconButton>
                  </span>
                </li>
              );
            })}
          </ul>

          {deleting && (
            <div role="alertdialog" className="mx-1 mb-1 flex flex-col gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5">
              <p className="text-[12px] font-semibold text-rose-100" dir="auto">{t(lang, 'profiles.deleteTitle', { name: deleting.name })}</p>
              <p dir="auto" className="text-[11.5px] leading-snug text-rose-200/90">{t(lang, 'profiles.deleteBody', { n: total(deleting) })}</p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setMode({ kind: 'list' })}>{t(lang, 'profiles.cancel')}</Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void run(() => useProfileStore.getState().remove(deleting.id), () => setMode({ kind: 'list' }))}
                >
                  <Trash2 size={12} />{t(lang, 'profiles.delete')}
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.08] p-1">
            {mode.kind === 'create' ? (
              <div className="flex items-center gap-1 p-1">
                <NameField value={draft} onChange={setDraft} onSubmit={submitDraft} lang={lang} />
                <Button size="sm" onClick={submitDraft} disabled={!draft.trim()}>{t(lang, 'profiles.create')}</Button>
              </div>
            ) : (
              <>
                <MenuAction icon={<Plus size={13} />} onClick={() => startCreate(null)}>{t(lang, 'profiles.new')}</MenuAction>
                <MenuAction icon={<Copy size={13} />} onClick={() => startCreate(activeId)}>{t(lang, 'profiles.duplicate')}</MenuAction>
              </>
            )}
          </div>
          {error && <p role="alert" className="border-t border-white/[0.08] px-3 py-1.5 text-[11.5px] text-rose-300">{error}</p>}
        </div>
      )}
    </div>
  );
}

function NameField({ value, onChange, onSubmit, lang }: { value: string; onChange(value: string): void; onSubmit(): void; lang: 'en' | 'ar' }) {
  return (
    <Input
      dir="auto"
      autoFocus
      maxLength={40}
      value={value}
      placeholder={t(lang, 'profiles.namePlaceholder')}
      aria-label={t(lang, 'profiles.namePlaceholder')}
      className="h-[26px] min-w-0 flex-1 text-[12px]"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit();
      }}
    />
  );
}

function IconButton({ label, children, ...rest }: { label: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={label}
      title={label}
      {...rest}
      className="grid size-7 place-items-center rounded-[5px] text-[#9AA3AF] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6366F1] disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function MenuAction({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick(): void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-start text-[12px] font-medium text-[#cbd3e6] transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6366F1]"
    >
      <span className="grid size-4 shrink-0 place-items-center text-[#9AA3AF]">{icon}</span>
      {children}
    </button>
  );
}
