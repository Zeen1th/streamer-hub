import { cn } from '../../lib/cn';
import { t } from '../../i18n/translations';
import { rpc } from '../../rpc';
import { Channels } from '../../rpc/contracts';
import { useConnectionStore } from '../../store/connectionStore';
import { useSettingsStore } from '../../store/settingsStore';

type LinkState = 'connected' | 'connecting' | 'disconnected';

const dotClasses: Record<LinkState, string> = {
  connected: 'ember-glow bg-primary',
  connecting: 'animate-pulse border border-primary bg-transparent',
  disconnected: 'border border-ink/40 bg-transparent',
};

interface LinkChipProps {
  label: string;
  state: LinkState;
  detail: string;
  onClick?: () => void;
}

function LinkChip({ label, state, detail, onClick }: LinkChipProps) {
  const inner = (
    <>
      <span aria-hidden className={cn('inline-block size-2 rounded-full', dotClasses[state])} />
      {label}
    </>
  );
  const classes =
    'inline-flex items-center gap-2 font-sans text-xs font-bold tracking-[0.15em] text-ink/75';
  if (onClick) {
    return (
      <button
        type="button"
        title={`${label}: ${detail}`}
        onClick={onClick}
        className={cn(
          classes,
          'cursor-pointer transition-colors duration-150 hover:text-ink',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        )}
      >
        {inner}
      </button>
    );
  }
  return (
    <span title={`${label}: ${detail}`} className={classes}>
      {inner}
    </span>
  );
}

export function ConnectionIndicators() {
  const coreConnected = useConnectionStore((s) => s.coreConnected);
  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const statusReceived = useConnectionStore((s) => s.statusReceived);
  const authRequired = useConnectionStore((s) => s.authRequired);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const twitch: LinkState = !statusReceived ? 'connecting' : twitchConnected ? 'connected' : 'disconnected';
  const core: LinkState = !statusReceived ? 'connecting' : coreConnected ? 'connected' : 'disconnected';

  const twitchDetail = twitchConnected
    ? t(lang, 'twitch.detail.connected', { channel: twitchChannel ?? '' })
    : authRequired
      ? t(lang, 'twitch.detail.auth')
      : t(lang, 'twitch.detail.offline');

  return (
    <div className="flex items-center gap-4">
      <LinkChip
        label={t(lang, 'titlebar.twitch')}
        state={twitch}
        detail={twitchDetail}
        onClick={
          twitchConnected
            ? undefined
            : () => {
                rpc.invoke(Channels.TwitchAuthorize).catch(() => undefined);
              }
        }
      />
      <span aria-hidden className="h-3 w-px bg-ink/20" />
      <LinkChip label={t(lang, 'titlebar.core')} state={core} detail={coreConnected ? 'OK' : 'OFFLINE'} />
    </div>
  );
}
