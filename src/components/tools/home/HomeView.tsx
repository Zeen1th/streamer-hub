import { useState } from 'react';
import { Gamepad2, LayoutGrid, MessageCircle, Pencil, Plus, RotateCcw, Trophy, Check } from 'lucide-react';
import { useConnectionStore } from '../../../store/connectionStore';
import { useHomeLayoutStore } from '../../../store/homeLayoutStore';
import { useSequenceStore } from '../../../store/sequenceStore';
import { useStatsStore } from '../../../store/statsStore';
import { LAYOUT_PRESETS, availableWidgets, type LayoutItem } from '../../../lib/homeLayout';
import { formatDuration } from '../../../lib/stats';
import { useNow } from '../../../lib/useNow';
import { cn } from '../../../lib/cn';
import { useHomeText, type HomeTextKey } from './homeText';
import { WIDGET_REGISTRY } from './widgetRegistry';

const PRESET_META: Record<string, { icon: typeof Gamepad2; label: HomeTextKey }> = {
  ranked: { icon: Gamepad2, label: 'profile.ranked' },
  chatting: { icon: MessageCircle, label: 'profile.chatting' },
  speedrun: { icon: Trophy, label: 'profile.speedrun' },
};

const sameLayout = (a: readonly LayoutItem[], b: readonly LayoutItem[]) => a.length === b.length && a.every((item, i) => item.id === b[i].id && item.size === b[i].size);

/** Connection status as plain text with a dot, not a pill. */
function StatusChip({ label, on, onText, offText }: { label: string; on: boolean; onText: string; offText: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted" title={`${label}: ${on ? onText : offText}`}>
      <i className={cn('inline-block size-2 rounded-full', on ? 'bg-[#22C55E]' : 'bg-[#F5B324]')} />
      <span className="text-ink">{label}</span>
      <span>{on ? onText : offText}</span>
    </span>
  );
}

export function HomeView() {
  const { h, lang } = useHomeText();
  const now = useNow(30_000);
  const [editing, setEditing] = useState(false);

  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const broadcasterDisplayName = useConnectionStore((s) => s.broadcasterDisplayName);
  const obsConnected = useSequenceStore((s) => s.obsConnected);
  const startedAt = useStatsStore((s) => s.session.startedAt);

  const items = useHomeLayoutStore((s) => s.items);
  const { add, remove, resize, nudge, move, configure, replaceLayout, resetLayout } = useHomeLayoutStore.getState();

  const streamerName = broadcasterDisplayName || (twitchChannel ? twitchChannel.replace(/^#+/, '') : '');
  const hour = new Date(now).getHours();
  const greeting = h(hour < 12 ? 'greet.morning' : hour < 18 ? 'greet.afternoon' : 'greet.evening');
  const addable = availableWidgets(items);

  return (
    <section className="app-scroll min-h-0 flex-1 overflow-y-auto bg-[#23282e] px-5 pb-8 pt-5 text-[#f0f3f7]" data-screen-label="Home">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate text-start font-sans text-[26px] font-semibold leading-8 tracking-tight text-ink" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {greeting}
            {streamerName ? <span>{lang === 'ar' ? ' ' : ', '}<bdi>{streamerName}</bdi></span> : null}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusChip label={h('header.twitch')} on={twitchConnected} onText={h('header.on')} offText={h('header.off')} />
            <StatusChip label={h('header.obs')} on={obsConnected} onText={h('header.on')} offText={h('header.off')} />
            {/* The duration is isolated left-to-right (U+2066..U+2069) so "0m" keeps its order inside Arabic text */}
            <span className="text-[12.5px] text-muted">{h('header.streamFor', { t: `⁦${formatDuration(now - startedAt)}⁩` })}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Layout presets look like the Commands tabs: text, with a short accent bar under the active one */}
          <div className="flex items-center gap-1" role="group" aria-label={h('header.profile')}>
            {LAYOUT_PRESETS.map((preset) => {
              const meta = PRESET_META[preset.id];
              const Icon = meta.icon;
              const active = sameLayout(items, preset.items);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => replaceLayout(preset.items)}
                  aria-pressed={active}
                  className={cn(
                    'relative inline-flex h-[32px] items-center gap-1.5 rounded-[4px] px-3 text-[13px] transition-colors',
                    active
                      ? 'font-semibold text-ink after:absolute after:start-1/2 after:bottom-[1px] after:h-[3px] after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-accent rtl:after:translate-x-1/2'
                      : 'text-muted hover:bg-white/[0.05] hover:text-ink',
                  )}
                >
                  <Icon size={14} aria-hidden />
                  <span>{h(meta.label)}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            className={cn(
              'inline-flex h-[32px] items-center gap-1.5 rounded-[4px] border px-3 text-[13px] font-semibold transition-colors',
              editing ? 'border-transparent bg-accent text-on-accent hover:bg-accent-hover' : 'border-white/[0.08] bg-white/[0.05] text-ink hover:bg-white/[0.09]',
            )}
          >
            {editing ? <Check size={14} /> : <Pencil size={13} />}
            {editing ? h('header.done') : h('header.customize')}
          </button>
        </div>
      </header>

      {editing && (
        <div className="mb-4 rounded-[6px] border border-dashed border-accent/45 bg-accent/[0.06] p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[12px] text-[#cbd3dc]">
              <LayoutGrid size={14} className="text-[#a5b4fc]" />
              {h('edit.hint')}
            </p>
            <button type="button" onClick={resetLayout} className="inline-flex h-[26px] items-center gap-1.5 rounded-[6px] px-2.5 text-[11.5px] text-[#9aa3af] hover:bg-white/[0.08] hover:text-white">
              <RotateCcw size={12} /> {h('edit.reset')}
            </button>
          </div>
          {addable.length === 0 ? (
            <p className="text-[11.5px] text-[#9aa3af]">{h('edit.allAdded')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {addable.map((meta) => {
                const entry = WIDGET_REGISTRY[meta.id];
                return (
                  <button
                    key={meta.id}
                    type="button"
                    onClick={() => add(meta.id)}
                    className="group flex items-start gap-2.5 rounded-[9px] border border-white/[0.08] bg-[#1a2228] p-2.5 text-start transition-colors hover:border-accent/60 hover:bg-white/[0.05]"
                  >
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-[8px] bg-white/[0.06]">{entry.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-white">{h(entry.name)}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-[#9aa3af]">{h(entry.desc)}</span>
                    </span>
                    <Plus size={15} className="mt-0.5 shrink-0 text-[#9aa3af] group-hover:text-white" aria-label={h('edit.add')} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {items.map((item, index) => {
          const Widget = WIDGET_REGISTRY[item.id].component;
          return (
            <Widget
              key={item.id}
              config={item.config ?? {}}
              setConfig={(patch) => configure(item.id, patch)}
              chrome={{
                size: item.size,
                editing,
                isFirst: index === 0,
                isLast: index === items.length - 1,
                onResize: (size) => resize(item.id, size),
                onNudge: (direction) => nudge(item.id, direction),
                onRemove: () => remove(item.id),
                onDropOn: (draggedId) => move(draggedId, item.id),
              }}
            />
          );
        })}
      </div>

      {items.length === 0 && !editing && (
        <div className="grid place-items-center rounded-[10px] border border-dashed border-white/[0.14] py-16 text-center">
          <p className="mb-3 text-[13px] text-[#9aa3af]">{h('edit.hint')}</p>
          <button type="button" onClick={() => setEditing(true)} className="inline-flex h-[30px] items-center gap-1.5 rounded-[4px] bg-accent px-3.5 text-[12px] font-semibold text-on-accent hover:bg-accent-hover">
            <Pencil size={13} /> {h('header.customize')}
          </button>
        </div>
      )}
    </section>
  );
}
