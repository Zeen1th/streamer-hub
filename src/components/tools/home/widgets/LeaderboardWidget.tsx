import { useState } from 'react';
import { Maximize2, Send, Trash2, Trophy } from 'lucide-react';
import { rpc } from '../../../../rpc';
import { Channels } from '../../../../rpc/contracts';
import { useStatsStore } from '../../../../store/statsStore';
import { leaderboardChatLine, type LeaderboardMetric, type LeaderboardPeriod } from '../../../../lib/stats';
import { cn } from '../../../../lib/cn';
import { useHomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';
import { LeaderboardModal } from './LeaderboardModal';
import { LeaderboardRow, METRICS, useLeaderboardRows } from './LeaderboardRows';

function readMetric(raw: string | undefined): LeaderboardMetric {
  return (METRICS as string[]).includes(raw ?? '') ? (raw as LeaderboardMetric) : 'messages';
}

export function LeaderboardWidget({ chrome, config, setConfig }: WidgetProps) {
  const { h } = useHomeText();
  const metric = readMetric(config.metric);
  const period: LeaderboardPeriod = config.period === 'allTime' ? 'allTime' : 'stream';
  const limit = chrome.size >= 8 ? 8 : 5;

  const resetAll = useStatsStore((s) => s.resetAll);
  const [status, setStatus] = useState<'idle' | 'posted' | 'failed'>('idle');
  const [confirmReset, setConfirmReset] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { all, avatars } = useLeaderboardRows(period, metric);
  const rows = all.slice(0, limit);
  const top = rows[0]?.value ?? 1;

  const post = async () => {
    // The chat line is always the top 5, however many rows the widget or the expanded view shows
    const line = leaderboardChatLine(`${h(`lb.title.${metric}` as const)} (${h(period === 'stream' ? 'lb.stream' : 'lb.allTime')})`, all.slice(0, 5), h(`lb.unit.${metric}` as const));
    try {
      const res = await rpc.invoke(Channels.TwitchSendChatMessage, { message: line });
      setStatus(res?.ok ? 'posted' : 'failed');
    } catch {
      setStatus('failed');
    }
    window.setTimeout(() => setStatus('idle'), 2500);
  };

  return (
    <WidgetCard
      id="leaderboard"
      title={h('w.leaderboard')}
      icon={<Trophy size={15} className="text-amber-300" />}
      {...chrome}
      actions={
        <div className="flex rounded-[7px] bg-[#1a2228] p-0.5" role="tablist" aria-label="Period">
          {(['stream', 'allTime'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setConfig({ period: p })}
              className={cn('h-[22px] rounded-[5px] px-2 text-[11px] font-medium', period === p ? 'bg-white/[0.12] text-white' : 'text-[#9aa3af] hover:text-white')}
            >
              {h(p === 'stream' ? 'lb.stream' : 'lb.allTime')}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Leaderboard">
        {METRICS.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={metric === m}
            onClick={() => setConfig({ metric: m })}
            className={cn(
              'h-[26px] rounded-full border px-3 text-[11.5px] font-semibold',
              metric === m ? 'border-[#6366f1] bg-[#6366f1] text-white' : 'border-white/[0.1] bg-white/[0.03] text-[#9aa3af] hover:border-white/[0.18] hover:text-white',
            )}
          >
            {h(`lb.${m}` as const)}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center text-[12px] leading-relaxed text-[#9aa3af]">{h('lb.empty')}</div>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((row) => (
            <LeaderboardRow key={row.user.login} row={row} metric={metric} top={top} avatar={avatars.get(row.user.login)} />
          ))}
        </ol>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title={h('lb.expandTitle')}
          className="flex h-[24px] items-center gap-1 rounded-[6px] px-2 text-[11px] text-[#9aa3af] hover:bg-white/[0.08] hover:text-white"
        >
          <Maximize2 size={12} /> {h('lb.expand')}
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                window.setTimeout(() => setConfirmReset(false), 4000);
                return;
              }
              setConfirmReset(false);
              resetAll();
            }}
            title={h('lb.resetConfirm')}
            className={cn('flex h-[24px] items-center gap-1 rounded-[6px] px-2 text-[11px]', confirmReset ? 'bg-rose-500/25 text-rose-100' : 'text-[#9aa3af] hover:bg-white/[0.08] hover:text-white')}
          >
            <Trash2 size={12} /> {h('lb.reset')}
          </button>
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() => void post()}
            className="flex h-[24px] items-center gap-1 rounded-[6px] bg-[#6366f1] px-2.5 text-[11px] font-semibold text-white hover:bg-[#7a7cf6] disabled:pointer-events-none disabled:opacity-35"
          >
            <Send size={12} /> {status === 'posted' ? h('lb.posted') : status === 'failed' ? h('lb.postFailed') : h('lb.post')}
          </button>
        </div>
      </div>

      {expanded && (
        <LeaderboardModal
          metric={metric}
          period={period}
          onMetric={(m) => setConfig({ metric: m })}
          onPeriod={(p) => setConfig({ period: p })}
          onClose={() => setExpanded(false)}
        />
      )}
    </WidgetCard>
  );
}
