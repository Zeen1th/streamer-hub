import { useMemo } from 'react';
import { Crown } from 'lucide-react';
import { useChatterStore } from '../../../../store/chatterStore';
import { useConnectionStore } from '../../../../store/connectionStore';
import { useStatsStore } from '../../../../store/statsStore';
import { formatCompact, isIgnoredUser, topUsers, type LeaderboardMetric, type LeaderboardPeriod, type RankedUser } from '../../../../lib/stats';
import { cn } from '../../../../lib/cn';
import { Avatar } from '../Avatar';
import { useHomeText } from '../homeText';

export const METRICS: LeaderboardMetric[] = ['messages', 'duelWins', 'gifts', 'redemptions', 'clips'];

const MEDAL = ['bg-amber-400/90 text-amber-950', 'bg-slate-300/90 text-slate-900', 'bg-orange-400/80 text-orange-950'];
const BAR = ['bg-amber-400/70', 'bg-slate-300/60', 'bg-orange-400/60'];

/** Everyone with a value above 0 for the metric, best first. Bots, the streamer and the app's bot account never appear. */
export function useLeaderboardRows(period: LeaderboardPeriod, metric: LeaderboardMetric) {
  const broadcaster = useConnectionStore((s) => s.twitchChannel)?.replace(/^#+/, '');
  const botLogin = useConnectionStore((s) => s.botLogin);
  const allTime = useStatsStore((s) => s.allTime);
  const session = useStatsStore((s) => s.session);
  const rev = useStatsStore((s) => s.rev);
  const chatters = useChatterStore((s) => s.chatters);

  const all = useMemo(
    () => topUsers(period === 'stream' ? session.users : allTime, metric, Number.MAX_SAFE_INTEGER, (login) => isIgnoredUser(login, broadcaster, botLogin)),
    // rev changes whenever the (mutated) maps do
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, metric, broadcaster, botLogin, rev, session, allTime],
  );

  const avatars = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of Object.values(chatters)) if (c.login && c.avatarUrl) map.set(c.login, c.avatarUrl);
    return map;
  }, [chatters]);

  return { all, avatars };
}

interface RowProps {
  row: RankedUser;
  metric: LeaderboardMetric;
  /** The best value on the list, so the bar behind each row is relative to it. */
  top: number;
  avatar?: string;
}

/** One leaderboard line: rank, avatar, name, value. Shared by the Home widget and the expanded view. */
export function LeaderboardRow({ row, metric, top, avatar }: RowProps) {
  const { h } = useHomeText();
  const podium = row.rank <= 3;
  const detail =
    metric === 'duelWins'
      ? h('lb.record', { w: row.user.duelWins, l: row.user.duelLosses })
      : metric === 'redemptions' && row.user.points > 0
        ? h('lb.points', { n: formatCompact(row.user.points) })
        : '';
  return (
    <li className={cn('relative overflow-hidden rounded-[9px] border px-2.5 py-1.5', row.rank === 1 ? 'border-amber-300/25 bg-amber-300/[0.07]' : 'border-white/[0.06] bg-[#1a2228]')}>
      <span
        aria-hidden
        className={cn('absolute inset-y-0 start-0 opacity-[0.14]', podium ? BAR[row.rank - 1] : 'bg-white/70')}
        style={{ width: `${Math.max(6, (row.value / Math.max(1, top)) * 100)}%` }}
      />
      <div className="relative flex items-center gap-2.5">
        <span className={cn('grid size-[20px] shrink-0 place-items-center rounded-full font-mono text-[10.5px] font-bold', podium ? MEDAL[row.rank - 1] : 'bg-white/[0.08] text-[#9aa3af]')}>
          {row.rank === 1 ? <Crown size={11} /> : row.rank}
        </span>
        <Avatar name={row.user.name} src={avatar} size={26} />
        <span className="min-w-0 flex-1 truncate text-start text-[12.5px] font-semibold text-white" dir="ltr">
          <bdi>{row.user.name}</bdi>
          {detail && <span dir="auto" className="ml-2 font-mono text-[10.5px] font-normal text-[#9aa3af]">{detail}</span>}
        </span>
        <span className="font-mono text-[13px] font-bold tabular-nums text-white">{formatCompact(row.value)}</span>
      </div>
    </li>
  );
}
