import { SegmentedControl } from '../../ui/SegmentedControl';
import { Input } from '../../ui/Input';
import { t } from '../../../i18n/translations';
import type { AutoReply, PermissionLevel } from '../../../rpc/contracts';

interface TriggerRestrictionsProps {
  rule: AutoReply;
  lang: 'en' | 'ar';
  update(id: string, patch: Partial<AutoReply>): void;
}

export function TriggerRestrictions({ rule, lang, update }: TriggerRestrictionsProps) {
  const ranks: { value: PermissionLevel; label: string }[] = [
    { value: 'everyone', label: t(lang, 'ranks.everyone') },
    { value: 'subscriber', label: t(lang, 'ranks.subscriber') },
    { value: 'vip', label: t(lang, 'ranks.vip') },
    { value: 'mod', label: t(lang, 'ranks.mod') },
    { value: 'broadcaster', label: t(lang, 'ranks.broadcaster') },
  ];

  return (
    <div className="space-y-4 border border-ink/15 bg-surface-2 p-4">
      <div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.restrictions')}</div>
      <div>
        <div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.minimumRank')}</div>
        <div className="mt-2">
          <SegmentedControl name={`minimum-rank-${rule.id}`} value={rule.minimumRank ?? 'everyone'} options={ranks} onChange={(minimumRank) => update(rule.id, { minimumRank })} />
        </div>
      </div>
      <label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
        {t(lang, 'autoReplies.triggerCooldown')}
        <Input className="mt-2 max-w-32" dir="ltr" type="number" min={0} max={3600} value={rule.cooldownSeconds} onChange={(event) => update(rule.id, { cooldownSeconds: Math.max(0, Math.min(3600, Number(event.target.value) || 0)) })} />
      </label>
      <label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
        {t(lang, 'autoReplies.userCooldown')}
        <Input className="mt-2 max-w-32" dir="ltr" type="number" min={0} max={3600} value={rule.userCooldownSeconds ?? 0} onChange={(event) => update(rule.id, { userCooldownSeconds: Math.max(0, Math.min(3600, Number(event.target.value) || 0)) })} />
      </label>
    </div>
  );
}
