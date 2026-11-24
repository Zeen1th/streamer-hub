import { Dices } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../../../i18n/translations';
import { DEV_LOGIN } from '../../../lib/devLuck';
import { rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';
import { useSettingsStore } from '../../../store/settingsStore';
import { Card } from '../../ui/Card';

/** Settings > System: shows whether the developer's duel luck is on. Read only; only the developer changes it. */
export function DevLuckStatus() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [luck, setLuck] = useState<{ enabled: boolean; chance: number } | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    rpc
      .invoke(Channels.DevLuckGet, undefined, 4000)
      .then((res) => alive && setLuck(res))
      .catch(() => alive && setLuck(null));
    return () => {
      alive = false;
    };
  }, []);

  const status =
    luck === undefined ? '…' : luck === null ? t(lang, 'devLuck.unknown') : luck.enabled ? t(lang, 'devLuck.on', { chance: luck.chance }) : t(lang, 'devLuck.off');

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <Dices size={17} className="mt-0.5 shrink-0 text-muted" />
          <div className="min-w-0">
            <div className="font-sans text-[13px] font-semibold text-ink">{t(lang, 'devLuck.title')}</div>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{t(lang, 'devLuck.desc', { login: DEV_LOGIN })}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${luck?.enabled ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-white/[0.1] bg-white/[0.04] text-muted'}`}
        >
          {status}
        </span>
      </div>
    </Card>
  );
}
