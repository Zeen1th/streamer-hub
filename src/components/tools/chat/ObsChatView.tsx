import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AtSign,
  Ban,
  Check,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Megaphone,
  MessageSquare,
  Radio,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useObsChatStore, type ObsChatMessage, type ObsChatDockSettings } from '../../../store/obsChatStore';
import { useConnectionStore } from '../../../store/connectionStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { t } from '../../../i18n/translations';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Switch } from '../../ui/Switch';
import { isRtlText } from '../../../lib/chatOverlay';

export function ObsChatView() {
  const store = useObsChatStore();
  const messages = store.messages;
  const dockSettings = store.dockSettings;
  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const broadcasterDisplayName = useConnectionStore((s) => s.broadcasterDisplayName);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLength = useRef(messages.length);

  const channelLogin = (twitchChannel || '').replace(/^#+/, '');
  const activeSender = broadcasterDisplayName || channelLogin || 'Streamer';

  // Load dock URL on mount
  useEffect(() => {
    const url = store.dockUrl || `http://127.0.0.1:49178/obs-chat.html`;
    store.setDockUrl(url);
  }, []);

  // Handle auto-scrolling
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

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(store.dockUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await store.sendMessage(text);
      if (res.ok) {
        setInputMessage('');
        scrollToBottom();
      }
    } finally {
      setSending(false);
    }
  };

  const handleMention = (username: string) => {
    const mention = `@${username.replace(/^@+/, '')} `;
    setInputMessage((prev) => (prev ? `${prev.trimEnd()} ${mention}` : mention));
    inputRef.current?.focus();
  };

  const handleSendTestMessage = () => {
    const samples = [
      { user: 'Viewer_One', msg: 'Welcome to the stream everyone! PogChamp', mod: false, sub: true, vip: false, color: '#3B82F6' },
      { user: 'ModSquad', msg: 'Please keep the chat friendly and enjoy the game!', mod: true, sub: true, vip: false, color: '#10B981' },
      { user: 'VIP_Gamer', msg: 'Are you trying the new boss today?', mod: false, sub: false, vip: true, color: '#EC4899' },
      { user: 'صديق_البث', msg: 'أهلاً وسهلاً بك في البث يا أسطورة! 🎮🔥', mod: false, sub: true, vip: false, color: '#F59E0B' },
    ];
    const picked = samples[Math.floor(Math.random() * samples.length)];
    store.addMessage({
      id: `test-${Date.now()}-${Math.random()}`,
      username: picked.user,
      message: picked.msg,
      isBroadcaster: false,
      isMod: picked.mod,
      isSubscriber: picked.sub,
      isVip: picked.vip,
      color: picked.color,
      timestamp: new Date().toISOString(),
      emotes: [],
    });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#13171b] text-ink" aria-label={t(lang, 'nav.obsChat')}>
      {/* Top Header */}
      <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#1a2228] px-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-[6px] bg-accent/15 text-accent-text">
              <MessageSquare size={16} />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.05em] text-white">
                {t(lang, 'obsChat.title')}
              </h2>
              <div className="flex items-center gap-1.5 text-[10.5px] font-mono">
                <span
                  className={`size-2 rounded-full ${
                    twitchConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400'
                  }`}
                />
                <span className="text-[#9aa3af]">
                  {twitchConnected ? `@${channelLogin || 'connected'}` : t(lang, 'workspace.notConnected')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {/* Copy OBS Dock URL Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyUrl}
            title={t(lang, 'obsChat.copyUrl')}
            className="h-7 gap-1.5 px-2.5 text-[11.5px]"
          >
            {copiedUrl ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedUrl ? t(lang, 'obsChat.copied') : t(lang, 'obsChat.copyUrl')}</span>
          </Button>

          {/* OBS Setup Guide Modal Trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGuide((v) => !v)}
            title={t(lang, 'obsChat.setupGuide')}
            className={`h-7 px-2 text-[11.5px] ${showGuide ? 'bg-white/[0.08] text-white' : ''}`}
          >
            <HelpCircle size={14} className="me-1" />
            <span className="hidden sm:inline">{t(lang, 'obsChat.setupGuide')}</span>
          </Button>

          {/* Test Message */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSendTestMessage}
            title={t(lang, 'obsChat.testMessage')}
            className="h-7 px-2 text-[11.5px]"
          >
            <Sparkles size={13} className="text-accent-text" />
            <span className="hidden md:inline ms-1">{t(lang, 'obsChat.testMessage')}</span>
          </Button>

          {/* Clear Chat */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => store.clearAll()}
            title={t(lang, 'obsChat.clearChat')}
            className="h-7 px-2 text-[11.5px] text-muted hover:text-danger"
          >
            <Trash2 size={13} />
          </Button>

          {/* Settings Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings((v) => !v)}
            title={t(lang, 'obsChat.settings')}
            className={`h-7 px-2 text-[11.5px] ${showSettings ? 'bg-white/[0.08] text-white' : ''}`}
          >
            <Settings2 size={14} />
          </Button>
        </div>
      </header>

      {/* OBS Setup Guide Banner/Modal */}
      {showGuide && (
        <div className="relative border-b border-accent/30 bg-accent/10 px-4 py-3 text-xs text-[#d7dde4]">
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            className="absolute end-3 top-3 text-muted hover:text-white"
            aria-label="Close guide"
          >
            <X size={14} />
          </button>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-bold text-accent-text">
            <Radio size={14} />
            {t(lang, 'obsChat.setupGuide')}
          </h4>
          <div className="space-y-1 text-[11.5px] text-[#c3cad3]">
            <p>{t(lang, 'obsChat.guideStep1')}</p>
            <p>{t(lang, 'obsChat.guideStep2')}</p>
            <p>{t(lang, 'obsChat.guideStep3')}</p>
          </div>
          <div className="mt-2.5 flex items-center gap-2 font-mono text-[11px]">
            <span className="text-muted">{t(lang, 'obsChat.dockUrl')}:</span>
            <code className="rounded border border-white/[0.12] bg-black/40 px-2 py-0.5 text-accent-text">
              {store.dockUrl}
            </code>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="text-xs text-ink hover:text-accent-text underline underline-offset-2"
            >
              {copiedUrl ? t(lang, 'obsChat.copied') : t(lang, 'obsChat.copyUrl')}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Chat Feed Scroll Container */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 custom-scrollbar"
          >
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center text-center text-muted">
                <div className="max-w-xs space-y-2 p-6">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-white/[0.04] text-muted">
                    <MessageSquare size={20} />
                  </div>
                  <p className="text-xs">{t(lang, 'obsChat.noMessagesYet')}</p>
                  <Button variant="outline" size="sm" onClick={handleSendTestMessage} className="mt-2 text-xs">
                    <Sparkles size={12} className="me-1" />
                    {t(lang, 'obsChat.testMessage')}
                  </Button>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatMessageRow
                  key={msg.id}
                  message={msg}
                  settings={dockSettings}
                  lang={lang}
                  onMention={handleMention}
                  onTimeout={(u) => store.timeoutUser(u, 60)}
                  onBan={(u) => store.banUser(u)}
                  onDelete={(id) => store.deleteMessage(id)}
                  onShoutout={(u) => store.shoutoutUser(u)}
                />
              ))
            )}
          </div>

          {/* Floating 'New Messages' Pill */}
          {isScrolledUp && newMessagesCount > 0 && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute bottom-16 start-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent px-3 py-1 font-sans text-xs font-semibold text-accent-contrast shadow-lg hover:brightness-110 transition-all animate-bounce"
            >
              <span>{t(lang, 'obsChat.newMessages')}</span>
              <span className="rounded-full bg-black/30 px-1.5 py-0.2 text-[10px]">{newMessagesCount}</span>
            </button>
          )}

          {/* Quick Chat Send Bar */}
          <form
            onSubmit={handleSend}
            className="flex shrink-0 items-center gap-2 border-t border-white/[0.08] bg-[#1a2228] p-2.5"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/20 font-bold text-accent-text text-xs">
              {activeSender.charAt(0).toUpperCase()}
            </div>
            <Input
              ref={inputRef}
              dir="auto"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={t(lang, 'obsChat.sendPlaceholder', { sender: activeSender })}
              className="h-8 flex-1 bg-surface-2 font-sans text-xs text-ink"
              disabled={sending}
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!inputMessage.trim() || sending}
              className="h-8 px-3 text-xs"
            >
              <Send size={13} className="me-1" />
              <span>{t(lang, 'obsChat.send')}</span>
            </Button>
          </form>
        </div>

        {/* Dock Settings Side Panel */}
        {showSettings && (
          <aside
            className="w-[280px] shrink-0 border-s border-white/[0.08] bg-[#161c22] p-3 overflow-y-auto space-y-4"
            aria-label={t(lang, 'obsChat.settings')}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-[0.05em] text-ink flex items-center gap-1.5">
                <Settings2 size={13} className="text-accent-text" />
                {t(lang, 'obsChat.settings')}
              </h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-muted hover:text-white"
                aria-label="Close settings"
              >
                <X size={14} />
              </button>
            </div>

            {/* Font Size */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#c3cad3]">{t(lang, 'obsChat.fontSize')}</label>
              <div className="grid grid-cols-4 gap-1">
                {([12, 13, 14, 16] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => store.updateSettings({ fontSize: size })}
                    className={`h-7 rounded text-xs font-mono transition-colors ${
                      dockSettings.fontSize === size
                        ? 'bg-accent text-accent-contrast font-bold'
                        : 'bg-white/[0.05] text-muted hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>

            {/* Density */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#c3cad3]">{t(lang, 'obsChat.density')}</label>
              <div className="grid grid-cols-2 gap-1">
                {(['compact', 'comfortable'] as const).map((density) => (
                  <button
                    key={density}
                    type="button"
                    onClick={() => store.updateSettings({ density })}
                    className={`h-7 rounded text-xs transition-colors capitalize ${
                      dockSettings.density === density
                        ? 'bg-accent text-accent-contrast font-bold'
                        : 'bg-white/[0.05] text-muted hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {t(lang, `obsChat.${density}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2.5 border-t border-white/[0.08] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#c3cad3]">{t(lang, 'obsChat.timestamps')}</span>
                <Switch
                  label={t(lang, 'obsChat.timestamps')}
                  checked={dockSettings.showTimestamps}
                  onChange={(v) => store.updateSettings({ showTimestamps: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-[#c3cad3]">{t(lang, 'obsChat.badges')}</span>
                <Switch
                  label={t(lang, 'obsChat.badges')}
                  checked={dockSettings.showBadges}
                  onChange={(v) => store.updateSettings({ showBadges: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-[#c3cad3]">{t(lang, 'obsChat.avatars')}</span>
                <Switch
                  label={t(lang, 'obsChat.avatars')}
                  checked={dockSettings.showAvatars}
                  onChange={(v) => store.updateSettings({ showAvatars: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-[#c3cad3]">{t(lang, 'obsChat.highlightMentions')}</span>
                <Switch
                  label={t(lang, 'obsChat.highlightMentions')}
                  checked={dockSettings.highlightMentions}
                  onChange={(v) => store.updateSettings({ highlightMentions: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-[#c3cad3]">{t(lang, 'obsChat.soundOnMention')}</span>
                <Switch
                  label={t(lang, 'obsChat.soundOnMention')}
                  checked={dockSettings.soundOnMention}
                  onChange={(v) => store.updateSettings({ soundOnMention: v })}
                />
              </div>
            </div>

            {/* Standalone Link */}
            <div className="border-t border-white/[0.08] pt-3">
              <a
                href={store.dockUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-accent-text hover:underline"
              >
                <ExternalLink size={12} />
                <span>Open Standalone Dock</span>
              </a>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}

interface ChatMessageRowProps {
  message: ObsChatMessage;
  settings: ObsChatDockSettings;
  lang: 'en' | 'ar';
  onMention: (user: string) => void;
  onTimeout: (user: string) => void;
  onBan: (user: string) => void;
  onDelete: (id: string) => void;
  onShoutout: (user: string) => void;
}

function ChatMessageRow({
  message,
  settings,
  lang,
  onMention,
  onTimeout,
  onBan,
  onDelete,
  onShoutout,
}: ChatMessageRowProps) {
  const [hovered, setHovered] = useState(false);
  const isRtl = isRtlText(message.message);

  const timeStr = useMemo(() => {
    if (!message.timestamp) return '';
    try {
      const d = new Date(message.timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [message.timestamp]);

  const userColor = message.color || '#38bdf8';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative rounded-[5px] px-2 transition-colors ${
        settings.density === 'compact' ? 'py-1' : 'py-1.5'
      } ${
        message.deleted
          ? 'opacity-40 bg-red-950/10 line-through'
          : hovered
          ? 'bg-white/[0.04]'
          : 'hover:bg-white/[0.03]'
      } ${message.isBroadcaster ? 'border-s-2 border-accent/80' : ''}`}
      style={{ fontSize: `${settings.fontSize}px` }}
    >
      <div className="flex items-baseline gap-1.5 flex-wrap">
        {/* Timestamp */}
        {settings.showTimestamps && timeStr && (
          <span className="font-mono text-[10px] text-[#6b7684] select-none shrink-0">
            {timeStr}
          </span>
        )}

        {/* User Avatar */}
        {settings.showAvatars && message.avatarUrl && (
          <img
            src={message.avatarUrl}
            alt=""
            className="size-4 rounded-full object-cover shrink-0 select-none inline-block align-text-bottom"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        )}

        {/* Badges */}
        {settings.showBadges && (
          <span className="inline-flex items-center gap-1 select-none shrink-0">
            {message.isBroadcaster && (
              <span className="rounded bg-[#e91916] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight" title="Broadcaster">
                Host
              </span>
            )}
            {message.isMod && (
              <span className="rounded bg-[#00ad03] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight" title="Moderator">
                Mod
              </span>
            )}
            {message.isVip && (
              <span className="rounded bg-[#e005b9] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight" title="VIP">
                VIP
              </span>
            )}
            {message.isSubscriber && !message.isBroadcaster && (
              <span className="rounded bg-[#8205b4] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight" title="Subscriber">
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
          style={{ color: userColor }}
          title={`Click to mention @${message.username}`}
        >
          {message.username}
        </button>
        <span className="text-[#868f9d] select-none">:</span>

        {/* Message Text */}
        <span
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`break-words text-[#e6edf3] select-text ${
            isRtl ? 'font-arabic' : 'font-sans'
          }`}
        >
          {message.deleted ? (
            <em className="text-muted text-[11px]">{t(lang, 'obsChat.deleted')}</em>
          ) : (
            message.message
          )}
        </span>
      </div>

      {/* Floating Action Buttons on Hover */}
      {hovered && !message.deleted && (
        <div className="absolute end-2 -top-3 z-10 flex items-center gap-0.5 rounded border border-white/[0.12] bg-[#1e252c] p-0.5 shadow-md">
          {/* Mention */}
          <button
            type="button"
            onClick={() => onMention(message.username)}
            className="rounded p-1 text-muted hover:bg-white/[0.08] hover:text-white transition-colors"
            title={t(lang, 'obsChat.mention')}
          >
            <AtSign size={12} />
          </button>

          {/* Shoutout */}
          <button
            type="button"
            onClick={() => onShoutout(message.username)}
            className="rounded p-1 text-muted hover:bg-white/[0.08] hover:text-white transition-colors"
            title={t(lang, 'obsChat.shoutout')}
          >
            <Megaphone size={12} />
          </button>

          {/* Timeout 60s */}
          <button
            type="button"
            onClick={() => onTimeout(message.username)}
            className="rounded p-1 text-muted hover:bg-amber-500/20 hover:text-amber-400 transition-colors"
            title={t(lang, 'obsChat.timeout')}
          >
            <Clock size={12} />
          </button>

          {/* Ban User */}
          <button
            type="button"
            onClick={() => onBan(message.username)}
            className="rounded p-1 text-muted hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
            title={t(lang, 'obsChat.ban')}
          >
            <Ban size={12} />
          </button>

          {/* Delete Message */}
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            className="rounded p-1 text-muted hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
            title={t(lang, 'obsChat.delete')}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
