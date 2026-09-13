import { t } from '../../i18n/translations';
import { rpc } from '../../rpc';
import { Channels } from '../../rpc/contracts';
import { useConnectionStore } from '../../store/connectionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { cn } from '../../lib/cn';

export function ConnectionIndicators() {
  const connected = useConnectionStore((s) => s.twitchConnected);
  const statusReceived = useConnectionStore((s) => s.statusReceived);
  const channel = useConnectionStore((s) => s.twitchChannel);
  const authRequired = useConnectionStore((s) => s.authRequired);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const label = connected && channel ? `@${channel.replace(/^#/, '')}` : t(lang, 'workspace.notConnected');
  const detail = !statusReceived
    ? t(lang, 'workspace.connecting')
    : connected
      ? t(lang, 'twitch.detail.connected', { channel: channel ?? '' })
      : authRequired
        ? t(lang, 'twitch.detail.auth')
        : t(lang, 'twitch.detail.offline');

  return (
    <button
      type="button"
      title={detail}
      disabled={!statusReceived || connected}
      onClick={() => rpc.invoke(Channels.TwitchAuthorize).catch(() => undefined)}
      className={cn(
        'flex h-[24px] my-auto items-center gap-1.5 px-2.5 font-mono text-[11px] font-semibold rounded-md transition-all',
        connected
          ? 'text-slate-200 bg-surface-3/60 border border-rule'
          : 'text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full shrink-0',
          connected
            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'
            : 'bg-amber-400 animate-pulse',
        )}
      />
      <span dir="ltr">{label}</span>
    </button>
  );
}
