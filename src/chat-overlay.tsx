import '@fontsource/barlow/500.css';
import '@fontsource/barlow/700.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DEFAULT_CHAT_OVERLAY_SETTINGS,
  normalizeChatOverlayMessage,
  normalizeChatOverlaySettings,
  type NormalizedChatOverlayMessage,
} from './lib/chatOverlay';
import { applyChatFilters } from './lib/chatOverlayFilters';
import { mergeEmoteProviders, type ThirdPartyEmoteMap } from './lib/chatEmotes';
import { ChatScene } from './overlay/ChatScene';
import { CHAT_OVERLAY_CANVAS } from './rpc/contracts';
import type { ChatMessage, ChatOverlaySettings } from './rpc/contracts';

type EnvelopeKind =
  | 'hello'
  | 'chat-message'
  | 'settings'
  | 'connected'
  | 'disconnected'
  | 'profile'
  | 'clear'
  | 'emotes';

const KNOWN_KINDS: readonly EnvelopeKind[] = [
  'hello',
  'chat-message',
  'settings',
  'connected',
  'disconnected',
  'profile',
  'clear',
  'emotes',
];

interface OverlayEnvelope {
  v: number;
  id: string;
  kind: EnvelopeKind;
  payload: unknown;
}

interface HelloPayload {
  settings?: unknown;
  connected?: boolean;
  emotes?: Record<string, ThirdPartyEmoteMap>;
}

interface ProfilePayload {
  userId?: string;
  avatarUrl?: string;
  color?: string;
}

interface ClearPayload {
  scope?: 'message' | 'user' | 'all';
  id?: string;
}

const pageStyles = `
  html, body, #chat-overlay-root {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    background: transparent;
  }
  * { box-sizing: border-box; }
  :root { color-scheme: dark; font-synthesis: none; }
  .co-fit { transform-origin: top left; }
`;

function OverlayApp() {
  const [settings, setSettings] = useState<ChatOverlaySettings>(DEFAULT_CHAT_OVERLAY_SETTINGS);
  const [messages, setMessages] = useState<NormalizedChatOverlayMessage[]>([]);
  const [providers, setProviders] = useState<Record<string, ThirdPartyEmoteMap>>({});
  const [fit, setFit] = useState(1);

  const seenMessageIds = useRef(new Set<string>());
  const reconnectAttempt = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const removeMessage = useCallback((id: string) => {
    setMessages((current) => current.filter((candidate) => candidate.id !== id));
  }, []);

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

        switch (envelope.kind) {
          case 'hello': {
            const payload = envelope.payload as HelloPayload;
            setSettings(normalizeChatOverlaySettings(payload.settings));
            if (payload.emotes) setProviders(payload.emotes);
            return;
          }
          case 'settings': {
            setSettings(normalizeChatOverlaySettings(envelope.payload));
            return;
          }
          case 'emotes': {
            const payload = envelope.payload as { providers?: Record<string, ThirdPartyEmoteMap> };
            setProviders(payload?.providers ?? {});
            return;
          }
          case 'profile': {
            const payload = envelope.payload as ProfilePayload;
            const userId = typeof payload?.userId === 'string' ? payload.userId : '';
            if (!userId) return;
            // Patch avatars onto messages already on screen. Without this, a
            // viewer's first message keeps the fallback silhouette for its
            // entire lifetime even though the real URL has since arrived.
            setMessages((current) =>
              current.map((message) =>
                message.userId === userId
                  ? {
                      ...message,
                      avatarUrl: payload.avatarUrl || message.avatarUrl,
                      color: payload.color || message.color,
                    }
                  : message,
              ),
            );
            return;
          }
          case 'clear': {
            const payload = envelope.payload as ClearPayload;
            if (payload?.scope === 'all') {
              setMessages([]);
            } else if (payload?.scope === 'user' && payload.id) {
              setMessages((current) => current.filter((message) => message.userId !== payload.id));
            } else if (payload?.scope === 'message' && payload.id) {
              setMessages((current) => current.filter((message) => message.id !== payload.id));
            }
            return;
          }
          case 'chat-message': {
            if (seenMessageIds.current.has(envelope.id)) return;

            const raw = envelope.payload as Partial<ChatMessage>;
            const active = settingsRef.current;
            const verdict = applyChatFilters(
              { username: raw?.username ?? '', message: raw?.message ?? '' },
              active.filters,
            );
            if (!verdict.visible) return;

            const message = normalizeChatOverlayMessage({ ...raw, message: verdict.message });
            seenMessageIds.current.add(envelope.id);
            if (seenMessageIds.current.size > 2048) {
              const oldest = seenMessageIds.current.values().next().value;
              if (typeof oldest === 'string') seenMessageIds.current.delete(oldest);
            }

            setMessages((current) => [...current, message]);

            // 0 means messages never expire.
            const duration = active.flow.durationSeconds;
            if (duration > 0) {
              window.setTimeout(() => removeMessage(message.id), duration * 1000);
            }
            return;
          }
          default:
            return;
        }
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
  }, [removeMessage]);

  useEffect(() => {
    setMessages((current) => current.slice(-settings.flow.maxMessages));
  }, [settings.flow.maxMessages]);

  /**
   * The documented setup is a 1920x1080 browser source, where this is exactly 1
   * and no transform is applied at all. If the source is a different size we fit
   * rather than clip - a scaled overlay beats a cropped one - but at 1:1 the
   * output stays untransformed and therefore sharp.
   */
  useEffect(() => {
    const measure = () => {
      const scale = Math.min(
        window.innerWidth / CHAT_OVERLAY_CANVAS.width,
        window.innerHeight / CHAT_OVERLAY_CANVAS.height,
      );
      setFit(Number.isFinite(scale) && scale > 0 ? scale : 1);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const thirdParty = useMemo(
    () => mergeEmoteProviders(providers, settings.emotes),
    [providers, settings.emotes],
  );

  const isExact = Math.abs(fit - 1) < 0.001;

  return (
    <div
      className={isExact ? undefined : 'co-fit'}
      style={isExact ? undefined : { transform: `scale(${fit})` }}
    >
      <ChatScene settings={settings} messages={messages} thirdParty={thirdParty} />
    </div>
  );
}

function parseEnvelope(value: unknown): OverlayEnvelope | null {
  if (typeof value !== 'string') return null;
  try {
    const envelope = JSON.parse(value) as Partial<OverlayEnvelope>;
    if (envelope.v !== 1 || typeof envelope.id !== 'string' || !envelope.id) return null;
    if (typeof envelope.kind !== 'string') return null;
    // Unknown kinds are ignored so a newer host talking to a cached older
    // overlay degrades instead of breaking.
    if (!KNOWN_KINDS.includes(envelope.kind as EnvelopeKind)) return null;
    return envelope as OverlayEnvelope;
  } catch {
    return null;
  }
}

const root = document.getElementById('chat-overlay-root');
if (!root) throw new Error('Chat overlay root was not found.');

const style = document.createElement('style');
style.textContent = pageStyles;
document.head.appendChild(style);
createRoot(root).render(<OverlayApp />);
