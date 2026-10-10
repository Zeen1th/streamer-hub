import { useState } from 'react';
import { Play, Zap } from 'lucide-react';
import { useConnectionStore } from '../../../../store/connectionStore';
import { useSequenceStore } from '../../../../store/sequenceStore';
import { useToolStore } from '../../../../store/toolStore';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { cn } from '../../../../lib/cn';
import { useHomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

export function QuickRunWidget({ chrome }: WidgetProps) {
  const { h } = useHomeText();
  const setTab = useToolStore((s) => s.setTab);
  const sequences = useSequenceStore((s) => s.sequences);
  const runningId = useSequenceStore((s) => s.activeRunningSequenceId);
  const runSequence = useSequenceStore((s) => s.runSequence);
  const channel = useConnectionStore((s) => s.twitchChannel)?.replace(/^#+/, '') || 'Streamer';
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const list = [...sequences]
    .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name))
    .filter((s) => !q || s.name.toLowerCase().includes(q));

  return (
    <WidgetCard id="quickrun" title={h('w.quickrun')} icon={<Zap size={15} className="text-yellow-300" />} {...chrome}>
      {sequences.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
          <p className="text-[12px] text-[#9aa3af]">{h('run.none')}</p>
          <Button size="sm" variant="outline" onClick={() => setTab('commands')}>
            {h('run.create')}
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {sequences.length > 5 && <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={h('run.filter')} className="h-[28px]" dir="auto" />}
          <ul className="-me-1 max-h-[240px] space-y-1.5 overflow-y-auto pe-1">
            {list.map((seq) => {
              const running = runningId === seq.id;
              return (
                <li key={seq.id} className="flex items-center gap-2 rounded-[8px] border border-white/[0.06] bg-[#1a2228] px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className={cn('truncate text-[12.5px] font-semibold', seq.enabled ? 'text-white' : 'text-[#9aa3af] line-through')} dir="auto">
                      {seq.name}
                    </div>
                    <div className="truncate font-mono text-[10.5px] text-[#9aa3af]">
                      {seq.enabled ? `${seq.steps.length} steps${seq.chatTrigger ? ` · ${seq.chatTrigger}` : ''}` : h('run.disabled')}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!seq.enabled || running || runningId !== null}
                    onClick={() =>
                      void runSequence(seq.id, {
                        username: channel,
                        userLogin: channel.toLowerCase(),
                        source: 'test',
                        userInput: '',
                      })
                    }
                    className="h-[26px] shrink-0 px-2.5"
                  >
                    <Play size={11} /> {running ? h('run.running') : h('run.go')}
                  </Button>
                </li>
              );
            })}
            {list.length === 0 && <li className="py-3 text-center text-[12px] text-[#9aa3af]">{h('run.noMatch')}</li>}
          </ul>
        </div>
      )}
    </WidgetCard>
  );
}
