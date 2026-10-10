import { Key } from 'lucide-react';
import { useKeybindStore } from '../../../../store/keybindStore';
import { useToolStore } from '../../../../store/toolStore';
import { Switch } from '../../../ui/Switch';
import { useHomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

const formatChord = (chord: { key: string; modifier?: string }) =>
  [chord.modifier?.toUpperCase(), chord.key?.toUpperCase()].filter(Boolean).join(' + ') || 'None';

export function KeybindsWidget({ chrome }: WidgetProps) {
  const { h } = useHomeText();
  const setTab = useToolStore((s) => s.setTab);
  const setSection = useToolStore((s) => s.setSection);
  const bindings = useKeybindStore((s) => s.bindings);
  const save = useKeybindStore((s) => s.save);
  const allEnabled = bindings.length > 0 && bindings.every((b) => b.enabled);

  return (
    <WidgetCard
      id="keybinds"
      title={h('w.keybinds')}
      icon={<Key size={15} className="text-[#F5B324]" />}
      {...chrome}
      actions={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#9aa3af]">{allEnabled ? h('keybinds.allOn') : h('keybinds.paused')}</span>
          <Switch checked={allEnabled} onChange={(on) => void save(bindings.map((b) => ({ ...b, enabled: on })))} label={h('keybinds.master')} />
        </div>
      }
    >
      <div className="max-h-[170px] space-y-1.5 overflow-y-auto">
        {bindings.length === 0 ? (
          <div className="py-4 text-center text-[11.5px] text-[#9aa3af]">
            {h('keybinds.none')}{' '}
            <button
              type="button"
              onClick={() => {
                setSection('keybinds');
                setTab('settings');
              }}
              className="text-[#a5b4fc] underline"
            >
              {h('keybinds.add')}
            </button>
          </div>
        ) : (
          bindings.slice(0, 5).map((binding) => (
            <div key={binding.id} className="flex items-center justify-between rounded-[7px] border border-white/[0.06] bg-[#1a2228] px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="rounded border border-white/[0.1] bg-black/30 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#f0f3fa]">{formatChord(binding.chord)}</span>
                <span className="truncate text-[11.5px] text-[#9aa3af]">
                  {binding.targetType} · {binding.action}
                </span>
              </div>
              <Switch
                checked={binding.enabled}
                onChange={(checked) => void save(bindings.map((b) => (b.id === binding.id ? { ...b, enabled: checked } : b)))}
                label={`Toggle ${formatChord(binding.chord)}`}
              />
            </div>
          ))
        )}
      </div>
    </WidgetCard>
  );
}
