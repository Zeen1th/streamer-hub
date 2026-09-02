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
        'flex h-full items-center gap-1.5 px-2 font-mono text-[10px] font-medium disabled:opacity-100',
        connected ? 'text-muted' : 'text-accent-text',
      )}
    >
      <span aria-hidden className={cn('size-[7px] border', connected ? 'border-ink bg-ink' : 'border-accent bg-transparent')} />
      <span dir="ltr">{label}</span>
    </button>
  );
}
