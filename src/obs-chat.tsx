import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/500.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cairo/800.css';
import '@fontsource/cairo/900.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './index.css';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Send } from 'lucide-react';
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
  | 'emotes'
  | 'reload'
  | 'preview';

const KNOWN_KINDS: readonly EnvelopeKind[] = [
  'hello',
  'chat-message',
  'settings',
  'connected',
  'disconnected',
  'profile',
  'clear',
  'emotes',
  'reload',
  'preview',
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

interface PreviewPayload {
  enabled?: boolean;
  messages?: unknown[];
}

function ObsChatDockApp() {
  const [settings, setSettings] = useState<ChatOverlaySettings>(DEFAULT_CHAT_OVERLAY_SETTINGS);
  const [messages, setMessages] = useState<NormalizedChatOverlayMessage[]>([]);
  const [previewMessages, setPreviewMessages] = useState<NormalizedChatOverlayMessage[] | null>(null);
  const [providers, setProviders] = useState<Record<string, ThirdPartyEmoteMap>>({});
  const [inputMsg, setInputMsg] = useState('');
  const [fit, setFit] = useState(1);

  const seenMessageIds = useRef(new Set<string>());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const wsRef = useRef<WebSocket | null>(null);

  const removeMessage = useCallback((id: string) => {
    setMessages((current) => current.filter((candidate) => candidate.id !== id));
  }, []);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;

    const connect = () => {
      if (disposed) return;
      const host = window.location.host || '127.0.0.1:49178';
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${host}/ws?target=obs-chat`);
      wsRef.current = socket;

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

            setPreviewMessages(null);
            setMessages((current) => [...current, message]);

            const duration = active.flow.durationSeconds;
            if (duration > 0) {
              window.setTimeout(() => removeMessage(message.id), duration * 1000);
            }
            return;
          }
          case 'reload': {
            window.location.reload();
            return;
          }
          case 'preview': {
            const payload = envelope.payload as PreviewPayload;
            if (payload?.enabled && Array.isArray(payload.messages) && payload.messages.length > 0) {
              setPreviewMessages(
                payload.messages.map((m) => normalizeChatOverlayMessage(m as Partial<ChatMessage>)),
              );
            } else {
              setPreviewMessages(null);
            }
            return;
          }
          default:
            return;
        }
      });

      socket.addEventListener('close', () => {
        if (disposed) return;
        retryTimer = window.setTimeout(connect, 1500);
      });

      socket.addEventListener('error', () => {
        socket?.close();
      });
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (socket) {
        socket.close();
        socket = null;
      }
      wsRef.current = null;
    };
  }, [removeMessage]);

  useEffect(() => {
    setMessages((current) => current.slice(-settings.flow.maxMessages));
  }, [settings.flow.maxMessages]);

  useEffect(() => {
    const measure = () => {
      const scale = Math.min(
        window.innerWidth / CHAT_OVERLAY_CANVAS.width,
        (window.innerHeight - 36) / CHAT_OVERLAY_CANVAS.height,
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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMsg.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ kind: 'send-chat', message: text }));
    setInputMsg('');
  };

  const isExact = Math.abs(fit - 1) < 0.001;
  const displayMessages = previewMessages ?? messages;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-transparent">
      {/* Visual Chat Scene */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={isExact ? 'h-full w-full' : 'co-fit'}
          style={isExact ? undefined : { transform: `scale(${fit})`, transformOrigin: 'top left' }}
        >
          <ChatScene
            settings={settings}
            messages={displayMessages}
            thirdParty={thirdParty}
            alwaysRenderBlock={Boolean(previewMessages && previewMessages.length > 0)}
          />
        </div>
      </div>

      {/* Quick Input Bar for Streamer Dock in OBS */}
      <form onSubmit={handleSend} className="flex h-9 shrink-0 items-center gap-1.5 border-t border-white/[0.08] bg-[#1a2228] px-2 select-text">
        <input
          type="text"
          dir="auto"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder="Send message to Twitch..."
          className="h-7 flex-1 rounded bg-[#13171b] px-2 text-xs text-ink outline-none border border-white/[0.1] focus:border-accent"
        />
        <button
          type="submit"
          disabled={!inputMsg.trim()}
          className="flex h-7 items-center justify-center rounded bg-accent px-2.5 text-xs font-semibold text-accent-contrast disabled:opacity-40 cursor-pointer"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}

function parseEnvelope(value: unknown): OverlayEnvelope | null {
  if (typeof value !== 'string') return null;
  try {
    const envelope = JSON.parse(value) as Partial<OverlayEnvelope>;
    if (envelope.v !== 1 || typeof envelope.id !== 'string' || !envelope.id) return null;
    if (typeof envelope.kind !== 'string') return null;
    if (!KNOWN_KINDS.includes(envelope.kind as EnvelopeKind)) return null;
    return envelope as OverlayEnvelope;
  } catch {
    return null;
  }
}

const rootEl = document.getElementById('obs-chat-root');
if (rootEl) {
  createRoot(rootEl).render(<ObsChatDockApp />);
}
