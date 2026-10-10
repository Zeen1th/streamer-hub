import { Minus, Plus, RotateCcw, Tally5 } from 'lucide-react';
import { useCounterStore } from '../../../../store/counterStore';
import { Button } from '../../../ui/Button';
import { Switch } from '../../../ui/Switch';
import { useHomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

export function CounterWidget({ chrome, config, setConfig }: WidgetProps) {
  const { h } = useHomeText();
  const counters = useCounterStore((s) => s.counters);
  const incrementManual = useCounterStore((s) => s.incrementManual);
  const decrementManual = useCounterStore((s) => s.decrementManual);
  const resetManual = useCounterStore((s) => s.resetManual);
  const applyTitle = useCounterStore((s) => s.applyTitle);
  const detachTitle = useCounterStore((s) => s.detachTitle);
  const addCounter = useCounterStore((s) => s.addCounter);
  const active = counters.find((c) => c.id === config.counterId) || counters[0];

  return (
    <WidgetCard id="counter" title={h('w.counter')} icon={<Tally5 size={15} className="text-[#a5b4fc]" />} {...chrome}>
      {active ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {counters.length > 1 ? (
                <select
                  value={active.id}
                  onChange={(e) => setConfig({ counterId: e.target.value })}
                  className="h-[28px] max-w-[160px] rounded-[6px] border border-white/[0.08] bg-[#1a2228] px-2 font-sans text-[12px] font-bold text-white outline-none"
                >
                  {counters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="truncate font-sans text-[14px] font-bold text-white" dir="auto">{active.name}</span>
              )}
              <span className="font-mono text-[10px] text-[#9aa3af]">(!{active.commands.increase.commandName})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-[30px] w-[32px] p-0" disabled={active.count <= 0} onClick={() => decrementManual(active.id)} title={h('counter.decrement')}>
                <Minus size={13} />
              </Button>
              <Button size="sm" className="h-[30px] w-[32px] p-0" onClick={() => incrementManual(active.id)} title={h('counter.increment')}>
                <Plus size={13} />
              </Button>
              <Button size="sm" variant="outline" className="h-[30px] w-[32px] p-0" onClick={() => resetManual(active.id)} title={h('counter.reset')}>
                <RotateCcw size={12} />
              </Button>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[42px] font-extrabold leading-none tracking-tight text-[#a5b4fc]">{String(active.count).padStart(3, '0')}</span>
            <span className="min-w-0 truncate text-[11.5px] text-[#9aa3af]">
              {active.obs.enabled ? h('counter.syncing', { f: active.obs.filePath || 'OBS file' }) : h('counter.obsOff')}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-[8px] border border-white/[0.08] bg-[#1a2228] p-2.5">
            <div className="min-w-0 flex-1 pe-3">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-white">
                <span>{h('counter.titleSync')}</span>
                {active.titleEnabled && <span className="rounded-[4px] bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9.5px] text-emerald-300">{h('counter.live')}</span>}
              </div>
              <div className="mt-0.5 truncate font-mono text-[10.5px] text-[#9aa3af]">{active.titleTemplate}</div>
            </div>
            <Switch
              checked={Boolean(active.titleEnabled)}
              onChange={(checked) => {
                if (checked) void applyTitle(active.id);
                else void detachTitle(active.id);
              }}
              label={h('counter.toggleSync')}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <p className="mb-3 text-[12px] text-[#9aa3af]">{h('counter.none')}</p>
          <Button size="sm" onClick={() => addCounter()}>
            <Plus size={13} /> {h('counter.add')}
          </Button>
        </div>
      )}
    </WidgetCard>
  );
}
