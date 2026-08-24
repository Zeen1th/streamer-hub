import { useEffect, useState } from 'react';
import { Plus, Tally5 } from 'lucide-react';
import { t } from '../../../i18n/translations';
import { useCounterStore } from '../../../store/counterStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { ActivityLog } from './ActivityLog';
import { CounterCard } from './CounterCard';
import { CounterConfigPanel } from './CounterConfigPanel';
import { Button } from '../../ui/Button';

export function CounterView() {
  const counters = useCounterStore((s) => s.counters);
  const selectedId = useCounterStore((s) => s.selectedId);
  const select = useCounterStore((s) => s.select);
  const addCounter = useCounterStore((s) => s.addCounter);
  const incrementManual = useCounterStore((s) => s.incrementManual);
  const decrementManual = useCounterStore((s) => s.decrementManual);
  const resetManual = useCounterStore((s) => s.resetManual);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const selected = counters.find((c) => c.id === selectedId) ?? null;
  const [configId, setConfigId] = useState<string | null>(null);
  const configCounter = counters.find((c) => c.id === configId) ?? null;

  useEffect(() => {
    if (!configCounter) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setConfigId(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [configCounter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const id = useCounterStore.getState().selectedId;
      if (!id) return;
      if (event.key === 'ArrowUp' || event.key === '+') {
        event.preventDefault();
        incrementManual(id);
      } else if (event.key === 'ArrowDown' || event.key === '-') {
        event.preventDefault();
        decrementManual(id);
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        resetManual(id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [incrementManual, decrementManual, resetManual]);

  return (
    <div>
      <header className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <Tally5 size={22} className="text-primary" aria-hidden />
            <h1 className="font-display text-3xl uppercase leading-none text-ink">{t(lang, 'counters.title')}</h1>
          </div>
          <div className="mt-5 h-px w-56 bg-ink/20">
            <div className="h-px w-56 bg-primary" />
          </div>
          <p className="mt-4 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-ink/65">
            {t(lang, 'counters.subtitle')}
          </p>
        </div>
        <Button onClick={addCounter} title={t(lang, 'counters.new')}>
          <Plus size={15} />
          {t(lang, 'counters.new')}
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          {counters.length === 0 ? (
            <div className="slab flex flex-col items-center justify-center px-6 py-16 text-center">
              <Tally5 size={26} strokeWidth={1.5} className="text-primary/60" />
              <div className="mt-4 font-display text-lg uppercase tracking-[0.04em] text-ink/70">
                {t(lang, 'counters.empty')}
              </div>
              <div className="mt-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink/70">
                {t(lang, 'counters.emptyHint')}
              </div>
              <Button className="mt-6" onClick={addCounter}>
                <Plus size={15} />
                {t(lang, 'counters.new')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {counters.map((counter) => (
                <CounterCard
                  key={counter.id}
                  counter={counter}
                  selected={counter.id === selectedId}
                  onSelect={() => select(counter.id)}
                  onCustomize={() => setConfigId(counter.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="xl:col-span-4">
          {selected ? (
            <div className="slab flex flex-col items-center justify-center px-6 py-16 text-center">
              <Tally5 size={26} strokeWidth={1.5} className="text-primary/60" />
              <div className="mt-4 font-display text-lg uppercase tracking-[0.04em] text-ink/70">
                {t(lang, 'counters.select')}
              </div>
              <div className="mt-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink/70">
                {t(lang, 'counters.selectHint')}
              </div>
            </div>
          ) : null}
        </div>

        <ActivityLog className="xl:col-span-12" />
      </div>
      {configCounter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfigId(null); }}>
          <section className="max-h-[calc(100vh-48px)] w-full max-w-4xl overflow-y-auto" role="dialog" aria-modal="true" aria-label={t(lang, 'counters.customize')}>
            <CounterConfigPanel key={configCounter.id} counter={configCounter} onClose={() => setConfigId(null)} />
          </section>
        </div>
      )}
    </div>
  );
}
