import { Plus, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Switch } from '../../ui/Switch';
import { t } from '../../../i18n/translations';
import type { AutoReply, TitleCounter } from '../../../rpc/contracts';

interface TriggerTitleActionProps {
  rule: AutoReply;
  lang: 'en' | 'ar';
  update(id: string, patch: Partial<AutoReply>): void;
}

export function TriggerTitleAction({ rule, lang, update }: TriggerTitleActionProps) {
  const counters = rule.titleCounters?.length ? rule.titleCounters : [{ id: 'count1', start: rule.titleStart ?? 1, count: rule.titleCount ?? rule.titleStart ?? 1 }];
  const updateCounters = (next: TitleCounter[]) => update(rule.id, { titleCounters: next, titleStart: next[0]?.start ?? 1, titleCount: next[0]?.count ?? 1 });

  return (
    <div className="border border-ink/15 bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.titleAction')}</div>
          <p className="mt-1 font-sans text-xs text-ink/60">{t(lang, 'autoReplies.titleActionHint')}</p>
        </div>
        <Switch checked={rule.titleActionEnabled ?? false} onChange={(enabled) => update(rule.id, { titleActionEnabled: enabled })} label={t(lang, 'autoReplies.titleActionEnabled')} />
      </div>
      {rule.titleActionEnabled && <div className="mt-4 space-y-3">
        <label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
          {t(lang, 'autoReplies.titleTemplate')}
          <Input className="mt-2" dir="ltr" value={rule.titleTemplate ?? ''} onChange={(event) => update(rule.id, { titleTemplate: event.target.value })} placeholder="BG3 act {count1} · part {count2}" />
        </label>
        <div className="space-y-2">
          {counters.map((counter, index) => <div key={counter.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
              {`{count${index + 1}}`} · {t(lang, 'autoReplies.titleStart')}
              <Input className="mt-2" dir="ltr" type="number" min={0} max={999999} value={counter.start} onChange={(event) => { const start = Math.max(0, Math.min(999999, Number(event.target.value) || 0)); updateCounters(counters.map((item, itemIndex) => itemIndex === index ? { ...item, start, count: start } : item)); }} />
            </label>
            <div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
              {t(lang, 'autoReplies.titleNextCount')}
              <div dir="ltr" className="mt-2 border border-ink/15 bg-surface px-3 py-2 font-mono text-sm text-ink">{counter.count}</div>
            </div>
            {counters.length > 1 && <Button variant="ghost" size="sm" onClick={() => updateCounters(counters.filter((_, itemIndex) => itemIndex !== index))} aria-label={t(lang, 'autoReplies.titleRemoveCounter')} title={t(lang, 'autoReplies.titleRemoveCounter')}><X size={15} /></Button>}
          </div>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => updateCounters([...counters, { id: `count${counters.length + 1}`, start: 1, count: 1 }])}><Plus size={13} />{t(lang, 'autoReplies.titleAddCounter')}</Button>
          <Button variant="outline" size="sm" onClick={() => updateCounters(counters.map((counter) => ({ ...counter, count: counter.start })))}>{t(lang, 'autoReplies.titleReset')}</Button>
        </div>
      </div>}
    </div>
  );
}
