import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { t } from '../../../i18n/translations';
import type { AutoReply, TitleCounter } from '../../../rpc/contracts';
import { Channels } from '../../../rpc/contracts';
import { rpc } from '../../../rpc';
import { renderStreamTitle } from '../../../lib/autoReplyRules';
import { useAutoReplyStore } from '../../../store/autoReplyStore';
import { FeatureKeybindEditor } from '../settings/FeatureKeybindEditor';

interface TriggerTitleActionProps {
  rule: AutoReply;
  lang: 'en' | 'ar';
  update(id: string, patch: Partial<AutoReply>): void;
}

export function TriggerTitleAction({ rule, lang, update }: TriggerTitleActionProps) {
  const counters = rule.titleCounters?.length ? rule.titleCounters : [{ id: 'count1', start: rule.titleStart ?? 1, count: rule.titleCount ?? rule.titleStart ?? 1 }];
  const updateCounters = (next: TitleCounter[]) => update(rule.id, { titleCounters: next, titleStart: next[0]?.start ?? 1, titleCount: next[0]?.count ?? 1 });
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [liveTwitchTitle, setLiveTwitchTitle] = useState<string | null>(null);

  const fetchLiveTitle = () => {
    rpc.invoke(Channels.TwitchGetTitle).then((res) => {
      if (res.ok && res.title) setLiveTwitchTitle(res.title);
    }).catch(() => undefined);
  };

  useEffect(() => {
    if (!rule.titleActionEnabled) return;
    fetchLiveTitle();
  }, [rule.id, rule.titleActionEnabled]);

  const applyTitle = async () => {
    if (!rule.titleTemplate?.trim()) return;
    setApplyStatus(lang === 'ar' ? 'جارٍ التطبيق...' : 'Applying...');
    let currentLive: string | null = null;
    try {
      const titleRes = await rpc.invoke(Channels.TwitchGetTitle);
      if (titleRes.ok && titleRes.title) currentLive = titleRes.title;
    } catch {}

    const values = Object.fromEntries(counters.map((counter, index) => ['count' + (index + 1), counter.count]));
    const titleToApply = renderStreamTitle(rule.titleTemplate, values, currentLive).trim();
    if (!titleToApply) return;

    const result = await rpc.invoke(Channels.TwitchUpdateTitle, { title: titleToApply });
    if (result.ok) {
      setApplyStatus(lang === 'ar' ? 'تم تطبيق العنوان' : 'Title applied');
      fetchLiveTitle();
      setTimeout(() => setApplyStatus(null), 3000);
    } else {
      setApplyStatus(result.error ?? (lang === 'ar' ? 'تعذر تطبيق العنوان' : 'Could not apply title'));
    }
  };

  const detachTitle = async () => {
    setApplyStatus(lang === 'ar' ? 'جارٍ الإزالة...' : 'Detaching...');
    const ok = await useAutoReplyStore.getState().detachTitleAction(rule.id);
    if (ok) {
      setApplyStatus(t(lang, 'workspace.detachedTitle'));
      fetchLiveTitle();
      setTimeout(() => setApplyStatus(null), 3000);
    } else {
      setApplyStatus(lang === 'ar' ? 'تعذر إزالة العداد' : 'Failed to detach');
    }
  };

  return (
    <div className="border border-ink/15 bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.titleAction')}</div>
          <p className="mt-1 font-sans text-xs text-ink/60">{t(lang, 'autoReplies.titleActionHint')}</p>
        </div>
      </div>
      {rule.titleActionEnabled && <div className="mt-4 space-y-3">
        <label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
          {t(lang, 'autoReplies.titleTemplate')}
          <Input className="mt-2" dir="ltr" value={rule.titleTemplate ?? ''} onChange={(event) => update(rule.id, { titleTemplate: event.target.value })} placeholder="{title} | BG3 act {count1} · part {count2}" />
        </label>
        {!rule.titleTemplate?.includes('{title}') && !rule.titleTemplate?.includes('{current_title}') && (
          <p className="font-sans text-xs text-ink/60">{t(lang, 'workspace.titlePlaceholderHint')}</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
            {t(lang, 'autoReplies.titleIncreaseCommand')}
            <Input className="mt-2" dir="auto" value={rule.titleIncreaseCommand ?? ''} onChange={(event) => update(rule.id, { titleIncreaseCommand: event.target.value })} placeholder="next" />
          </label>
          <label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
            {t(lang, 'autoReplies.titleDecreaseCommand')}
            <Input className="mt-2" dir="auto" value={rule.titleDecreaseCommand ?? ''} onChange={(event) => update(rule.id, { titleDecreaseCommand: event.target.value })} placeholder="previous" />
          </label>
        </div>
        <p className="font-sans text-xs text-ink/60">{t(lang, 'autoReplies.titleCommandHint')}</p>
        <div className="space-y-2">
          {counters.map((counter, index) => <div key={counter.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
              {`{count${index + 1}}`} · {t(lang, 'autoReplies.titleStart')}
              <Input className="mt-2" dir="ltr" type="number" min={0} max={999999} value={counter.count} onChange={(event) => { const count = Math.max(0, Math.min(999999, Number(event.target.value) || 0)); updateCounters(counters.map((item, itemIndex) => itemIndex === index ? { ...item, count } : item)); }} />
            </label>
            {counters.length > 1 && <Button variant="ghost" size="sm" onClick={() => updateCounters(counters.filter((_, itemIndex) => itemIndex !== index))} aria-label={t(lang, 'autoReplies.titleRemoveCounter')} title={t(lang, 'autoReplies.titleRemoveCounter')}><X size={15} /></Button>}
          </div>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => updateCounters([...counters, { id: `count${counters.length + 1}`, start: 1, count: 1 }])}><Plus size={13} />{t(lang, 'autoReplies.titleAddCounter')}</Button>
          <Button variant="outline" size="sm" onClick={() => updateCounters(counters.map((counter) => ({ ...counter, count: counter.start })))}>{t(lang, 'autoReplies.titleReset')}</Button>
          <Button size="sm" onClick={applyTitle} disabled={!rule.titleTemplate?.trim()}>{t(lang, 'workspace.applyTitle')}</Button>
          <Button variant="outline" size="sm" onClick={detachTitle} title={t(lang, 'workspace.detachTitle')}>{t(lang, 'workspace.detachTitle')}</Button>
          {applyStatus && <span className="self-center font-sans text-xs text-accent-text">{applyStatus}</span>}
        </div>
        {liveTwitchTitle && (
          <div className="flex items-center gap-1 font-mono text-[11px] text-muted">
            <span>{t(lang, 'workspace.liveTwitchTitle')}:</span>
            <strong className="truncate text-ink">{liveTwitchTitle}</strong>
          </div>
        )}
        <FeatureKeybindEditor lang={lang} targetType="title" targetId={rule.id} />
      </div>}
    </div>
  );
}
