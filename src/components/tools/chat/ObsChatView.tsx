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
  Minus,
  Plus,
  Radio,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useObsChatStore, type ObsChatMessage, type ObsChatDockSettings, type ObsChatFontFamily } from '../../../store/obsChatStore';
import { useConnectionStore } from '../../../store/connectionStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { t } from '../../../i18n/translations';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { Input } from '../../ui/Input';
import { isRtlText, formatBidiText, ensureReadableColor } from '../../../lib/chatOverlay';
import { tokenizeMessage } from '../../../lib/chatEmotes';
import { resolveFontStack } from '../../../overlay/tokens';
import { rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';
import { normalizeInstalledFontFamilies } from '../../../lib/fontChoices';

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

  const [installedFonts, setInstalledFonts] = useState<string[]>([]);

  // Load dock URL on mount
  useEffect(() => {
    const url = store.dockUrl || `http://127.0.0.1:49178/obs-chat.html`;
    store.setDockUrl(url);
  }, []);

  // Fetch installed system fonts
  useEffect(() => {
    let cancelled = false;
    rpc.invoke(Channels.SystemListFonts).then(({ fonts }) => {
      if (cancelled) return;
      setInstalledFonts(normalizeInstalledFontFamilies(fonts));
    }).catch(() => {
      // ignore
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Dynamically inject custom font stylesheet when provided
  useEffect(() => {
    const url = dockSettings.customFontUrl?.trim();
    let link = document.getElementById('obs-chat-view-custom-font') as HTMLLinkElement | null;
    if (url) {
      if (!link) {
        link = document.createElement('link');
        link.id = 'obs-chat-view-custom-font';
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
    <section className="flex min-h-0 flex-1 flex-col bg-[#13171b] text-[#f8fafc]" aria-label={t(lang, 'nav.obsChat')}>
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
      <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-white/[0.12] bg-[#1a2228] px-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-[6px] bg-accent/20 text-accent-text border border-accent/40">
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
                <span className="text-[#cbd5e1]">
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
            className="h-7 gap-1.5 px-2.5 text-[11.5px] border-white/20 text-slate-200 hover:bg-white/10 hover:text-white"
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
            className={`h-7 px-2 text-[11.5px] text-slate-300 hover:text-white ${showGuide ? 'bg-white/[0.12] text-white' : ''}`}
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
            className="h-7 px-2 text-[11.5px] text-slate-300 hover:text-white"
          >
            <Sparkles size={13} className="text-amber-400" />
            <span className="hidden md:inline ms-1">{t(lang, 'obsChat.testMessage')}</span>
          </Button>

          {/* Clear Chat */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => store.clearAll()}
            title={t(lang, 'obsChat.clearChat')}
            className="h-7 px-2 text-[11.5px] text-slate-400 hover:text-rose-400"
          >
            <Trash2 size={13} />
          </Button>

          {/* Settings Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings((v) => !v)}
            title={t(lang, 'obsChat.settings')}
            className={`h-7 px-2 text-[11.5px] text-slate-300 hover:text-white ${showSettings ? 'bg-white/[0.12] text-white' : ''}`}
          >
            <Settings2 size={14} />
          </Button>
        </div>
      </header>

      {/* OBS Setup Guide Banner/Modal */}
      {showGuide && (
        <div className="relative border-b border-accent/30 bg-[#1e2732] px-4 py-3 text-xs text-slate-200">
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            className="absolute end-3 top-3 text-slate-400 hover:text-white"
            aria-label="Close guide"
          >
            <X size={14} />
          </button>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-bold text-sky-400">
            <Radio size={14} />
            {t(lang, 'obsChat.setupGuide')}
          </h4>
          <div className="space-y-1 text-[11.5px] text-slate-300">
            <p>{t(lang, 'obsChat.guideStep1')}</p>
            <p>{t(lang, 'obsChat.guideStep2')}</p>
            <p>{t(lang, 'obsChat.guideStep3')}</p>
          </div>
          <div className="mt-2.5 flex items-center gap-2 font-mono text-[11px]">
            <span className="text-slate-400">{t(lang, 'obsChat.dockUrl')}:</span>
            <code className="rounded border border-white/[0.15] bg-black/50 px-2 py-0.5 text-sky-300 select-all">
              {store.dockUrl}
            </code>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="text-xs text-slate-300 hover:text-sky-300 underline underline-offset-2"
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
            className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar"
          >
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center text-center text-slate-400">
                <div className="max-w-xs space-y-2 p-6">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-white/[0.08] text-slate-300">
                    <MessageSquare size={20} />
                  </div>
                  <p className="text-xs text-slate-300">{t(lang, 'obsChat.noMessagesYet')}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendTestMessage}
                    className="mt-2 text-xs border-white/20 text-slate-200 hover:bg-white/10"
                  >
                    <Sparkles size={12} className="me-1 text-amber-400" />
                    {t(lang, 'obsChat.testMessage')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="min-h-full flex flex-col justify-end">
                <div className="flex-1 min-h-0" />
                <div className="space-y-1.5">
                  {messages.map((msg) => (
                    <ChatMessageRow
                      key={msg.id}
                      message={msg}
                      settings={dockSettings}
                      fontStack={fontStack}
                      lang={lang}
                      onMention={handleMention}
                      onTimeout={(u) => store.timeoutUser(u, 60)}
                      onBan={(u) => store.banUser(u)}
                      onDelete={(id) => store.deleteMessage(id)}
                      onShoutout={(u) => store.shoutoutUser(u)}
                    />
                  ))}
                </div>
              </div>
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
            className="flex shrink-0 items-center gap-2 border-t border-white/[0.12] bg-[#182026] p-2.5"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/25 font-bold text-accent-text text-xs border border-accent/40">
              {activeSender.charAt(0).toUpperCase()}
            </div>
            <input
              ref={inputRef}
              dir="auto"
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={t(lang, 'obsChat.sendPlaceholder', { sender: activeSender })}
              className="h-8 flex-1 rounded-md border border-white/15 bg-[#0f1418] px-3 font-sans text-xs text-white placeholder:text-slate-400 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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
            className="w-[320px] shrink-0 border-s border-white/[0.12] bg-[#161c22] p-3.5 overflow-y-auto space-y-4 custom-scrollbar"
            aria-label={t(lang, 'obsChat.settings')}
          >
            <div className="flex items-center justify-between border-b border-white/[0.12] pb-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-[0.05em] text-white flex items-center gap-1.5">
                <Settings2 size={13} className="text-accent-text" />
                {t(lang, 'obsChat.settings')}
              </h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close settings"
              >
                <X size={14} />
              </button>
            </div>

            {/* Name Font Size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-200">{t(lang, 'obsChat.nameFontSize')}</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      store.updateSettings({
                        nameFontSize: Math.max(9, (dockSettings.nameFontSize ?? 13) - 1),
                      })
                    }
                    className="flex size-6 items-center justify-center rounded bg-white/[0.08] text-xs font-bold text-slate-300 hover:bg-white/[0.14] hover:text-white transition-colors"
                    title="Decrease"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="w-11 text-center font-mono text-xs font-bold text-accent-text">
                    {dockSettings.nameFontSize ?? 13}px
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      store.updateSettings({
                        nameFontSize: Math.min(36, (dockSettings.nameFontSize ?? 13) + 1),
                      })
                    }
                    className="flex size-6 items-center justify-center rounded bg-white/[0.08] text-xs font-bold text-slate-300 hover:bg-white/[0.14] hover:text-white transition-colors"
                    title="Increase"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[11, 13, 15, 18, 22].map((size) => (
                  <button
                    key={`name-${size}`}
                    type="button"
                    onClick={() => store.updateSettings({ nameFontSize: size })}
                    className={`h-6 rounded text-[11px] font-mono transition-colors ${
                      (dockSettings.nameFontSize ?? 13) === size
                        ? 'bg-accent text-accent-contrast font-bold'
                        : 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.14] hover:text-white'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>

            {/* Message Text Font Size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-200">{t(lang, 'obsChat.textFontSize')}</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      store.updateSettings({
                        textFontSize: Math.max(9, (dockSettings.textFontSize ?? 13) - 1),
                      })
                    }
                    className="flex size-6 items-center justify-center rounded bg-white/[0.08] text-xs font-bold text-slate-300 hover:bg-white/[0.14] hover:text-white transition-colors"
                    title="Decrease"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="w-11 text-center font-mono text-xs font-bold text-accent-text">
                    {dockSettings.textFontSize ?? 13}px
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      store.updateSettings({
                        textFontSize: Math.min(36, (dockSettings.textFontSize ?? 13) + 1),
                      })
                    }
                    className="flex size-6 items-center justify-center rounded bg-white/[0.08] text-xs font-bold text-slate-300 hover:bg-white/[0.14] hover:text-white transition-colors"
                    title="Increase"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[11, 13, 15, 18, 22].map((size) => (
                  <button
                    key={`text-${size}`}
                    type="button"
                    onClick={() => store.updateSettings({ textFontSize: size })}
                    className={`h-6 rounded text-[11px] font-mono transition-colors ${
                      (dockSettings.textFontSize ?? 13) === size
                        ? 'bg-accent text-accent-contrast font-bold'
                        : 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.14] hover:text-white'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family */}
            <div className="space-y-2 border-t border-white/[0.12] pt-3">
              <label className="text-xs font-medium text-slate-200">{t(lang, 'obsChat.fontFamily')}</label>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'system', label: 'System' },
                    { id: 'cairo', label: 'Cairo' },
                    { id: 'barlow', label: 'Barlow' },
                    { id: 'jetbrains-mono', label: 'Mono' },
                    { id: 'cinzel', label: 'Cinzel' },
                    { id: 'custom', label: t(lang, 'obsChat.fontCustom') },
                  ] as const
                ).map((f) => {
                  const selected = (dockSettings.fontFamily || 'system') === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => store.updateSettings({ fontFamily: f.id as ObsChatFontFamily })}
                      className={`h-7 rounded px-1.5 text-xs transition-colors truncate ${
                        selected
                          ? 'bg-accent text-accent-contrast font-bold shadow-xs'
                          : 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.14] hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Font Fields */}
              {dockSettings.fontFamily === 'custom' && (
                <div className="space-y-2 rounded-md border border-white/10 bg-black/20 p-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-300">
                      {t(lang, 'obsChat.customFontName')}
                    </label>
                    <Input
                      list="obs-chat-view-installed-fonts"
                      value={dockSettings.customFontName}
                      placeholder="e.g. Arial, Inter, Roboto"
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(e) => store.updateSettings({ customFontName: e.target.value })}
                    />
                    <datalist id="obs-chat-view-installed-fonts">
                      {installedFonts.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] text-slate-300">
                      {t(lang, 'obsChat.customFontUrl')}
                    </label>
                    <Input
                      value={dockSettings.customFontUrl}
                      placeholder="https://fonts.googleapis.com/css2?..."
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(e) => store.updateSettings({ customFontUrl: e.target.value })}
                    />
                  </div>

                  <p className="text-[10px] text-slate-400 leading-tight">
                    {t(lang, 'obsChat.customFontHint')}
                  </p>
                </div>
              )}
            </div>

            {/* Live Font & Size Preview */}
            <div className="space-y-1.5 border-t border-white/[0.12] pt-3">
              <label className="text-xs font-medium text-slate-200">{t(lang, 'obsChat.fontPreview')}</label>
              <div
                className="rounded border border-white/15 bg-black/40 p-2.5 space-y-1"
                style={{ fontFamily: fontStack }}
              >
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  {dockSettings.showTimestamps && (
                    <span className="font-mono text-[11px] font-medium text-[#94a3b8] select-none">
                      12:00
                    </span>
                  )}
                  {dockSettings.showAvatars && (
                    <div className="size-4 rounded-full bg-accent/40 text-[9px] font-bold flex items-center justify-center text-white select-none inline-block">
                      S
                    </div>
                  )}
                  {dockSettings.showBadges && (
                    <span className="rounded bg-[#16a34a] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight">
                      Mod
                    </span>
                  )}
                  <span
                    className="font-bold text-sky-400"
                    style={{ fontSize: `${dockSettings.nameFontSize ?? 13}px`, fontFamily: fontStack }}
                  >
                    Streamer
                  </span>
                  <span className="text-white/60 font-bold">:</span>
                  <span
                    className="text-[#f8fafc] font-normal"
                    style={{ fontSize: `${dockSettings.textFontSize ?? 13}px`, fontFamily: fontStack }}
                  >
                    Stream chat · أهلاً بالبث 🔥
                  </span>
                </div>
              </div>
            </div>

            {/* Density */}
            <div className="space-y-1.5 border-t border-white/[0.12] pt-3">
              <label className="text-xs font-medium text-slate-200">{t(lang, 'obsChat.density')}</label>
              <div className="grid grid-cols-2 gap-1">
                {(['compact', 'comfortable'] as const).map((density) => (
                  <button
                    key={density}
                    type="button"
                    onClick={() => store.updateSettings({ density })}
                    className={`h-7 rounded text-xs transition-colors capitalize ${
                      dockSettings.density === density
                        ? 'bg-accent text-accent-contrast font-bold'
                        : 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.14] hover:text-white'
                    }`}
                  >
                    {t(lang, `obsChat.${density}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2.5 border-t border-white/[0.12] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-200">{t(lang, 'obsChat.timestamps')}</span>
                <Switch
                  label={t(lang, 'obsChat.timestamps')}
                  checked={dockSettings.showTimestamps}
                  onChange={(v) => store.updateSettings({ showTimestamps: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-200">{t(lang, 'obsChat.badges')}</span>
                <Switch
                  label={t(lang, 'obsChat.badges')}
                  checked={dockSettings.showBadges}
                  onChange={(v) => store.updateSettings({ showBadges: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-200">{t(lang, 'obsChat.avatars')}</span>
                <Switch
                  label={t(lang, 'obsChat.avatars')}
                  checked={dockSettings.showAvatars}
                  onChange={(v) => store.updateSettings({ showAvatars: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-200">{t(lang, 'obsChat.highlightMentions')}</span>
                <Switch
                  label={t(lang, 'obsChat.highlightMentions')}
                  checked={dockSettings.highlightMentions}
                  onChange={(v) => store.updateSettings({ highlightMentions: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-200">{t(lang, 'obsChat.soundOnMention')}</span>
                <Switch
                  label={t(lang, 'obsChat.soundOnMention')}
                  checked={dockSettings.soundOnMention}
                  onChange={(v) => store.updateSettings({ soundOnMention: v })}
                />
              </div>
            </div>

            {/* Standalone Link */}
            <div className="border-t border-white/[0.12] pt-3">
              <a
                href={store.dockUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 hover:underline"
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
  fontStack: string;
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
  fontStack,
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

  const userColor = ensureReadableColor(message.color);
  const nameSize = settings.nameFontSize ?? settings.fontSize ?? 13;
  const textSize = settings.textFontSize ?? settings.fontSize ?? 13;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative rounded-[5px] px-2 transition-colors animate-chat-in ${
        settings.density === 'compact' ? 'py-1' : 'py-1.5'
      } ${
        message.deleted
          ? 'opacity-40 bg-red-950/10 line-through'
          : hovered
          ? 'bg-white/[0.06]'
          : 'hover:bg-white/[0.04]'
      } ${message.isBroadcaster ? 'border-s-2 border-accent/80' : ''}`}
      style={{ fontFamily: fontStack }}
    >
      <div className="flex items-baseline gap-1.5 flex-wrap">
        {/* Timestamp */}
        {settings.showTimestamps && timeStr && (
          <span className="font-mono text-[11px] font-medium text-[#94a3b8] select-none shrink-0">
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
              <span className="rounded bg-[#dc2626] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight shadow-sm" title="Broadcaster">
                Host
              </span>
            )}
            {message.isMod && (
              <span className="rounded bg-[#16a34a] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight shadow-sm" title="Moderator">
                Mod
              </span>
            )}
            {message.isVip && (
              <span className="rounded bg-[#d946ef] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight shadow-sm" title="VIP">
                VIP
              </span>
            )}
            {message.isSubscriber && !message.isBroadcaster && (
              <span className="rounded bg-[#9333ea] px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-white leading-tight shadow-sm" title="Subscriber">
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

        {/* Message Text */}
        <span
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`break-words text-[#f8fafc] font-normal leading-relaxed select-text ${
            isRtl ? 'font-arabic' : 'font-sans'
          }`}
          style={{ fontSize: `${textSize}px`, fontFamily: fontStack }}
        >
          {message.deleted ? (
            <em className="text-rose-400 font-mono text-[11.5px] italic select-none">{t(lang, 'obsChat.deleted')}</em>
          ) : (
            <DockMessageText text={message.message} emotes={message.emotes} isRtl={isRtl} />
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
            title={t(lang, 'obsChat.mention')}
          >
            <AtSign size={13} strokeWidth={2.2} />
          </button>

          {/* Shoutout */}
          <button
            type="button"
            onClick={() => onShoutout(message.username)}
            className="rounded p-1 text-purple-400 hover:text-white hover:bg-purple-500/30 transition-colors cursor-pointer"
            title={t(lang, 'obsChat.shoutout')}
          >
            <Megaphone size={13} strokeWidth={2.2} />
          </button>

          {/* Timeout 60s */}
          <button
            type="button"
            onClick={() => onTimeout(message.username)}
            className="rounded p-1 text-amber-400 hover:text-white hover:bg-amber-500/30 transition-colors cursor-pointer"
            title={t(lang, 'obsChat.timeout')}
          >
            <Clock size={13} strokeWidth={2.2} />
          </button>

          {/* Ban User */}
          <button
            type="button"
            onClick={() => onBan(message.username)}
            className="rounded p-1 text-rose-400 hover:text-white hover:bg-rose-500/30 transition-colors cursor-pointer"
            title={t(lang, 'obsChat.ban')}
          >
            <Ban size={13} strokeWidth={2.2} />
          </button>

          {/* Delete Message */}
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            className="rounded p-1 text-red-400 hover:text-white hover:bg-red-500/30 transition-colors cursor-pointer"
            title={t(lang, 'obsChat.delete')}
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
  isRtl,
}: {
  text: string;
  emotes?: readonly { id: string; start: number; end: number }[];
  isRtl: boolean;
}) {
  const { tokens } = useMemo(
    () => tokenizeMessage(text, emotes, undefined, { twitch: true }),
    [text, emotes],
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
