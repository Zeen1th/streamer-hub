import React from 'react';
import { Sparkles, Trash2, Tv, WifiOff } from 'lucide-react';
import { CHAT_OVERLAY_AVATAR_FALLBACK, type NormalizedChatOverlayMessage } from '../../../lib/chatOverlay';
import { t } from '../../../i18n/translations';
import { useChatOverlayStore, selectVisibleChatMessages } from '../../../store/chatOverlayStore';
import { useConnectionStore } from '../../../store/connectionStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/Button';

function messageRole(message: NormalizedChatOverlayMessage): string {
  if (message.isBroadcaster) return 'broadcaster';
  if (message.isMod) return 'moderator';
  if (message.isVip) return 'vip';
  if (message.isSubscriber) return 'subscriber';
  return 'viewer';
}

export function ChatPreview() {
  const store = useChatOverlayStore();
  const settings = store.settings;
  const serverState = store.serverState;
  const messages = selectVisibleChatMessages(store);
  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const sendTestMessage = () => {
    const samples = [
      {
        username: 'StreamerHubFan',
        message: lang === 'ar' ? 'السلام عليكم ورحمة الله وبركاته! بث أسطوري 🚀' : 'Hello everyone! The overlay looks amazing 🔥',
        isBroadcaster: false,
        isMod: false,
        isVip: true,
        isSubscriber: true,
      },
      {
        username: 'ModMaster',
        message: lang === 'ar' ? 'تذكير: الالتزام بقواعد الدردشة والتعاون' : 'Reminder to follow chat rules and enjoy the stream!',
        isBroadcaster: false,
        isMod: true,
        isVip: false,
        isSubscriber: false,
      },
      {
        username: 'Zeen1th',
        message: lang === 'ar' ? 'شكراً لدعمكم المتواصل ❤️' : 'Welcome in everyone! Thanks for being here ❤️',
        isBroadcaster: true,
        isMod: false,
        isVip: false,
        isSubscriber: true,
      },
    ];

    const randomSample = samples[Math.floor(Math.random() * samples.length)];
    store.addMessage({
      id: `preview-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      username: randomSample.username,
      message: randomSample.message,
      isBroadcaster: randomSample.isBroadcaster,
      isMod: randomSample.isMod,
      isVip: randomSample.isVip,
      isSubscriber: randomSample.isSubscriber,
      timestamp: new Date().toISOString(),
      avatarUrl: CHAT_OVERLAY_AVATAR_FALLBACK,
    });
  };

  return (
    <div className="slab flex h-full flex-col overflow-hidden">
      {/* Preview Header */}
      <div className="flex items-center justify-between border-b border-ink/15 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Tv size={16} className="text-primary" />
          <h2 className="font-display text-base uppercase tracking-[0.04em] text-ink">
            {t(lang, 'chat.preview')}
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-sans text-xs font-bold uppercase tracking-wider ${
              settings.enabled
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border border-ink/20 bg-ink/5 text-ink/60'
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                settings.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-ink/40'
              }`}
            />
            {settings.enabled ? t(lang, 'chat.enabled') : t(lang, 'chat.disabled')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              title={t(lang, 'chat.clearPreview')}
              onClick={() => store.clearMessages()}
            >
              <Trash2 size={13} />
              {t(lang, 'chat.clearPreview')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            title={t(lang, 'chat.mockMessage')}
            onClick={sendTestMessage}
          >
            <Sparkles size={13} />
            {t(lang, 'chat.mockMessage')}
          </Button>
        </div>
      </div>

      {/* Preview Canvas Area */}
      <div className="relative flex min-h-[380px] flex-1 items-end overflow-hidden p-6 bg-[radial-gradient(#8a4f1d15_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Transparent grid check pattern backdrop */}
        <div className="pointer-events-none absolute inset-0 opacity-25 bg-[linear-gradient(45deg,#0000000a_25%,transparent_25%),linear-gradient(-45deg,#0000000a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#0000000a_75%),linear-gradient(-45deg,transparent_75%,#0000000a_75%)] [background-size:20px_20px] [background-position:0_0,0_10px,10px_-10px,-10px_0px]" />

        {messages.length === 0 ? (
          <div className="relative z-10 flex w-full flex-col items-center justify-center py-12 text-center">
            {!twitchConnected ? (
              <>
                <WifiOff size={28} className="text-ink/40" />
                <div className="mt-3 font-display text-base uppercase tracking-[0.04em] text-ink/70">
                  {t(lang, 'chat.twitchDisconnected')}
                </div>
                <div className="mt-1 max-w-sm font-sans text-xs font-semibold uppercase tracking-[0.1em] text-ink/50">
                  {t(lang, 'chat.twitchDisconnectedHint')}
                </div>
              </>
            ) : serverState === 'unavailable' ? (
              <>
                <WifiOff size={28} className="text-amber-500/60" />
                <div className="mt-3 font-display text-base uppercase tracking-[0.04em] text-ink/70">
                  {t(lang, 'chat.statusUnavailable')}
                </div>
              </>
            ) : !settings.enabled ? (
              <>
                <Tv size={28} className="text-ink/40" />
                <div className="mt-3 font-display text-base uppercase tracking-[0.04em] text-ink/70">
                  {t(lang, 'chat.overlayDisabled')}
                </div>
                <div className="mt-1 max-w-sm font-sans text-xs font-semibold uppercase tracking-[0.1em] text-ink/50">
                  {t(lang, 'chat.overlayDisabledHint')}
                </div>
              </>
            ) : (
              <>
                <Tv size={28} className="text-primary/60" />
                <div className="mt-3 font-display text-base uppercase tracking-[0.04em] text-ink/70">
                  {t(lang, 'chat.waitingMessages')}
                </div>
                <div className="mt-1 max-w-sm font-sans text-xs font-semibold uppercase tracking-[0.1em] text-ink/50">
                  {t(lang, 'chat.waitingMessagesHint')}
                </div>
                <Button
                  className="mt-5 text-xs"
                  onClick={sendTestMessage}
                  title={t(lang, 'chat.mockMessage')}
                >
                  <Sparkles size={14} />
                  {t(lang, 'chat.mockMessage')}
                </Button>
              </>
            )}
          </div>
        ) : (
          <div
            className="chat-preview-viewport relative z-10 w-full"
            data-theme={settings.theme}
            data-shape={settings.messageStyle}
            style={
              {
                '--font-size': `${settings.fontSize}px`,
                '--avatar-size': `${settings.avatarSize}px`,
                '--message-gap': `${settings.spacing}px`,
              } as React.CSSProperties
            }
          >
            <ol
              className="flex flex-col justify-end"
              style={{ gap: 'var(--message-gap)' }}
            >
              {messages.map((message) => {
                const role = messageRole(message);
                const roleColor =
                  role === 'broadcaster'
                    ? '#f43f5e'
                    : role === 'moderator'
                      ? '#22c55e'
                      : role === 'vip'
                        ? '#ec4899'
                        : role === 'subscriber'
                          ? '#38bdf8'
                          : '#8b5cf6';

                return (
                  <li
                    key={message.id}
                    className={`relative grid items-center overflow-hidden border backdrop-blur-md transition-all duration-200 ${
                      settings.messageStyle === 'square' ? 'rounded-none' : 'rounded-2xl'
                    } ${
                      settings.theme === 'light'
                        ? 'border-black/10 bg-white/90 text-neutral-900 shadow-lg'
                        : settings.theme === 'transparent'
                          ? 'border-white/10 bg-black/50 text-white shadow-md'
                          : 'border-white/10 bg-neutral-900/90 text-neutral-100 shadow-xl'
                    }`}
                    style={{
                      gridTemplateColumns: settings.showAvatars ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
                      gap: 'clamp(8px, 1.2vw, 14px)',
                      padding: '10px 14px',
                    }}
                  >
                    {/* Accent role indicator bar */}
                    <div
                      className="absolute inset-y-0 start-0 w-1"
                      style={{ backgroundColor: roleColor }}
                    />

                    {settings.showAvatars && (
                      <img
                        className="rounded-full object-cover shrink-0"
                        style={{
                          width: 'var(--avatar-size)',
                          height: 'var(--avatar-size)',
                          border: `2px solid ${roleColor}`,
                          backgroundColor: '#334155',
                        }}
                        src={message.avatarUrl}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.src = CHAT_OVERLAY_AVATAR_FALLBACK;
                        }}
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      {settings.showUsernames && (
                        <span
                          className="block truncate font-bold leading-tight"
                          style={{
                            fontSize: 'max(11px, calc(var(--font-size) * 0.68))',
                            color: roleColor,
                          }}
                        >
                          {message.username}
                        </span>
                      )}
                      <p
                        className="m-0 break-words font-medium leading-snug"
                        style={{
                          fontSize: 'var(--font-size)',
                        }}
                      >
                        {message.message}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
