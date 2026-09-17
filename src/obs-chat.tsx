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
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './index.css';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, AtSign, Ban, Clock, MessageSquare, Send, Trash2 } from 'lucide-react';
import {
  ensureReadableColor,
  formatBidiText,
  isRtlText,
  normalizeChatOverlayMessage,
  normalizeChatOverlaySettings,
  type NormalizedChatOverlayMessage,
} from './lib/chatOverlay';
import { applyChatFilters } from './lib/chatOverlayFilters';
import { mergeEmoteProviders, tokenizeMessage, type ThirdPartyEmoteMap } from './lib/chatEmotes';
import type { ChatMessage, ChatOverlaySettings, EmoteRange } from './rpc/contracts';
import { DEFAULT_CHAT_OVERLAY_SETTINGS } from './lib/chatOverlay';
import { resolveFontStack } from './overlay/tokens';
import { loadSavedDockSettings, type ObsChatDockSettings } from './store/obsChatStore';

type EnvelopeKind =
  | 'hello'
  | 'chat-message'
  | 'settings'
  | 'connected'
  | 'disconnected'
  | 'profile'
  | 'clear'
  | 'emotes'
  | 'reload';

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

interface DockMessageItem extends NormalizedChatOverlayMessage {
  deleted?: boolean;
  isLeadMod?: boolean;
}

function ObsChatDockApp() {
  const [settings, setSettings] = useState<ChatOverlaySettings>(DEFAULT_CHAT_OVERLAY_SETTINGS);
  const [dockSettings, setDockSettings] = useState<ObsChatDockSettings>(() => loadSavedDockSettings());
  const [messages, setMessages] = useState<DockMessageItem[]>([]);
  const [providers, setProviders] = useState<Record<string, ThirdPartyEmoteMap>>({});
  const [connected, setConnected] = useState(false);
  const [inputMsg, setInputMsg] = useState('');
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = Number(localStorage.getItem('streamer-hub-obs-dock-font-size'));
      if ([12, 13, 14, 16].includes(saved)) return saved;
    }
    return 13;
  });
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const seenMessageIds = useRef(new Set<string>());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLength = useRef(0);

  // Dynamically inject custom font stylesheet when provided
  useEffect(() => {
    const url = dockSettings.customFontUrl?.trim();
    let link = document.getElementById('obs-chat-custom-font') as HTMLLinkElement | null;
    if (url) {
      if (!link) {
        link = document.createElement('link');
        link.id = 'obs-chat-custom-font';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = url;
    } else if (link) {
      link.remove();
    }
  }, [dockSettings.customFontUrl]);

  const fontStack = useMemo(() => {
    return resolveFontStack({
      family: dockSettings.fontFamily || 'system',
      customName: dockSettings.customFontName || '',
    });
  }, [dockSettings.fontFamily, dockSettings.customFontName]);

  const changeFontSize = (size: number) => {
    setFontSize(size);
    setDockSettings((prev) => {
      const next = { ...prev, fontSize: size, nameFontSize: size, textFontSize: size };
      try {
        localStorage.setItem('streamer-hub-obs-chat-settings', JSON.stringify(next));
        localStorage.setItem('streamer-hub-obs-dock-font-size', String(size));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Auto-scroll handler
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const added = messages.length - prevMessagesLength.current;
    prevMessagesLength.current = messages.length;

    if (!isScrolledUp) {
      el.scrollTop = el.scrollHeight;
      setNewMessagesCount(0);
    } else if (added > 0) {
      setNewMessagesCount((c) => c + added);
    }
  }, [messages.length, isScrolledUp]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const scrolledUp = distanceFromBottom > 60;
    setIsScrolledUp(scrolledUp);
    if (!scrolledUp) {
      setNewMessagesCount(0);
    }
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setIsScrolledUp(false);
    setNewMessagesCount(0);
  };

  // Connect WebSocket to /ws?target=obs-chat
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

      socket.addEventListener('open', () => {
        if (!disposed) setConnected(true);
      });

      socket.addEventListener('message', (event) => {
        const envelope = parseEnvelope(event.data);
        if (!envelope) return;

        switch (envelope.kind) {
          case 'hello': {
            const payload = envelope.payload as HelloPayload;
            const norm = normalizeChatOverlaySettings(payload.settings);
            setSettings(norm);
            if (payload.emotes) setProviders(payload.emotes);
            const rawDock = (payload.settings as any)?.dockSettings;
            if (rawDock) {
              setDockSettings((prev) => ({ ...prev, ...rawDock }));
            } else {
              setDockSettings((prev) => ({
                ...prev,
                showAvatars: typeof norm.avatar?.show === 'boolean' ? norm.avatar.show : prev.showAvatars,
                showBadges: typeof norm.badges?.show === 'boolean' ? norm.badges.show : prev.showBadges,
                nameFontSize: norm.username?.size || prev.nameFontSize,
                textFontSize: norm.text?.size || prev.textFontSize,
                fontFamily: (norm.text?.font?.family as any) || prev.fontFamily,
                customFontName: norm.text?.font?.customName || prev.customFontName,
                customFontUrl: (payload.settings as any)?.customFontUrl || prev.customFontUrl,
              }));
            }
            return;
          }
          case 'settings': {
            const norm = normalizeChatOverlaySettings(envelope.payload);
            setSettings(norm);
            const rawDock = (envelope.payload as any)?.dockSettings;
            if (rawDock) {
              setDockSettings((prev) => ({ ...prev, ...rawDock }));
            } else {
              setDockSettings((prev) => ({
                ...prev,
                showAvatars: typeof norm.avatar?.show === 'boolean' ? norm.avatar.show : prev.showAvatars,
                showBadges: typeof norm.badges?.show === 'boolean' ? norm.badges.show : prev.showBadges,
                nameFontSize: norm.username?.size || prev.nameFontSize,
                textFontSize: norm.text?.size || prev.textFontSize,
                fontFamily: (norm.text?.font?.family as any) || prev.fontFamily,
                customFontName: norm.text?.font?.customName || prev.customFontName,
                customFontUrl: (envelope.payload as any)?.customFontUrl || prev.customFontUrl,
              }));
            }
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
              const targetId = payload.id;
              setMessages((current) =>
                current.map((message) =>
                  message.userId === targetId || message.username.toLowerCase() === targetId.toLowerCase()
                    ? { ...message, deleted: true }
                    : message,
                ),
              );
            } else if (payload?.scope === 'message' && payload.id) {
              const targetId = payload.id;
              setMessages((current) =>
                current.map((message) =>
                  message.id === targetId ? { ...message, deleted: true } : message,
                ),
              );
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

            setMessages((current) => {
              const next = [...current, message];
              return next.length > 500 ? next.slice(-500) : next;
            });
            return;
          }
          case 'reload': {
            window.location.reload();
            return;
          }
          default:
            return;
        }
      });

      socket.addEventListener('close', () => {
        if (!disposed) setConnected(false);
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
  }, []);

  const thirdParty = useMemo(
    () => mergeEmoteProviders(providers, settings.emotes),
    [providers, settings.emotes],
  );

  const handleTimeout = useCallback((username: string) => {
    const clean = username.replace(/^@+/, '').trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ kind: 'timeout-user', user: clean, duration: 60 }));
    setMessages((cur) =>
      cur.map((m) =>
        m.username.toLowerCase() === clean.toLowerCase() ? { ...m, deleted: true } : m,
      ),
    );
  }, []);

  const handleBan = useCallback((username: string) => {
    const clean = username.replace(/^@+/, '').trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ kind: 'ban-user', user: clean }));
    setMessages((cur) =>
      cur.map((m) =>
        m.username.toLowerCase() === clean.toLowerCase() ? { ...m, deleted: true } : m,
      ),
    );
  }, []);

  const handleDelete = useCallback((messageId: string) => {
    if (!messageId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ kind: 'delete-message', messageId }));
    setMessages((cur) => cur.map((m) => (m.id === messageId ? { ...m, deleted: true } : m)));
  }, []);

  const handleMention = useCallback((username: string) => {
    const clean = username.replace(/^@+/, '').trim();
    if (!clean) return;
    setInputMsg((prev) => (prev ? `${prev.trimEnd()} @${clean} ` : `@${clean} `));
    inputRef.current?.focus();
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMsg.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ kind: 'send-chat', message: text }));
    setInputMsg('');
    scrollToBottom();
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#13171b] text-[#e6edf3] select-text font-sans">
      <style>{`
        @keyframes chatMsgIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-chat-in {
          animation: chatMsgIn 0.16s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
      {/* Top Header */}
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-white/10 bg-[#182026] px-2.5 text-xs select-none">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full transition-colors ${
              connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400'
            }`}
            title={connected ? 'Connected to Streamer Hub' : 'Connecting...'}
          />
          <span className="font-display font-bold uppercase tracking-wider text-[11.5px] text-white">
            Streamer Chat
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Font Size Selector */}
          <div className="flex items-center gap-0.5 rounded bg-black/40 p-0.5 font-mono text-[10px]">
            {([12, 13, 14, 16] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => changeFontSize(size)}
                className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  fontSize === size ? 'bg-accent text-white font-bold shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title={`Font Size: ${size}px`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* Clear Feed */}
          <button
            type="button"
            onClick={() => setMessages([])}
            className="p-1 rounded text-slate-300 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
            title="Clear Chat Feed"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </header>

      {/* Main Messages Feed Area */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#13171b]">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-2 py-1.5 custom-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center select-none">
              <div className="max-w-xs space-y-2 p-6">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-white/[0.08] text-slate-300">
                  <MessageSquare size={20} />
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Stream chat will appear here in real-time.
                </p>
              </div>
            </div>
          ) : (
            <div className="min-h-full flex flex-col justify-end">
              <div className="flex-1 min-h-0" />
              <div className="space-y-1">
                {messages.map((msg) => (
                  <DockMessageRow
                    key={msg.id}
                    message={msg}
                    dockSettings={dockSettings}
                    fontStack={fontStack}
                    thirdParty={thirdParty}
                    onMention={handleMention}
                    onTimeout={handleTimeout}
                    onBan={handleBan}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Floating 'New Messages' Pill when Scrolled Up */}
        {isScrolledUp && newMessagesCount > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-3 start-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent px-3 py-1 font-sans text-xs font-semibold text-white shadow-lg hover:brightness-110 transition-all animate-bounce cursor-pointer"
          >
            <ArrowDown size={11} strokeWidth={2.5} />
            <span>New messages</span>
            <span className="rounded-full bg-black/40 px-1.5 py-0.2 text-[10px] font-bold">{newMessagesCount}</span>
          </button>
        )}
      </div>

      {/* Quick Input Bar for Streamer Dock in OBS */}
      <form
        onSubmit={handleSend}
        className="flex h-9 shrink-0 items-center gap-1.5 border-t border-white/10 bg-[#182026] px-2 select-text"
      >
        <input
          ref={inputRef}
          type="text"
          dir="auto"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder="Send message to Twitch..."
          className="h-7 flex-1 rounded bg-[#0f1418] px-2.5 text-xs text-white placeholder:text-slate-400 outline-none border border-white/15 focus:border-accent font-sans"
        />
        <button
          type="submit"
          disabled={!inputMsg.trim()}
          className="flex h-7 items-center justify-center rounded bg-accent px-3 text-xs font-bold text-white hover:brightness-110 disabled:opacity-40 cursor-pointer transition-colors shadow-sm"
          title="Send"
        >
          <Send size={12} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}

interface DockMessageRowProps {
  message: DockMessageItem;
  dockSettings: ObsChatDockSettings;
  fontStack: string;
  thirdParty: ThirdPartyEmoteMap;
  onMention: (user: string) => void;
  onTimeout: (user: string) => void;
  onBan: (user: string) => void;
  onDelete: (id: string) => void;
}

function DockMessageRow({
  message,
  dockSettings,
  fontStack,
  thirdParty,
  onMention,
  onTimeout,
  onBan,
  onDelete,
}: DockMessageRowProps) {
  const [hovered, setHovered] = useState(false);
  const isRtl = isRtlText(message.message);
  const timeStr = formatTime(message.timestamp);
  const userColor = ensureReadableColor(message.color);
  const nameSize = dockSettings.nameFontSize || dockSettings.fontSize || 13;
  const textSize = dockSettings.textFontSize || dockSettings.fontSize || 13;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative rounded-[4px] px-2 py-0.5 transition-colors leading-snug animate-chat-in ${
        message.deleted
          ? 'opacity-40 bg-red-950/20 line-through'
          : hovered
          ? 'bg-white/[0.06]'
          : 'hover:bg-white/[0.04]'
      } ${message.isBroadcaster ? 'border-s-2 border-accent/80' : ''}`}
      style={{ fontFamily: fontStack }}
    >
      <div className="flex items-baseline gap-1.5 flex-wrap">
        {/* Timestamp */}
        {dockSettings.showTimestamps && timeStr && (
          <span className="font-mono text-[11px] text-[#94a3b8] select-none shrink-0 font-medium">
            {timeStr}
          </span>
        )}

        {/* User Avatar if enabled */}
        {dockSettings.showAvatars && message.avatarUrl && (
          <img
            src={message.avatarUrl}
            alt=""
            className="size-3.5 rounded-full object-cover shrink-0 select-none inline-block align-text-bottom"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        )}

        {/* Badges / Rank if enabled */}
        {dockSettings.showBadges && (
          <span className="inline-flex items-center gap-1 select-none shrink-0">
            {message.isBroadcaster && (
              <span
                className="rounded bg-[#dc2626] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight shadow-sm"
                title="Broadcaster"
              >
                Host
              </span>
            )}
            {message.isMod && (
              <span
                className="rounded bg-[#16a34a] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight shadow-sm"
                title="Moderator"
              >
                Mod
              </span>
            )}
            {message.isLeadMod && (
              <span
                className="rounded bg-[#059669] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight shadow-sm"
                title="Lead Moderator"
              >
                Lead Mod
              </span>
            )}
            {message.isVip && (
              <span
                className="rounded bg-[#d946ef] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight shadow-sm"
                title="VIP"
              >
                VIP
              </span>
            )}
            {message.isSubscriber && !message.isBroadcaster && (
              <span
                className="rounded bg-[#9333ea] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight shadow-sm"
                title="Subscriber"
              >
                Sub
              </span>
            )}
          </span>
        )}

        {/* Username */}
        <button
          type="button"
          onClick={() => onMention(message.username)}
          className="font-bold hover:underline cursor-pointer select-text text-start"
          style={{ color: userColor, fontSize: `${nameSize}px`, fontFamily: fontStack }}
          title={`Click to mention @${message.username}`}
        >
          {message.username}
        </button>
        <span className="text-white/60 select-none font-bold">:</span>

        {/* Message Content with Emotes & BiDi */}
        <span
          dir={isRtl ? 'rtl' : 'ltr'}
          className="break-words text-[#f8fafc] font-normal leading-relaxed select-text"
          style={{ fontSize: `${textSize}px`, fontFamily: fontStack }}
        >
          {message.deleted ? (
            <em className="text-rose-400 font-mono text-[11.5px] italic select-none">Message deleted by moderator</em>
          ) : (
            <DockMessageText
              text={message.message}
              emotes={message.emotes}
              thirdParty={thirdParty}
              isRtl={isRtl}
            />
          )}
        </span>
      </div>

      {/* Floating Action Buttons on Hover */}
      {hovered && !message.deleted && (
        <div className="absolute end-2 -top-3 z-20 flex items-center gap-1 rounded-md border border-white/20 bg-[#1e2732] px-1 py-0.5 shadow-xl select-none">
          {/* Mention */}
          <button
            type="button"
            onClick={() => onMention(message.username)}
            className="rounded p-1 text-sky-400 hover:text-white hover:bg-sky-500/30 transition-colors cursor-pointer"
            title={`Mention @${message.username}`}
          >
            <AtSign size={13} strokeWidth={2.2} />
          </button>

          {/* Timeout 60s */}
          <button
            type="button"
            onClick={() => onTimeout(message.username)}
            className="rounded p-1 text-amber-400 hover:text-white hover:bg-amber-500/30 transition-colors cursor-pointer"
            title={`Timeout @${message.username} (60s)`}
          >
            <Clock size={13} strokeWidth={2.2} />
          </button>

          {/* Ban User */}
          <button
            type="button"
            onClick={() => onBan(message.username)}
            className="rounded p-1 text-rose-400 hover:text-white hover:bg-rose-500/30 transition-colors cursor-pointer"
            title={`Ban @${message.username}`}
          >
            <Ban size={13} strokeWidth={2.2} />
          </button>

          {/* Delete Message */}
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            className="rounded p-1 text-red-400 hover:text-white hover:bg-red-500/30 transition-colors cursor-pointer"
            title="Delete message"
          >
            <Trash2 size={13} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </div>
  );
}

function DockMessageText({
  text,
  emotes,
  thirdParty,
  isRtl,
}: {
  text: string;
  emotes?: readonly EmoteRange[];
  thirdParty?: ThirdPartyEmoteMap;
  isRtl: boolean;
}) {
  const { tokens } = useMemo(
    () => tokenizeMessage(text, emotes, thirdParty, { twitch: true }),
    [text, emotes, thirdParty],
  );

  const hasEmotes = tokens.some((t) => t.type === 'emote');
  if (!hasEmotes) {
    return <span>{formatBidiText(text, isRtl)}</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1" dir={isRtl ? 'rtl' : 'ltr'}>
      {tokens.map((token, index) =>
        token.type === 'emote' ? (
          <img
            key={`emote-${index}`}
            src={token.url}
            alt={token.name}
            title={token.name}
            className="inline-block h-[1.35em] w-auto max-w-[2.5em] object-contain align-middle select-none"
            loading="eager"
            onError={(e) => {
              const replacement = document.createElement('span');
              replacement.textContent = token.name;
              e.currentTarget.replaceWith(replacement);
            }}
          />
        ) : (
          <span key={`text-${index}`} dir={isRtl ? 'rtl' : 'ltr'}>
            {formatBidiText(token.value, isRtl)}
          </span>
        ),
      )}
    </span>
  );
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
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
