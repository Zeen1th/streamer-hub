import { useMemo, useState } from 'react';
import { Crown, Send, Trash2, Trophy } from 'lucide-react';
import { rpc } from '../../../../rpc';
import { Channels } from '../../../../rpc/contracts';
import { useChatterStore } from '../../../../store/chatterStore';
import { useConnectionStore } from '../../../../store/connectionStore';
import { useStatsStore } from '../../../../store/statsStore';
import {
  formatCompact,
  isIgnoredUser,
  leaderboardChatLine,
  topUsers,
  type LeaderboardMetric,
  type LeaderboardPeriod,
} from '../../../../lib/stats';
import { cn } from '../../../../lib/cn';
import { Avatar } from '../Avatar';
import { useHomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

const METRICS: LeaderboardMetric[] = ['messages', 'duelWins', 'gifts', 'redemptions'];

const MEDAL = ['bg-amber-400/90 text-amber-950', 'bg-slate-300/90 text-slate-900', 'bg-orange-400/80 text-orange-950'];
const BAR = ['bg-amber-400/70', 'bg-slate-300/60', 'bg-orange-400/60'];

function readMetric(raw: string | undefined): LeaderboardMetric {
  return (METRICS as string[]).includes(raw ?? '') ? (raw as LeaderboardMetric) : 'messages';
}

export function LeaderboardWidget({ chrome, config, setConfig }: WidgetProps) {
  const { h } = useHomeText();
  const metric = readMetric(config.metric);
  const period: LeaderboardPeriod = config.period === 'allTime' ? 'allTime' : 'stream';
  const includeStreamer = config.includeStreamer === '1';
  const limit = chrome.size >= 8 ? 8 : 5;

  const broadcaster = useConnectionStore((s) => s.twitchChannel)?.replace(/^#+/, '');
  const allTime = useStatsStore((s) => s.allTime);
  const session = useStatsStore((s) => s.session);
  const rev = useStatsStore((s) => s.rev);
  const resetAll = useStatsStore((s) => s.resetAll);
  const chatters = useChatterStore((s) => s.chatters);
  const [status, setStatus] = useState<'idle' | 'posted' | 'failed'>('idle');
  const [confirmReset, setConfirmReset] = useState(false);

  const rows = useMemo(
    () => topUsers(period === 'stream' ? session.users : allTime, metric, limit, (login) => isIgnoredUser(login, broadcaster, includeStreamer)),
    // rev changes whenever the (mutated) maps do
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, metric, limit, broadcaster, includeStreamer, rev, session, allTime],
  );

  const avatars = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of Object.values(chatters)) if (c.login && c.avatarUrl) map.set(c.login, c.avatarUrl);
    return map;
  }, [chatters]);

  const top = rows[0]?.value ?? 1;

  const post = async () => {
    const line = leaderboardChatLine(`${h(`lb.title.${metric}` as const)} (${h(period === 'stream' ? 'lb.stream' : 'lb.allTime')})`, rows, h(`lb.unit.${metric}` as const));
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
          {rows.map((row) => {
            const podium = row.rank <= 3;
            const detail =
              metric === 'duelWins'
                ? h('lb.record', { w: row.user.duelWins, l: row.user.duelLosses })
                : metric === 'redemptions' && row.user.points > 0
                  ? h('lb.points', { n: formatCompact(row.user.points) })
                  : '';
            return (
              <li key={row.user.login} className={cn('relative overflow-hidden rounded-[9px] border px-2.5 py-1.5', row.rank === 1 ? 'border-amber-300/25 bg-amber-300/[0.07]' : 'border-white/[0.06] bg-[#1a2228]')}>
                <span
                  aria-hidden
                  className={cn('absolute inset-y-0 start-0 opacity-[0.14]', podium ? BAR[row.rank - 1] : 'bg-white/70')}
                  style={{ width: `${Math.max(6, (row.value / top) * 100)}%` }}
                />
                <div className="relative flex items-center gap-2.5">
                  <span className={cn('grid size-[20px] shrink-0 place-items-center rounded-full font-mono text-[10.5px] font-bold', podium ? MEDAL[row.rank - 1] : 'bg-white/[0.08] text-[#9aa3af]')}>
                    {row.rank === 1 ? <Crown size={11} /> : row.rank}
                  </span>
                  <Avatar name={row.user.name} src={avatars.get(row.user.login)} size={26} />
                  <span className="min-w-0 flex-1 truncate text-start text-[12.5px] font-semibold text-white" dir="ltr">
                    <bdi>{row.user.name}</bdi>
                    {detail && <span className="ms-2 font-mono text-[10.5px] font-normal text-[#9aa3af]">{detail}</span>}
                  </span>
                  <span className="font-mono text-[13px] font-bold tabular-nums text-white">{formatCompact(row.value)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#9aa3af]">
          <input
            type="checkbox"
            checked={includeStreamer}
            onChange={(e) => setConfig({ includeStreamer: e.target.checked ? '1' : '0' })}
            className="size-3.5 rounded border-white/20 bg-black/40"
          />
          {h('lb.includeStreamer')}
        </label>
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
    </WidgetCard>
  );
}
