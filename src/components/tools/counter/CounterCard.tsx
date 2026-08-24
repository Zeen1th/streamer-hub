import type { KeyboardEvent } from 'react';
import { Minus, Pencil, Plus, RotateCcw } from 'lucide-react';
import type { Counter } from '../../../rpc/contracts';
import { cn } from '../../../lib/cn';
import { t } from '../../../i18n/translations';
import { useCounterStore } from '../../../store/counterStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/Button';

interface CounterCardProps {
  counter: Counter;
  selected: boolean;
  onSelect: () => void;
  onCustomize: () => void;
}

export function CounterCard({ counter, selected, onSelect, onCustomize }: CounterCardProps) {
  const incrementManual = useCounterStore((s) => s.incrementManual);
  const decrementManual = useCounterStore((s) => s.decrementManual);
  const resetManual = useCounterStore((s) => s.resetManual);
  const lastTriggerUser = useCounterStore((s) => s.lastTriggerUser[counter.id]);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const stop = (fn: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    fn();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'cursor-pointer p-px transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected ? 'bg-primary' : 'bg-transparent',
      )}
    >
      <div className="slab p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate font-display text-xl uppercase leading-tight tracking-[0.04em] text-ink">
            {counter.name}
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={stop(onCustomize)} title={t(lang, 'counters.customize')} aria-label={t(lang, 'counters.customize')}>
              <Pencil size={13} />
            </Button>
            <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', selected ? 'ember-glow bg-primary' : 'border border-ink/30 bg-transparent')} />
          </div>
        </div>
        <div aria-live="polite" dir="ltr" className="mt-3 text-start font-display text-5xl leading-none text-ink">
          {String(counter.count).padStart(3, '0')}
        </div>
        <div className="mt-3 font-mono text-xs uppercase tracking-[0.15em] text-ink/65">
          {t(lang, 'card.last')} · {lastTriggerUser ? `@${lastTriggerUser}` : '—'}
        </div>
        <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            aria-label={t(lang, 'card.decrement', { name: counter.name })}
            title="−"
            disabled={counter.count <= 0}
            onClick={stop(() => decrementManual(counter.id))}
          >
            <Minus size={14} />
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="h-9"
            aria-label={t(lang, 'card.increment', { name: counter.name })}
            title="+"
            onClick={stop(() => incrementManual(counter.id))}
          >
            <Plus size={14} />
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="h-9"
            aria-label={t(lang, 'card.reset', { name: counter.name })}
            title="R"
            disabled={counter.count <= 0}
            onClick={stop(() => resetManual(counter.id))}
          >
            <RotateCcw size={13} />
          </Button>
        </div>
      </div>
    </div>
  );
}
