import React from 'react';
import { Sparkles, Trash2, Tv } from 'lucide-react';
import {
  CHAT_OVERLAY_AVATAR_FALLBACK,
  formatBidiText,
  isRtlText,
  type NormalizedChatOverlayMessage,
} from '../../../lib/chatOverlay';
import { t } from '../../../i18n/translations';
import { useChatOverlayStore, selectVisibleChatMessages } from '../../../store/chatOverlayStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/Button';

function messageRole(message: NormalizedChatOverlayMessage): string {
  if (message.isBroadcaster) return 'broadcaster';
  if (message.isMod) return 'moderator';
  if (message.isVip) return 'vip';
  if (message.isSubscriber) return 'subscriber';
  return 'viewer';
}

function getBadgeText(role: string, lang: string): string | null {
  if (role === 'broadcaster') return lang === 'ar' ? 'صاحب البث' : 'Host';
  if (role === 'moderator') return lang === 'ar' ? 'مشرف' : 'Mod';
  if (role === 'vip') return 'VIP';
  if (role === 'subscriber') return lang === 'ar' ? 'مشترك' : 'Sub';
  return null;
}

export function ChatPreview() {
  const store = useChatOverlayStore();
  const settings = store.settings;
  const messages = selectVisibleChatMessages(store);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const sendTestMessage = () => {
    const samples = [
      {
        username: 'StreamerHubFan',
        message: lang === 'ar' ? 'السلام عليكم ورحمة الله وبركاته! بث أسطوري 🚀' : 'Hello everyone! The overlay looks incredible 🔥',
        isBroadcaster: false,
        isMod: false,
        isVip: true,
        isSubscriber: true,
      },
      {
        username: 'HammerMod',
        message: lang === 'ar' ? 'تذكير: الالتزام بقواعد الدردشة والتعاون' : '🔨 Moderator check: Chat rules are in effect! Enjoy the stream!',
        isBroadcaster: false,
        isMod: true,
        isVip: false,
        isSubscriber: false,
      },
      {
        username: 'zeen1_th',
        message: lang === 'ar' ? 'اليوم لعبت Sekiro وش فيها؟' : 'Today I played Sekiro, what about it?',
        isBroadcaster: true,
        isMod: false,
        isVip: false,
        isSubscriber: true,
      },
      {
        username: 'GamerHero',
        message: lang === 'ar' ? 'انا اليوم لعبت BG3 و كان افضل لعبة في التاريخ' : 'Today I played BG3 and it was the greatest game in history!',
        isBroadcaster: false,
        isMod: false,
        isVip: false,
        isSubscriber: true,
      },
      {
        username: 'Zeen1th',
        message: lang === 'ar' ? 'شكراً لدعمكم المتواصل ❤️' : 'Welcome in everyone! Thanks for being here ❤️',
        isBroadcaster: true,
        isMod: false,
        isVip: false,
        isSubscriber: true,
      },
      {
        username: 'SubGamer99',
        message: lang === 'ar' ? 'GG يا بطل! لقطة ولا أروع' : 'GG that was an insane play! Clip that right now!',
        isBroadcaster: false,
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

  const getFontFamily = () => {
    switch (settings.fontFamily) {
      case 'cairo':
        return '"Cairo", "Segoe UI", sans-serif';
      case 'cinzel':
        return '"Cinzel", "Georgia", serif';
      case 'jetbrains-mono':
        return '"JetBrains Mono", monospace';
      case 'system':
        return 'ui-sans-serif, system-ui, sans-serif';
      case 'barlow':
      default:
        return '"Barlow", "Segoe UI", sans-serif';
    }
  };

  const getAvatarRadius = () => {
    switch (settings.avatarShape) {
      case 'square':
        return '2px';
      case 'rounded':
        return '8px';
      case 'squircle':
        return '28%';
      case 'circle':
      default:
        return '50%';
    }
  };

  const getCardThemeStyles = (roleColor: string) => {
    const opacity = settings.backgroundOpacity / 100;
    switch (settings.theme) {
      case 'light':
        return {
          backgroundColor: `rgba(250, 248, 244, ${opacity})`,
          borderColor: 'rgba(31, 35, 45, 0.15)',
          color: '#181b22',
          boxShadow: '0 8px 24px rgba(31, 35, 45, 0.12)',
        };
      case 'transparent':
        return {
          backgroundColor: `rgba(10, 12, 18, ${opacity * 0.55})`,
          borderColor: 'rgba(255, 255, 255, 0.16)',
          color: '#ffffff',
          boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
        };
      case 'neon':
        return {
          backgroundColor: `rgba(8, 10, 18, ${opacity})`,
          borderColor: roleColor,
          color: '#ecfeff',
          boxShadow: `0 0 16px ${roleColor}40`,
        };
      case 'ember':
        return {
          backgroundColor: `rgba(26, 18, 14, ${opacity})`,
          borderColor: 'rgba(200, 120, 44, 0.45)',
          color: '#fff7ed',
          boxShadow: '0 0 16px rgba(200, 120, 44, 0.25)',
        };
      case 'dark':
      default:
        return {
          backgroundColor: `rgba(16, 18, 24, ${opacity})`,
          borderColor: 'rgba(255, 255, 255, 0.12)',
          color: '#f7f4ee',
          boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
        };
    }
  };

  const getAlignmentClasses = () => {
    switch (settings.alignment) {
      case 'bottom-right':
      case 'top-right':
        return 'items-start justify-end';
      case 'bottom-left':
      case 'top-left':
      default:
        return 'items-start justify-start';
    }
  };

  const getTransformOrigin = () => {
    switch (settings.alignment) {
      case 'bottom-right':
      case 'top-right':
        return 'top right';
      case 'bottom-left':
      case 'top-left':
      default:
        return 'top left';
    }
  };

  const getAnimationClass = () => {
    switch (settings.animation) {
      case 'slide':
        return 'anim-spring-slide';
      case 'fade':
        return 'anim-float-blur';
      case 'pop':
        return 'anim-bouncy-pop';
      case 'glow':
        return 'anim-energy-flare';
      case 'flip':
        return 'anim-3d-fold';
      case 'off':
      default:
        return '';
    }
  };

  return (
    <div className="slab flex h-full flex-col overflow-hidden">
      {/* Dynamic Keyframes for Live Preview */}
      <style>{`
        @keyframes anim-spring-slide {
          0% { opacity: 0; transform: translate3d(-90px, 0, 0) scale(0.85); }
          70% { opacity: 1; transform: translate3d(8px, 0, 0) scale(1.02); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes anim-float-blur {
          0% { opacity: 0; filter: blur(12px); transform: translateY(32px); }
          100% { opacity: 1; filter: blur(0px); transform: translateY(0); }
        }
        @keyframes anim-bouncy-pop {
          0% { opacity: 0; transform: scale(0.1); }
          55% { opacity: 1; transform: scale(1.22); }
          80% { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        @keyframes anim-energy-flare {
          0% { opacity: 0; transform: translateY(12px) scale(0.9); filter: brightness(2.6) drop-shadow(0 0 35px var(--role-color, #8b5cf6)); }
          60% { opacity: 1; filter: brightness(1.8) drop-shadow(0 0 20px var(--role-color, #8b5cf6)); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: brightness(1) drop-shadow(0 0 0 transparent); }
        }
        @keyframes anim-3d-fold {
          0% { opacity: 0; transform: perspective(800px) rotateX(-80deg) translateY(-30px); transform-origin: top center; }
          100% { opacity: 1; transform: perspective(800px) rotateX(0deg) translateY(0); transform-origin: top center; }
        }
        .anim-spring-slide { animation: anim-spring-slide 340ms cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
        .anim-float-blur { animation: anim-float-blur 300ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-bouncy-pop { animation: anim-bouncy-pop 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .anim-energy-flare { animation: anim-energy-flare 400ms ease-out both; }
        .anim-3d-fold { animation: anim-3d-fold 360ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
      `}</style>

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
      <div
        className={`relative flex min-h-[460px] flex-1 overflow-hidden p-6 bg-[radial-gradient(#8a4f1d15_1px,transparent_1px)] [background-size:16px_16px] ${getAlignmentClasses()}`}
      >
        {/* Transparent checkerboard backdrop */}
        <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(45deg,#0000000a_25%,transparent_25%),linear-gradient(-45deg,#0000000a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#0000000a_75%),linear-gradient(-45deg,transparent_75%,#0000000a_75%)] [background-size:20px_20px] [background-position:0_0,0_10px,10px_-10px,-10px_0px]" />

        {messages.length === 0 ? (
          <div className="relative z-10 m-auto flex flex-col items-center justify-center py-12 text-center">
            <Tv size={28} className="text-primary/60" />
            <div className="mt-3 font-display text-base uppercase tracking-[0.04em] text-ink/70">
              {t(lang, 'chat.preview')}
            </div>
            <div className="mt-1 max-w-sm font-sans text-xs text-ink/55">
              {t(lang, 'chat.previewHint')}
            </div>
            <Button
              className="mt-4"
              size="sm"
              onClick={sendTestMessage}
              title={t(lang, 'chat.mockMessage')}
            >
              <Sparkles size={13} />
              {t(lang, 'chat.mockMessage')}
            </Button>
          </div>
        ) : (
          <div
            className="relative z-10 w-full max-w-[680px]"
            style={
              {
                fontFamily: getFontFamily(),
                transform: `scale(${settings.scale / 100})`,
                transformOrigin: getTransformOrigin(),
                '--font-size': `${settings.fontSize}px`,
                '--avatar-size': `${settings.avatarSize}px`,
                '--message-gap': `${settings.spacing}px`,
              } as React.CSSProperties
            }
          >
            <ol className="flex flex-col justify-start" style={{ gap: 'var(--message-gap)' }}>
              {[...messages].reverse().map((message) => {
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
                const badgeText = getBadgeText(role, lang);
                const themeStyles = getCardThemeStyles(roleColor);
                const animClass = getAnimationClass();
                const cardDir = settings.avatarPosition === 'right' ? 'rtl' : 'ltr';
                const isRtl = isRtlText(message.message);
                const textDir = isRtl ? 'rtl' : 'ltr';
                const formattedText = formatBidiText(message.message, isRtl);

                return (
                  <li
                    key={message.id}
                    dir={cardDir}
                    data-card-dir={cardDir}
                    className={`relative grid items-center overflow-hidden border backdrop-blur-md transition-all duration-200 ${animClass} ${
                      settings.messageStyle === 'square' ? 'rounded-none' : 'rounded-2xl'
                    }`}
                    style={
                      {
                        ...themeStyles,
                        direction: cardDir,
                        textAlign: cardDir === 'rtl' ? 'right' : 'left',
                        '--role-color': roleColor,
                        gridTemplateColumns: settings.showAvatars
                          ? 'auto minmax(0, 1fr)'
                          : 'minmax(0, 1fr)',
                        gap: 'clamp(8px, 1.2vw, 14px)',
                        padding: settings.compactMode ? '7px 13px 8px 11px' : '10px 15px',
                      } as React.CSSProperties
                    }
                  >
                    {/* Role Accent Line */}
                    <div
                      className="absolute inset-y-0 start-0 w-1"
                      style={{ backgroundColor: roleColor }}
                    />

                    {settings.showAvatars && (
                      <img
                        className="object-cover shrink-0"
                        style={{
                          width: 'var(--avatar-size)',
                          height: 'var(--avatar-size)',
                          borderRadius: getAvatarRadius(),
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
                      {settings.compactMode ? (
                        <p
                          className="m-0 break-words font-medium leading-snug"
                          style={{
                            fontSize: 'var(--font-size)',
                            textShadow: settings.textShadow
                              ? '0 1px 3px rgba(0,0,0,0.85)'
                              : 'none',
                          }}
                        >
                          {settings.showBadges && badgeText && (
                            <span
                              className="me-1.5 inline-block text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border align-middle leading-tight"
                              style={{
                                color: roleColor,
                                borderColor: `${roleColor}55`,
                                backgroundColor: `${roleColor}25`,
                              }}
                            >
                              {badgeText}
                            </span>
                          )}
                          {settings.showUsernames && (
                            <span
                              className="me-1.5 font-bold inline align-middle"
                              style={{ color: roleColor }}
                            >
                              {message.username}:
                            </span>
                          )}
                          <span className="align-middle inline" dir={textDir}>
                            {formattedText}
                          </span>
                        </p>
                      ) : (
                        <>
                          {(settings.showUsernames || (settings.showBadges && badgeText)) && (
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              {settings.showBadges && badgeText && (
                                <span
                                  className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border leading-tight"
                                  style={{
                                    color: roleColor,
                                    borderColor: `${roleColor}55`,
                                    backgroundColor: `${roleColor}25`,
                                  }}
                                >
                                  {badgeText}
                                </span>
                              )}
                              {settings.showUsernames && (
                                <span
                                  className="block truncate font-bold leading-tight"
                                  style={{
                                    fontSize: 'max(11px, calc(var(--font-size) * 0.7))',
                                    color: roleColor,
                                    textShadow: settings.textShadow
                                      ? '0 1px 3px rgba(0,0,0,0.85)'
                                      : 'none',
                                  }}
                                >
                                  {message.username}
                                </span>
                              )}
                            </div>
                          )}
                          <p
                            className="m-0 break-words font-medium leading-snug"
                            dir={textDir}
                            style={{
                              fontSize: 'var(--font-size)',
                              textShadow: settings.textShadow
                                ? '0 1px 3px rgba(0,0,0,0.85)'
                                : 'none',
                            }}
                          >
                            <span dir={textDir}>{formattedText}</span>
                          </p>
                        </>
                      )}
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
