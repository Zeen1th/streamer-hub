import { t } from '../../../i18n/translations';
import { useToolStore } from '../../../store/toolStore';
import { Card } from '../../ui/Card';
import { Switch } from '../../ui/Switch';
import { ActivityLog } from '../counter/ActivityLog';

/** Settings > System: the full troubleshooting log (it used to be its own Activity page) and the Commands log bar switch. */
export function LogCard({ lang }: { lang: 'en' | 'ar' }) {
  const logBarVisible = useToolStore((s) => s.logBarVisible);
  const setLogBarVisible = useToolStore((s) => s.setLogBarVisible);

  return (
    <Card title={t(lang, 'settings.logTitle')}>
      <p className="mb-4 text-xs leading-relaxed text-ink/60">{t(lang, 'settings.logDesc')}</p>
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-ink/10 pb-4">
        <div className="flex flex-col">
          <span className="font-sans text-[13px] font-semibold text-ink">{t(lang, 'settings.logBar')}</span>
          <span className="mt-0.5 text-xs text-ink/60">{t(lang, 'settings.logBarHint')}</span>
        </div>
        <Switch checked={logBarVisible} onChange={setLogBarVisible} label={t(lang, 'settings.logBar')} />
      </div>
      <ActivityLog embedded />
    </Card>
  );
}
