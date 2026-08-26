import '@fontsource/barlow/500.css';
import '@fontsource/barlow/700.css';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CHAT_OVERLAY_AVATAR_FALLBACK,
  DEFAULT_CHAT_OVERLAY_SETTINGS,
  normalizeChatOverlayMessage,
  normalizeChatOverlaySettings,
  type NormalizedChatOverlayMessage,
} from './lib/chatOverlay';
import type { ChatMessage, ChatOverlaySettings } from './rpc/contracts';

type ServerState = 'connecting' | 'online' | 'offline';

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
    font-family: "Barlow", "Segoe UI", sans-serif;
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
    --surface: rgba(16, 18, 24, 0.88);
    --surface-edge: rgba(255, 255, 255, 0.1);
    --ink: #f7f4ee;
    --muted: #b9bec8;
    --signal: #8b5cf6;
    --shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
    display: flex;
    align-items: flex-end;
    width: 100%;
    height: 100%;
    padding: clamp(12px, 2.5vw, 32px);
    color: var(--ink);
  }

  .overlay[data-theme="light"] {
    color-scheme: light;
    --surface: rgba(250, 248, 244, 0.94);
    --surface-edge: rgba(31, 35, 45, 0.13);
    --ink: #1f232d;
    --muted: #606775;
    --signal: #6d28d9;
    --shadow: 0 12px 32px rgba(31, 35, 45, 0.16);
  }

  .overlay[data-theme="transparent"] {
    --surface: rgba(16, 18, 24, 0.58);
    --surface-edge: rgba(255, 255, 255, 0.13);
    --shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
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
  }

  .message {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: clamp(10px, 1.4vw, 16px);
    align-items: center;
    min-height: calc(var(--avatar-size) + 20px);
    padding: 10px 16px 11px 13px;
    overflow: hidden;
    border: 1px solid var(--surface-edge);
    border-radius: 18px;
    background: var(--surface);
    box-shadow: var(--shadow);
    backdrop-filter: blur(12px);
  }

  .message::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: var(--role-color, var(--signal));
  }

  .overlay[data-shape="square"] .message { border-radius: 4px; }
  .message.message--no-avatar { grid-template-columns: minmax(0, 1fr); }

  .message[data-role="broadcaster"] { --role-color: #f43f5e; }
  .message[data-role="moderator"] { --role-color: #22c55e; }
  .message[data-role="vip"] { --role-color: #ec4899; }
  .message[data-role="subscriber"] { --role-color: #38bdf8; }

  .message[data-animation="slide"] { animation: signal-in 300ms cubic-bezier(.2,.8,.2,1) both; }
  .message[data-animation="fade"] { animation: fade-in 260ms ease-out both; }

  .avatar {
    width: var(--avatar-size);
    height: var(--avatar-size);
    border: 2px solid color-mix(in srgb, var(--role-color, var(--signal)) 68%, white 32%);
    border-radius: 50%;
    object-fit: cover;
    background: #334155;
  }

  .message-copy { min-width: 0; }

  .username {
    display: block;
    margin-bottom: 2px;
    overflow: hidden;
    color: color-mix(in srgb, var(--role-color, var(--signal)) 74%, var(--ink) 26%);
    font-size: max(12px, calc(var(--font-size) * 0.68));
    font-weight: 700;
    letter-spacing: 0.035em;
    line-height: 1.05;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .message-text {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--ink);
    font-size: var(--font-size);
    font-weight: 500;
    line-height: 1.25;
    text-wrap: pretty;
  }

  .status {
    width: min(520px, 100%);
    padding: 16px 18px 17px 21px;
    border: 1px solid var(--surface-edge);
    border-left: 4px solid var(--signal);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow);
    backdrop-filter: blur(12px);
  }

  .status strong {
    display: block;
    margin-bottom: 3px;
    font-size: 16px;
    letter-spacing: 0.02em;
  }

  .status span {
    color: var(--muted);
    font-size: 14px;
    line-height: 1.35;
  }

  @keyframes signal-in {
    from { opacity: 0; transform: translate3d(-24px, 8px, 0) scale(.985); }
    to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .message { animation: none !important; }
  }
`;

function OverlayApp() {
  const [settings, setSettings] = useState(DEFAULT_CHAT_OVERLAY_SETTINGS);
  const [messages, setMessages] = useState<NormalizedChatOverlayMessage[]>([]);
  const [serverState, setServerState] = useState<ServerState>('connecting');
  const [twitchConnected, setTwitchConnected] = useState(false);
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
      setServerState(reconnectAttempt.current === 0 ? 'connecting' : 'offline');
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${window.location.host}/ws`);

      socket.addEventListener('open', () => {
        reconnectAttempt.current = 0;
        setServerState('online');
      });

      socket.addEventListener('message', (event) => {
        const envelope = parseEnvelope(event.data);
        if (!envelope) return;

        if (envelope.kind === 'hello') {
          const payload = envelope.payload as HelloPayload;
          setSettings(normalizeChatOverlaySettings(payload.settings));
          setTwitchConnected(payload.connected === true);
          return;
        }
        if (envelope.kind === 'settings') {
          setSettings(normalizeChatOverlaySettings(envelope.payload as Partial<ChatOverlaySettings>));
          return;
        }
        if (envelope.kind === 'connected' || envelope.kind === 'disconnected') {
          setTwitchConnected(envelope.kind === 'connected');
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
        setServerState('offline');
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
  const status = getStatus(serverState, twitchConnected, settings.enabled, visibleMessages.length);

  return (
    <main
      className="overlay"
      data-theme={settings.theme}
      data-shape={settings.messageStyle}
      style={{
        '--font-size': `${settings.fontSize}px`,
        '--avatar-size': `${settings.avatarSize}px`,
        '--message-gap': `${settings.spacing}px`,
      } as React.CSSProperties}
    >
      {status ? (
        <div className="status" role="status" aria-live="polite">
          <strong>{status.title}</strong>
          <span>{status.detail}</span>
        </div>
      ) : (
        <ol className="message-list" aria-live="polite" aria-relevant="additions removals">
          {visibleMessages.map((message) => (
            <li
              className={`message${settings.showAvatars ? '' : ' message--no-avatar'}`}
              data-animation={settings.animation}
              data-role={messageRole(message)}
              key={message.id}
            >
              {settings.showAvatars && (
                <img
                  className="avatar"
                  src={message.avatarUrl}
                  alt=""
                  onError={(event) => { event.currentTarget.src = CHAT_OVERLAY_AVATAR_FALLBACK; }}
                />
              )}
              <div className="message-copy">
                {settings.showUsernames && <span className="username">{message.username}</span>}
                <p className="message-text">{message.message}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
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

function getStatus(server: ServerState, twitch: boolean, enabled: boolean, messageCount: number) {
  if (server === 'offline') return {
    title: 'Streamer Hub is not running',
    detail: 'Open Streamer Hub to restore this chat overlay. It will reconnect automatically.',
  };
  if (server === 'connecting') return {
    title: 'Connecting to Streamer Hub',
    detail: 'The local chat service is starting.',
  };
  if (!enabled) return {
    title: 'Chat overlay is disabled',
    detail: 'Enable it in Streamer Hub before going live.',
  };
  if (!twitch) return {
    title: 'Twitch chat is disconnected',
    detail: 'Reconnect Twitch in Streamer Hub. This overlay will stay ready.',
  };
  if (messageCount === 0) return {
    title: 'Waiting for chat',
    detail: 'New Twitch messages will appear here.',
  };
  return null;
}

const root = document.getElementById('chat-overlay-root');
if (!root) throw new Error('Chat overlay root was not found.');

const style = document.createElement('style');
style.textContent = styles;
document.head.appendChild(style);
createRoot(root).render(<OverlayApp />);
