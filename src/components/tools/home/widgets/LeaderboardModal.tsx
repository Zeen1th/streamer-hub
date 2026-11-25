import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, X } from 'lucide-react';
import type { LeaderboardMetric, LeaderboardPeriod } from '../../../../lib/stats';
import { cn } from '../../../../lib/cn';
import { useHomeText } from '../homeText';
import { LeaderboardRow, METRICS, useLeaderboardRows } from './LeaderboardRows';

/** Rows shown before "Show all". */
export const EXPANDED_TOP = 10;

interface Props {
  metric: LeaderboardMetric;
  period: LeaderboardPeriod;
  onMetric: (metric: LeaderboardMetric) => void;
  onPeriod: (period: LeaderboardPeriod) => void;
  onClose: () => void;
}

/** The leaderboard at full size: the same metric and period tabs, the top 10, and a toggle that lists everyone. */
export function LeaderboardModal({ metric, period, onMetric, onPeriod, onClose }: Props) {
  const { h } = useHomeText();
  const { all, avatars } = useLeaderboardRows(period, metric);
  const [showAll, setShowAll] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const rows = showAll ? all : all.slice(0, EXPANDED_TOP);
  const top = all[0]?.value ?? 1;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const tab = (active: boolean) =>
    cn(
      'h-[26px] rounded-full border px-3 text-[11.5px] font-semibold',
      active ? 'border-[#6366f1] bg-[#6366f1] text-white' : 'border-white/[0.1] bg-white/[0.03] text-[#9aa3af] hover:border-white/[0.18] hover:text-white',
    );

  // Portalled to the page: a widget card can sit inside a transformed or clipped box that would trap a fixed overlay
  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-modal-title"
        className="flex max-h-[min(720px,100%)] w-full max-w-[560px] flex-col overflow-hidden rounded-[12px] border border-white/[0.14] bg-[#151c21] text-[#f8fafc] shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <h2 id="leaderboard-modal-title" className="flex min-w-0 items-center gap-2 font-sans text-[14px] font-bold tracking-tight">
            <Trophy size={16} className="shrink-0 text-amber-300" />
            <span className="truncate">{h(`lb.title.${metric}` as const)}</span>
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex rounded-[7px] bg-[#1a2228] p-0.5" role="tablist" aria-label="Period">
              {(['stream', 'allTime'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={period === p}
                  onClick={() => onPeriod(p)}
                  className={cn('h-[22px] rounded-[5px] px-2 text-[11px] font-medium', period === p ? 'bg-white/[0.12] text-white' : 'text-[#9aa3af] hover:text-white')}
                >
                  {h(p === 'stream' ? 'lb.stream' : 'lb.allTime')}
                </button>
              ))}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              title={h('lb.close')}
              aria-label={h('lb.close')}
              className="grid size-7 place-items-center rounded-md text-[#9aa3af] hover:bg-white/[0.08] hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Leaderboard">
            {METRICS.map((m) => (
              <button key={m} type="button" role="tab" aria-selected={metric === m} onClick={() => onMetric(m)} className={tab(metric === m)}>
                {h(`lb.${m}` as const)}
              </button>
            ))}
          </div>
          <div className="flex rounded-[7px] bg-[#1a2228] p-0.5" role="group" aria-label={h('lb.expand')}>
            <button
              type="button"
              aria-pressed={!showAll}
              onClick={() => setShowAll(false)}
              className={cn('h-[22px] rounded-[5px] px-2 text-[11px] font-medium', !showAll ? 'bg-white/[0.12] text-white' : 'text-[#9aa3af] hover:text-white')}
            >
              {h('lb.top10')}
            </button>
            <button
              type="button"
              aria-pressed={showAll}
              onClick={() => setShowAll(true)}
              className={cn('h-[22px] rounded-[5px] px-2 text-[11px] font-medium', showAll ? 'bg-white/[0.12] text-white' : 'text-[#9aa3af] hover:text-white')}
            >
              {h('lb.showAllCount', { n: all.length })}
            </button>
          </div>
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto px-4 py-3" data-testid="leaderboard-modal-list">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-center text-[12px] leading-relaxed text-[#9aa3af]">{h('lb.empty')}</div>
          ) : (
            <ol className="space-y-1.5">
              {rows.map((row) => (
                <LeaderboardRow key={row.user.login} row={row} metric={metric} top={top} avatar={avatars.get(row.user.login)} />
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
