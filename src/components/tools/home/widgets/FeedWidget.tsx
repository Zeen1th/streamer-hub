import type { ReactNode } from 'react';
import { Gem, Gift, Heart, Radio, Rocket, Swords, Flame } from 'lucide-react';
import { useStatsStore } from '../../../../store/statsStore';
import { formatAgo, type FeedEvent, type FeedKind } from '../../../../lib/stats';
import { useNow } from '../../../../lib/useNow';
import { cn } from '../../../../lib/cn';
import { useHomeText, type HomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

const KIND: Record<FeedKind, { icon: ReactNode; tone: string }> = {
  follow: { icon: <Heart size={13} />, tone: 'text-rose-300 bg-rose-500/15' },
  raid: { icon: <Rocket size={13} />, tone: 'text-amber-300 bg-amber-500/15' },
  gift: { icon: <Gift size={13} />, tone: 'text-fuchsia-300 bg-fuchsia-500/15' },
  redeem: { icon: <Gem size={13} />, tone: 'text-cyan-300 bg-cyan-500/15' },
  duel: { icon: <Swords size={13} />, tone: 'text-orange-300 bg-orange-500/15' },
  streak: { icon: <Flame size={13} />, tone: 'text-emerald-300 bg-emerald-500/15' },
};

function describe(event: FeedEvent, h: HomeText): string {
  switch (event.kind) {
    case 'follow':
      return h('feed.follow');
    case 'raid':
      return h('feed.raid', { n: event.detail });
    case 'gift':
      return h('feed.gift', { n: event.detail });
    case 'redeem':
      return h('feed.redeem', { x: event.detail });
    case 'duel':
      return h('feed.duel', { x: event.detail });
    case 'streak':
      return h('feed.streak', { n: event.detail });
  }
}

export function FeedWidget({ chrome }: WidgetProps) {
  const { h } = useHomeText();
  const now = useNow(30_000);
  const feed = useStatsStore((s) => s.feed);
  const wide = chrome.size >= 8;

  return (
    <WidgetCard id="feed" title={h('w.feed')} icon={<Radio size={15} className="text-rose-300" />} {...chrome}>
      {feed.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center text-[12px] leading-relaxed text-[#9aa3af]">{h('feed.empty')}</div>
      ) : (
        <ul className={cn('-me-1 space-y-1 overflow-y-auto pe-1', wide ? 'max-h-[320px]' : 'max-h-[250px]')}>
          {feed.slice(0, 30).map((event) => (
            <li key={event.id} className="flex items-center gap-2.5 rounded-[8px] px-1.5 py-1.5 hover:bg-white/[0.04]">
              <span className={cn('grid size-[26px] shrink-0 place-items-center rounded-[7px]', KIND[event.kind].tone)}>{KIND[event.kind].icon}</span>
              <p className="min-w-0 flex-1 truncate text-start text-[12px] text-[#cbd3dc]" dir="ltr">
                <bdi className="font-semibold text-white">{event.who}</bdi> {describe(event, h)}
              </p>
              <span className="shrink-0 font-mono text-[10.5px] text-[#9aa3af]">{formatAgo(now - event.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
