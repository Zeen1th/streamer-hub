import '@fontsource/barlow/500.css';
import '@fontsource/barlow/700.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CHAT_OVERLAY_AVATAR_FALLBACK,
  DEFAULT_CHAT_OVERLAY_SETTINGS,
  formatBidiText,
  isRtlText,
  normalizeChatOverlayMessage,
  normalizeChatOverlaySettings,
  type NormalizedChatOverlayMessage,
} from './lib/chatOverlay';
import type { ChatMessage, ChatOverlaySettings } from './rpc/contracts';

interface OverlayEnvelope {
  v: number;
  id: string;
  kind: 'hello' | 'chat-message' | 'settings' | 'connected' | 'disconnected';
  payload: unknown;
}

interface HelloPayload {
  settings?: Partial<ChatOverlaySettings>;
  connected?: boolean;
}

const styles = `
  :root {
    color-scheme: dark;
    font-synthesis: none;
  }

  * { box-sizing: border-box; }

  html, body, #chat-overlay-root {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    background: transparent;
  }

  body { -webkit-font-smoothing: antialiased; }

  .overlay {
    --bg-opacity: 0.85;
    --overlay-scale: 1;
    --surface: rgba(16, 18, 24, var(--bg-opacity));
    --surface-edge: rgba(255, 255, 255, 0.12);
    --ink: #f7f4ee;
    --muted: #b9bec8;
    --signal: #8b5cf6;
    --shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
    display: flex;
    width: 100%;
    height: 100%;
    padding: clamp(12px, 2.5vw, 32px);
    color: var(--ink);
  }

  .overlay[data-align="bottom-left"] {
    justify-content: flex-start;
    align-items: flex-end;
    --transform-origin: bottom left;
  }
  .overlay[data-align="bottom-right"] {
    justify-content: flex-end;
    align-items: flex-end;
    --transform-origin: bottom right;
  }
  .overlay[data-align="top-left"] {
    justify-content: flex-start;
    align-items: flex-start;
    --transform-origin: top left;
  }
  .overlay[data-align="top-right"] {
    justify-content: flex-end;
    align-items: flex-start;
    --transform-origin: top right;
  }

  .overlay[data-font="barlow"] { font-family: "Barlow", "Segoe UI", sans-serif; }
  .overlay[data-font="cairo"] { font-family: "Cairo", "Segoe UI", sans-serif; }
  .overlay[data-font="cinzel"] { font-family: "Cinzel", "Georgia", serif; }
  .overlay[data-font="jetbrains-mono"] { font-family: "JetBrains Mono", monospace; }
  .overlay[data-font="system"] { font-family: ui-sans-serif, system-ui, sans-serif; }

  .overlay[data-theme="light"] {
    color-scheme: light;
    --surface: rgba(250, 248, 244, var(--bg-opacity));
    --surface-edge: rgba(31, 35, 45, 0.14);
    --ink: #181b22;
    --muted: #606775;
    --signal: #6d28d9;
    --shadow: 0 10px 28px rgba(31, 35, 45, 0.16);
  }

  .overlay[data-theme="transparent"] {
    --surface: rgba(12, 14, 20, calc(var(--bg-opacity) * 0.55));
    --surface-edge: rgba(255, 255, 255, 0.15);
    --shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
  }

  .overlay[data-theme="neon"] {
    --surface: rgba(8, 10, 18, var(--bg-opacity));
    --surface-edge: rgba(6, 182, 212, 0.45);
    --shadow: 0 0 20px rgba(6, 182, 212, 0.25);
    --ink: #ecfeff;
  }

  .overlay[data-theme="ember"] {
    --surface: rgba(26, 18, 14, var(--bg-opacity));
    --surface-edge: rgba(200, 120, 44, 0.45);
    --shadow: 0 0 20px rgba(200, 120, 44, 0.25);
    --ink: #fff7ed;
  }

  .message-list {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: var(--message-gap);
    width: min(760px, 100%);
    margin: 0;
    padding: 0;
    list-style: none;
    transform: scale(var(--overlay-scale));
    transform-origin: var(--transform-origin, bottom left);
  }

  .message {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: clamp(10px, 1.4vw, 16px);
    align-items: center;
    min-height: calc(var(--avatar-size) + 18px);
    padding: 10px 16px 11px 14px;
    overflow: hidden;
    border: 1px solid var(--surface-edge);
    border-radius: 18px;
    background: var(--surface);
    box-shadow: var(--shadow);
    backdrop-filter: blur(12px);
  }

  .message.message--compact {
    padding: 7px 13px 8px 11px;
    min-height: calc(var(--avatar-size) + 12px);
  }

  .message[data-card-dir="rtl"] {
    direction: rtl;
    text-align: right;
  }

  .message[data-card-dir="ltr"] {
    direction: ltr;
    text-align: left;
  }

  .message::before {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    width: 4px;
    background: var(--role-color, var(--signal));
  }

  .overlay[data-shape="square"] .message { border-radius: 3px; }
  .message.message--no-avatar { grid-template-columns: minmax(0, 1fr); }

  .message[data-role="broadcaster"] { --role-color: #f43f5e; }
  .message[data-role="moderator"] { --role-color: #22c55e; }
  .message[data-role="vip"] { --role-color: #ec4899; }
  .message[data-role="subscriber"] { --role-color: #38bdf8; }
  .message[data-role="viewer"] { --role-color: #8b5cf6; }

  /* Distinct Unique Animations */
  .message[data-animation="slide"] {
    animation: anim-spring-slide 340ms cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  }
  .message[data-animation="fade"] {
    animation: anim-float-blur 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .message[data-animation="pop"] {
    animation: anim-bouncy-pop 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  .message[data-animation="glow"] {
    animation: anim-energy-flare 400ms ease-out both;
  }
  .message[data-animation="flip"] {
    animation: anim-3d-fold 360ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .message[data-animation="off"] {
    animation: none !important;
  }

  .avatar {
    width: var(--avatar-size);
    height: var(--avatar-size);
    border: 2px solid color-mix(in srgb, var(--role-color, var(--signal)) 75%, white 25%);
    object-fit: cover;
    background: #334155;
    flex-shrink: 0;
  }

  .overlay[data-avatar-shape="circle"] .avatar { border-radius: 50%; }
  .overlay[data-avatar-shape="rounded"] .avatar { border-radius: 8px; }
  .overlay[data-avatar-shape="square"] .avatar { border-radius: 2px; }
  .overlay[data-avatar-shape="squircle"] .avatar { border-radius: 28%; }

  .message-copy {
    min-width: 0;
    flex: 1 1 auto;
    unicode-bidi: isolate;
  }

  .message-copy[data-dir="rtl"] {
    direction: rtl;
    text-align: right;
  }

  .message-copy[data-dir="ltr"] {
    direction: ltr;
    text-align: left;
  }

  .header-line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
    flex-wrap: wrap;
    unicode-bidi: isolate;
  }

  .username {
    overflow: hidden;
    color: color-mix(in srgb, var(--role-color, var(--signal)) 76%, var(--ink) 24%);
    font-size: max(12px, calc(var(--font-size) * 0.7));
    font-weight: 700;
    letter-spacing: 0.03em;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
    unicode-bidi: isolate;
    display: inline-block;
  }

  .badge-tag {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 1px 5px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--role-color, var(--signal)) 22%, transparent);
    color: var(--role-color, var(--signal));
    border: 1px solid color-mix(in srgb, var(--role-color, var(--signal)) 45%, transparent);
    line-height: 1.2;
    unicode-bidi: isolate;
    display: inline-block;
  }

  .message-text {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--ink);
    font-size: var(--font-size);
    font-weight: 500;
    line-height: 1.35;
    text-wrap: pretty;
    unicode-bidi: isolate;
  }

  .message-text[data-dir="rtl"] {
    direction: rtl;
    text-align: right;
  }

  .message-text[data-dir="ltr"] {
    direction: ltr;
    text-align: left;
  }

  .message-body {
    unicode-bidi: isolate;
    display: inline;
  }

  .overlay[data-text-shadow="true"] .username,
  .overlay[data-text-shadow="true"] .message-text {
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 2px 8px rgba(0, 0, 0, 0.7);
  }

  /* Keyframe Animations */
  @keyframes anim-spring-slide {
    0% {
      opacity: 0;
      transform: translate3d(-90px, 0, 0) scale(0.85);
    }
    70% {
      opacity: 1;
      transform: translate3d(8px, 0, 0) scale(1.02);
    }
    100% {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }
  }

  @keyframes anim-float-blur {
    0% {
      opacity: 0;
      filter: blur(12px);
      transform: translateY(32px);
    }
    100% {
      opacity: 1;
      filter: blur(0px);
      transform: translateY(0);
    }
  }

  @keyframes anim-bouncy-pop {
    0% {
      opacity: 0;
      transform: scale(0.1);
    }
    55% {
      opacity: 1;
      transform: scale(1.22);
    }
    80% {
      transform: scale(0.92);
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes anim-energy-flare {
    0% {
      opacity: 0;
      transform: translateY(12px) scale(0.9);
      filter: brightness(2.6) drop-shadow(0 0 35px var(--role-color, var(--signal)));
    }
    60% {
      opacity: 1;
      filter: brightness(1.8) drop-shadow(0 0 20px var(--role-color, var(--signal)));
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: brightness(1) drop-shadow(0 0 0 transparent);
    }
  }

  @keyframes anim-3d-fold {
    0% {
      opacity: 0;
      transform: perspective(800px) rotateX(-80deg) translateY(-30px);
      transform-origin: top center;
    }
    100% {
      opacity: 1;
      transform: perspective(800px) rotateX(0deg) translateY(0);
      transform-origin: top center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .message { animation: none !important; }
  }
`;

function OverlayApp() {
  const [settings, setSettings] = useState(DEFAULT_CHAT_OVERLAY_SETTINGS);
  const [messages, setMessages] = useState<NormalizedChatOverlayMessage[]>([]);
  const seenMessageIds = useRef(new Set<string>());
  const reconnectAttempt = useRef(0);
  const durationSeconds = useRef(settings.durationSeconds);

  useEffect(() => {
    durationSeconds.current = settings.durationSeconds;
  }, [settings.durationSeconds]);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;
    let retryTimer: number | undefined;

    const connect = () => {
      if (disposed) return;
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${window.location.host}/ws`);

      socket.addEventListener('open', () => {
        reconnectAttempt.current = 0;
      });

      socket.addEventListener('message', (event) => {
        const envelope = parseEnvelope(event.data);
        if (!envelope) return;

        if (envelope.kind === 'hello') {
          const payload = envelope.payload as HelloPayload;
          setSettings(normalizeChatOverlaySettings(payload.settings));
          return;
        }
        if (envelope.kind === 'settings') {
          setSettings(normalizeChatOverlaySettings(envelope.payload as Partial<ChatOverlaySettings>));
          return;
        }
        if (envelope.kind !== 'chat-message' || seenMessageIds.current.has(envelope.id)) return;

        const message = normalizeChatOverlayMessage(envelope.payload as Partial<ChatMessage>);
        seenMessageIds.current.add(envelope.id);
        if (seenMessageIds.current.size > 2048) {
          const oldest = seenMessageIds.current.values().next().value;
          if (typeof oldest === 'string') seenMessageIds.current.delete(oldest);
        }
        setMessages((current) => [...current, message]);
        window.setTimeout(() => {
          setMessages((current) => current.filter((candidate) => candidate.id !== message.id));
        }, durationSeconds.current * 1000);
      });

      socket.addEventListener('close', () => {
        if (disposed) return;
        reconnectAttempt.current += 1;
        const delay = Math.min(5000, 500 * 2 ** Math.min(4, reconnectAttempt.current));
        retryTimer = window.setTimeout(connect, delay);
      });

      socket.addEventListener('error', () => socket?.close());
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    setMessages((current) => current.slice(-settings.maxMessages));
  }, [settings.maxMessages]);

  const visibleMessages = settings.displayMode === 'latest' ? messages.slice(-1) : messages.slice(-settings.maxMessages);

  // If overlay is disabled or has 0 messages, render completely transparent empty canvas
  if (!settings.enabled || visibleMessages.length === 0) {
    return <main className="overlay" style={{ background: 'transparent' }} />;
  }

  return (
    <main
      className="overlay"
      data-theme={settings.theme}
      data-shape={settings.messageStyle}
      data-font={settings.fontFamily}
      data-avatar-shape={settings.avatarShape}
      data-text-shadow={settings.textShadow ? 'true' : 'false'}
      data-align={settings.alignment}
      style={
        {
          '--bg-opacity': `${settings.backgroundOpacity / 100}`,
          '--overlay-scale': `${settings.scale / 100}`,
          '--font-size': `${settings.fontSize}px`,
          '--avatar-size': `${settings.avatarSize}px`,
          '--message-gap': `${settings.spacing}px`,
        } as React.CSSProperties
      }
    >
      <ol className="message-list" aria-live="polite" aria-relevant="additions removals">
        {visibleMessages.map((message) => {
          const role = messageRole(message);
          const badgeText = getBadgeText(role);
          const isRtl = isRtlText(message.message);
          const cardDir = settings.avatarPosition === 'right' ? 'rtl' : 'ltr';
          const textDir = isRtl ? 'rtl' : 'ltr';
          const formattedText = formatBidiText(message.message, isRtl);

          return (
            <li
              className={`message${settings.showAvatars ? '' : ' message--no-avatar'}${settings.compactMode ? ' message--compact' : ''}`}
              data-animation={settings.animation}
              data-role={role}
              data-card-dir={cardDir}
              dir={cardDir}
              key={message.id}
            >
              {settings.showAvatars && (
                <img
                  className="avatar"
                  src={message.avatarUrl}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.src = CHAT_OVERLAY_AVATAR_FALLBACK;
                  }}
                />
              )}
              <div className="message-copy">
                {settings.compactMode ? (
                  <p className="message-text">
                    {settings.showBadges && badgeText && (
                      <span className="badge-tag me-1.5 align-middle">{badgeText}</span>
                    )}
                    {settings.showUsernames && (
                      <span className="username font-bold me-1.5 inline align-middle">
                        {message.username}:
                      </span>
                    )}
                    <span className="message-body align-middle" dir={textDir}>
                      {formattedText}
                    </span>
                  </p>
                ) : (
                  <>
                    {(settings.showUsernames || (settings.showBadges && badgeText)) && (
                      <div className="header-line">
                        {settings.showBadges && badgeText && (
                          <span className="badge-tag">{badgeText}</span>
                        )}
                        {settings.showUsernames && (
                          <span className="username">{message.username}</span>
                        )}
                      </div>
                    )}
                    <p
                      className="message-text"
                      dir={textDir}
                      style={{ textAlign: isRtl ? (cardDir === 'rtl' ? 'right' : 'left') : (cardDir === 'rtl' ? 'right' : 'left') }}
                    >
                      <span className="message-body" dir={textDir}>{formattedText}</span>
                    </p>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

function parseEnvelope(value: unknown): OverlayEnvelope | null {
  if (typeof value !== 'string') return null;
  try {
    const envelope = JSON.parse(value) as Partial<OverlayEnvelope>;
    if (envelope.v !== 1 || typeof envelope.id !== 'string' || !envelope.id || typeof envelope.kind !== 'string') return null;
    if (!['hello', 'chat-message', 'settings', 'connected', 'disconnected'].includes(envelope.kind)) return null;
    return envelope as OverlayEnvelope;
  } catch {
    return null;
  }
}

function messageRole(message: NormalizedChatOverlayMessage): string {
  if (message.isBroadcaster) return 'broadcaster';
  if (message.isMod) return 'moderator';
  if (message.isVip) return 'vip';
  if (message.isSubscriber) return 'subscriber';
  return 'viewer';
}

function getBadgeText(role: string): string | null {
  if (role === 'broadcaster') return 'Host';
  if (role === 'moderator') return 'Mod';
  if (role === 'vip') return 'VIP';
  if (role === 'subscriber') return 'Sub';
  return null;
}

const root = document.getElementById('chat-overlay-root');
if (!root) throw new Error('Chat overlay root was not found.');

const style = document.createElement('style');
style.textContent = styles;
document.head.appendChild(style);
createRoot(root).render(<OverlayApp />);
