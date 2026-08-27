import React from 'react';
import { CHAT_OVERLAY_AVATAR_FALLBACK, isRtlText, type NormalizedChatOverlayMessage } from '../lib/chatOverlay';
import type { ThirdPartyEmoteMap } from '../lib/chatEmotes';
import { twitchAvatarUrl } from '../lib/imageVariants';
import type { ChatOverlaySettings } from '../rpc/contracts';
import { MessageBody, isEmoteOnlyMessage } from './MessageBody';

/** The parts of a message that can be selected and styled independently. */
export type ChatOverlayPart = 'bubble' | 'avatar' | 'username' | 'badge' | 'text';

export type OverlayLanguage = 'en' | 'ar';

export interface ChatMessageCardProps {
  message: NormalizedChatOverlayMessage;
  settings: ChatOverlaySettings;
  thirdParty?: ThirdPartyEmoteMap;
  lang?: OverlayLanguage;
  /** Editor only. Highlights the selected part. */
  selectedPart?: ChatOverlayPart | null;
  /** Editor only. Present in edit mode; absent on the broadcast overlay. */
  onSelectPart?: (part: ChatOverlayPart) => void;
}

export function messageRole(message: NormalizedChatOverlayMessage): string {
  if (message.isBroadcaster) return 'broadcaster';
  if (message.isMod) return 'moderator';
  if (message.isVip) return 'vip';
  if (message.isSubscriber) return 'subscriber';
  return 'viewer';
}

export function badgeLabel(role: string, lang: OverlayLanguage): string | null {
  if (role === 'broadcaster') return lang === 'ar' ? 'صاحب البث' : 'Host';
  if (role === 'moderator') return lang === 'ar' ? 'مشرف' : 'Mod';
  if (role === 'vip') return 'VIP';
  if (role === 'subscriber') return lang === 'ar' ? 'مشترك' : 'Sub';
  return null;
}

export function ChatMessageCard({
  message,
  settings,
  thirdParty,
  lang = 'en',
  selectedPart = null,
  onSelectPart,
}: ChatMessageCardProps) {
  const role = messageRole(message);
  const badge = badgeLabel(role, lang);
  const isRtl = isRtlText(message.message);
  const textDir = isRtl ? 'rtl' : 'ltr';
  const cardDir = settings.avatar.position === 'right' ? 'rtl' : 'ltr';
  const emoteOnly = isEmoteOnlyMessage(message.message, message.emotes, thirdParty, settings.emotes);

  const editable = typeof onSelectPart === 'function';
  const select = (part: ChatOverlayPart) => (event: React.MouseEvent) => {
    if (!editable) return;
    event.stopPropagation();
    onSelectPart?.(part);
  };

  const partProps = (part: ChatOverlayPart) => ({
    'data-part': part,
    'data-selected': selectedPart === part ? 'true' : undefined,
    onClick: editable ? select(part) : undefined,
  });

  const showUsername = settings.username.show;
  const showBadge = settings.badges.show && badge !== null;
  const avatarMode = settings.avatar.show ? settings.avatar.position : 'none';

  // The user's own Twitch colour wins when that mode is selected and they have one.
  const usernameStyle =
    settings.username.colorMode === 'twitch' && message.color
      ? { color: message.color }
      : undefined;

  return (
    <li
      className="co-message"
      data-role={role}
      data-animation={settings.animation.kind}
      data-avatar={avatarMode}
      data-card-dir={cardDir}
      dir={cardDir}
      {...partProps('bubble')}
    >
      {settings.bubble.accent.width > 0 && <span className="co-accent" aria-hidden />}

      {settings.avatar.show && (
        <img
          className="co-avatar"
          src={twitchAvatarUrl(message.avatarUrl)}
          alt=""
          width={settings.avatar.size}
          height={settings.avatar.size}
          data-pending={message.avatarUrl === CHAT_OVERLAY_AVATAR_FALLBACK ? 'true' : undefined}
          onError={(event) => {
            event.currentTarget.src = CHAT_OVERLAY_AVATAR_FALLBACK;
          }}
          {...partProps('avatar')}
        />
      )}

      <div className="co-copy" data-dir={textDir}>
        {(showUsername || showBadge) && (
          <div className="co-header">
            {showBadge && (
              <span className="co-badge" {...partProps('badge')}>
                {badge}
              </span>
            )}
            {showUsername && (
              <span className="co-username" style={usernameStyle} {...partProps('username')}>
                {message.username}
              </span>
            )}
          </div>
        )}
        <p className="co-text" dir={textDir} data-emote-only={emoteOnly ? 'true' : undefined} {...partProps('text')}>
          <MessageBody
            text={message.message}
            emotes={message.emotes}
            thirdParty={thirdParty}
            settings={settings.emotes}
            isRtl={isRtl}
          />
        </p>
      </div>
    </li>
  );
}
