import { Input } from '../../ui/Input';
import { t } from '../../../i18n/translations';
import { useAutoReplyStore } from '../../../store/autoReplyStore';

export function TriggerGlobalSettings({ lang }: { lang: 'en' | 'ar' }) {
  const settings = useAutoReplyStore((state) => state.globalSettings);
  const update = useAutoReplyStore((state) => state.updateGlobalSettings);
  const value = (key: 'globalAiCooldownSeconds' | 'globalAiUserCooldownSeconds') => settings[key];
  const setValue = (key: 'globalAiCooldownSeconds' | 'globalAiUserCooldownSeconds', next: string) =>
    update({ [key]: Math.max(0, Math.min(3600, Number(next) || 0)) });

  return (
    <div className="border-t border-rule bg-surface py-3">
      <div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-muted">{t(lang, 'autoReplies.globalSettings')}</div>
      <p className="mt-1 font-sans text-xs text-muted">{t(lang, 'autoReplies.globalSettingsHint')}</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-muted">
          {t(lang, 'autoReplies.globalAiCooldown')}
          <Input className="mt-2" dir="ltr" type="number" min={0} max={3600} value={value('globalAiCooldownSeconds')} onChange={(event) => setValue('globalAiCooldownSeconds', event.target.value)} />
        </label>
        <label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-muted">
          {t(lang, 'autoReplies.globalAiUserCooldown')}
          <Input className="mt-2" dir="ltr" type="number" min={0} max={3600} value={value('globalAiUserCooldownSeconds')} onChange={(event) => setValue('globalAiUserCooldownSeconds', event.target.value)} />
        </label>
      </div>
    </div>
  );
}
