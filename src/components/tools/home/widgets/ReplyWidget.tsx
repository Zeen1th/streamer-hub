import { Bot } from 'lucide-react';
import { useAutoReplyStore } from '../../../../store/autoReplyStore';
import { useToolStore } from '../../../../store/toolStore';
import { Switch } from '../../../ui/Switch';
import { useHomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

export function ReplyWidget({ chrome, config, setConfig }: WidgetProps) {
  const { h } = useHomeText();
  const setTab = useToolStore((s) => s.setTab);
  const rules = useAutoReplyStore((s) => s.rules);
  const updateRule = useAutoReplyStore((s) => s.update);
  const active = rules.find((r) => r.id === config.ruleId) || rules[0];

  return (
    <WidgetCard id="reply" title={h('w.reply')} icon={<Bot size={15} className="text-[#c4b5fd]" />} {...chrome}>
      {active ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {rules.length > 1 ? (
                <select
                  value={active.id}
                  onChange={(e) => setConfig({ ruleId: e.target.value })}
                  className="h-[28px] max-w-[150px] rounded-[6px] border border-white/[0.08] bg-[#1a2228] px-2 font-sans text-[12px] font-bold text-white outline-none"
                >
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.triggers[0] || h('reply.command')} ({r.responseMode === 'ai' ? 'AI' : 'Reply'})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="truncate font-sans text-[13px] font-bold text-white" dir="auto">{active.triggers[0] || h('reply.command')}</span>
              )}
              <span className="shrink-0 rounded bg-purple-500/20 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-purple-300">
                {active.responseMode === 'ai' ? h('reply.ai') : h('reply.prepared')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#9aa3af]">{active.enabled ? h('reply.active') : h('reply.disabled')}</span>
              <Switch checked={active.enabled} onChange={(enabled) => updateRule(active.id, { enabled })} label={h('reply.toggle')} />
            </div>
          </div>
          <div className="line-clamp-2 rounded-[8px] border border-white/[0.08] bg-[#1a2228] p-2.5 font-sans text-[12px] text-[#cbd3dc]" dir="auto">
            {active.responseMode === 'ai' ? active.aiInstructions || h('reply.aiDefault') : active.response || '—'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#9aa3af]">
            <span>{h('reply.cooldown', { n: active.cooldownSeconds })}</span>
            <span>{h('reply.rank', { r: active.minimumRank || h('reply.everyone') })}</span>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-[12px] text-[#9aa3af]">
          {h('reply.none')}{' '}
          <button type="button" onClick={() => setTab('commands')} className="text-[#a5b4fc] underline">
            {h('reply.create')}
          </button>
        </div>
      )}
    </WidgetCard>
  );
}
