import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Clock, Gift, Gem, Heart, MessageSquare, Plus, Rocket, RotateCcw, SlidersHorizontal, Swords, Users, X } from 'lucide-react';
import { useConnectionStore } from '../../../../store/connectionStore';
import { useStatsStore } from '../../../../store/statsStore';
import { activitySeries, formatCompact, formatDuration, isIgnoredUser, recentRate } from '../../../../lib/stats';
import { useNow } from '../../../../lib/useNow';
import { moveInList } from '../../../../lib/listOrder';
import { cn } from '../../../../lib/cn';
import { useHomeText, type HomeTextKey } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

type TileId = 'time' | 'messages' | 'chatters' | 'follows' | 'raids' | 'gifts' | 'redemptions' | 'duels';

const ALL_TILES: TileId[] = ['time', 'messages', 'chatters', 'follows', 'gifts', 'raids', 'redemptions', 'duels'];
const DEFAULT_TILES: TileId[] = ['time', 'messages', 'chatters', 'follows', 'gifts', 'raids'];

const TILE_META: Record<TileId, { label: HomeTextKey; icon: ReactNode; tone: string }> = {
  time: { label: 'pulse.time', icon: <Clock size={13} />, tone: 'text-emerald-300 bg-emerald-500/15' },
  messages: { label: 'pulse.messages', icon: <MessageSquare size={13} />, tone: 'text-sky-300 bg-sky-500/15' },
  chatters: { label: 'pulse.chatters', icon: <Users size={13} />, tone: 'text-violet-300 bg-violet-500/15' },
  follows: { label: 'pulse.follows', icon: <Heart size={13} />, tone: 'text-rose-300 bg-rose-500/15' },
  raids: { label: 'pulse.raids', icon: <Rocket size={13} />, tone: 'text-amber-300 bg-amber-500/15' },
  gifts: { label: 'pulse.gifts', icon: <Gift size={13} />, tone: 'text-fuchsia-300 bg-fuchsia-500/15' },
  redemptions: { label: 'pulse.redemptions', icon: <Gem size={13} />, tone: 'text-cyan-300 bg-cyan-500/15' },
  duels: { label: 'pulse.duels', icon: <Swords size={13} />, tone: 'text-orange-300 bg-orange-500/15' },
};

function parseTiles(raw: string | undefined): TileId[] {
  if (raw === undefined) return DEFAULT_TILES;
  // The saved order is the display order
  const seen = new Set<string>();
  return raw.split(',').filter((t): t is TileId => (ALL_TILES as string[]).includes(t) && !seen.has(t) && !!seen.add(t));
}

export function PulseWidget({ chrome, config, setConfig }: WidgetProps) {
  const { h } = useHomeText();
  const now = useNow(15_000);
  const [picking, setPicking] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const broadcaster = useConnectionStore((s) => s.twitchChannel);
  const session = useStatsStore((s) => s.session);
  const minutes = useStatsStore((s) => s.minutes);
  const rev = useStatsStore((s) => s.rev);
  const newStream = useStatsStore((s) => s.newStream);
  const tiles = parseTiles(config.tiles);

  const { chatters, perMinute } = useMemo(() => {
    const login = broadcaster?.replace(/^#+/, '');
    const count = Object.values(session.users).filter((u) => u.messages > 0 && !isIgnoredUser(u.login, login, true)).length;
    return { chatters: count, perMinute: recentRate(activitySeries(minutes, Date.now(), 5)) };
    // rev changes whenever the (mutated) maps do
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, session, minutes, broadcaster, now]);

  const values: Record<TileId, { value: string; hint?: string }> = {
    time: { value: formatDuration(now - session.startedAt) },
    messages: { value: formatCompact(session.totals.messages), hint: h('pulse.perMin', { n: perMinute.toFixed(1).replace(/\.0$/, '') }) },
    chatters: { value: formatCompact(chatters) },
    follows: { value: formatCompact(session.totals.follows) },
    raids: { value: formatCompact(session.totals.raidViewers), hint: session.totals.raids ? `×${session.totals.raids}` : undefined },
    gifts: { value: formatCompact(session.totals.gifts) },
    redemptions: { value: formatCompact(session.totals.redemptions) },
    duels: { value: formatCompact(session.totals.duels) },
  };

  const saveTiles = (next: TileId[]) => setConfig({ tiles: next.join(',') });
  const hiddenTiles = ALL_TILES.filter((t) => !tiles.includes(t));
  const [dragTile, setDragTile] = useState<TileId | null>(null);
  const [overTile, setOverTile] = useState<TileId | null>(null);

  return (
    <WidgetCard
      id="pulse"
      title={h('w.pulse')}
      icon={<Clock size={15} className="text-emerald-300" />}
      {...chrome}
      actions={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            aria-pressed={picking}
            className={cn('flex h-[24px] items-center gap-1 rounded-[6px] px-2 text-[11px] hover:bg-white/[0.08]', picking ? 'bg-white/[0.1] text-white' : 'text-[#9aa3af]')}
          >
            <SlidersHorizontal size={12} /> {h('pulse.tiles')}
          </button>
          <button
            type="button"
            title={h('pulse.newStreamHint')}
            onClick={() => {
              if (!confirmNew) {
                setConfirmNew(true);
                window.setTimeout(() => setConfirmNew(false), 4000);
                return;
              }
              setConfirmNew(false);
              newStream();
            }}
            className={cn('flex h-[24px] items-center gap-1 rounded-[6px] px-2 text-[11px]', confirmNew ? 'bg-rose-500/25 text-rose-100' : 'text-[#9aa3af] hover:bg-white/[0.08]')}
          >
            <RotateCcw size={12} /> {h('pulse.newStream')}
          </button>
        </div>
      }
    >
      {picking && (
        <div className="mb-3 space-y-2.5 rounded-[9px] border border-white/[0.07] bg-[#1a2228] p-3">
          <div>
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#9aa3af]">{h('pulse.shown')}</p>
            <div className="flex flex-wrap gap-1.5">
              {tiles.map((id, index) => (
                <span
                  key={id}
                  draggable
                  onDragStart={(e) => {
                    setDragTile(id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/x-pulse-tile', id);
                  }}
                  onDragEnd={() => {
                    setDragTile(null);
                    setOverTile(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragTile) return;
                    e.preventDefault();
                    setOverTile(id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragTile && dragTile !== id) saveTiles(moveInList(tiles, tiles.indexOf(dragTile), index));
                    setDragTile(null);
                    setOverTile(null);
                  }}
                  className={cn(
                    'inline-flex h-[28px] cursor-grab items-center gap-1 rounded-full border bg-[#6366f1]/20 ps-2.5 pe-1 text-[11px] font-medium text-white active:cursor-grabbing',
                    overTile === id && dragTile !== id ? 'border-[#a5b4fc] ring-2 ring-[#6366f1]/40' : 'border-[#6366f1]',
                    dragTile === id && 'opacity-40',
                  )}
                >
                  {TILE_META[id].icon}
                  {h(TILE_META[id].label)}
                  <button type="button" disabled={index === 0} onClick={() => saveTiles(moveInList(tiles, index, index - 1))} title={h('edit.moveEarlier')} aria-label={h('edit.moveEarlier')} className="ms-1 grid size-[18px] place-items-center rounded-full hover:bg-white/[0.15] disabled:opacity-30">
                    <ArrowLeft size={11} />
                  </button>
                  <button type="button" disabled={index === tiles.length - 1} onClick={() => saveTiles(moveInList(tiles, index, index + 1))} title={h('edit.moveLater')} aria-label={h('edit.moveLater')} className="grid size-[18px] place-items-center rounded-full hover:bg-white/[0.15] disabled:opacity-30">
                    <ArrowRight size={11} />
                  </button>
                  <button type="button" onClick={() => saveTiles(tiles.filter((t) => t !== id))} title={h('pulse.removeTile')} aria-label={h('pulse.removeTile')} className="grid size-[18px] place-items-center rounded-full text-rose-200 hover:bg-rose-500/25">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>
          {hiddenTiles.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#9aa3af]">{h('pulse.hidden')}</p>
              <div className="flex flex-wrap gap-1.5">
                {hiddenTiles.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => saveTiles([...tiles, id])}
                    className="inline-flex h-[28px] items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 text-[11px] font-medium text-[#9aa3af] hover:border-white/[0.2] hover:text-white"
                  >
                    <Plus size={11} />
                    {TILE_META[id].icon}
                    {h(TILE_META[id].label)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((id) => (
          <div key={id} className="min-w-0 rounded-[9px] border border-white/[0.07] bg-[#1a2228] p-3">
            <div className="flex items-center gap-1.5">
              <span className={cn('grid size-[22px] place-items-center rounded-[6px]', TILE_META[id].tone)}>{TILE_META[id].icon}</span>
              <span className="truncate text-[11px] font-medium text-[#9aa3af]">{h(TILE_META[id].label)}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-[24px] font-bold leading-none tracking-tight text-white">{values[id].value}</span>
              {values[id].hint && <span className="truncate font-mono text-[10.5px] text-[#9aa3af]">{values[id].hint}</span>}
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
