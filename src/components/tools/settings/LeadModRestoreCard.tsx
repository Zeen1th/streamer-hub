import { CheckCircle2, LogIn, LogOut, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../../i18n/translations';
import { rpc } from '../../../rpc';
import { Channels, type TwitchDashboardState } from '../../../rpc/contracts';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Switch } from '../../ui/Switch';

/**
 * Settings > Twitch: give Lead Moderator back after a smart timeout. Twitch has no API for that role, so the app
 * uses a Twitch dashboard window the streamer logs into once and ticks the box in Roles Manager for them.
 */
export function LeadModRestoreCard() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [state, setState] = useState<TwitchDashboardState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await rpc.invoke(Channels.TwitchDashboardGetState, undefined));
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void load();
    // The login happens in its own window: check again when the streamer comes back to the app
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const run = async (work: () => Promise<TwitchDashboardState | void>) => {
    setBusy(true);
    try {
      const next = await work();
      if (next) setState(next);
      else await load();
    } catch {
      await load();
    } finally {
      setBusy(false);
    }
  };

  const loggedIn = !!state?.login;
  const wrongAccount = loggedIn && !state?.matchesChannel;

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <span>{t(lang, 'leadModRestore.title')}</span>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[12px] leading-relaxed text-muted">{t(lang, 'leadModRestore.desc')}</p>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-[#11131a] p-3">
          <div className="flex min-w-0 items-center gap-2 text-[12.5px]">
            {loggedIn && !wrongAccount ? (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
            ) : (
              <TriangleAlert size={15} className="shrink-0 text-amber-400" />
            )}
            <span className="min-w-0">
              {!loggedIn
                ? t(lang, 'leadModRestore.notLoggedIn')
                : wrongAccount
                  ? t(lang, 'leadModRestore.wrongAccount', { login: state?.login ?? '', channel: state?.channel ?? '' })
                  : t(lang, 'leadModRestore.loggedIn', { login: state?.login ?? '' })}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void run(async () => { await rpc.invoke(Channels.TwitchDashboardLogin, undefined); })}>
              <LogIn size={13} />
              {loggedIn ? t(lang, 'leadModRestore.openDashboard') : t(lang, 'leadModRestore.login')}
            </Button>
            {loggedIn && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => rpc.invoke(Channels.TwitchDashboardLogout, undefined))}>
                <LogOut size={13} />
                {t(lang, 'leadModRestore.logout')}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-ink">{t(lang, 'leadModRestore.enable')}</div>
            <div className="mt-0.5 text-[11px] text-muted">{t(lang, 'leadModRestore.enableHint')}</div>
          </div>
          <Switch
            checked={!!state?.enabled}
            onChange={(enabled) => void run(() => rpc.invoke(Channels.TwitchDashboardSetEnabled, { enabled }))}
            label={t(lang, 'leadModRestore.enable')}
          />
        </div>

        <p className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200">
          {t(lang, 'leadModRestore.risk')}
        </p>
      </div>
    </Card>
  );
}
