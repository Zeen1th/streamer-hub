import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Titlebar } from './components/titlebar/Titlebar';
import { WindowResizeHandles } from './components/titlebar/WindowResizeHandles';
import { ActionBar } from './components/layout/ActionBar';
import { AppSidebar } from './components/layout/AppSidebar';
import { HomeView } from './components/tools/home/HomeView';
import { CommandsView } from './components/commands/CommandsView';
import { SettingsView } from './components/tools/settings/SettingsView';
import { ChatView } from './components/tools/chat/ChatView';
import { ActivityLog } from './components/tools/counter/ActivityLog';
import { Button } from './components/ui/Button';
import { cn } from './lib/cn';
import { t } from './i18n/translations';
import { resolveTheme, type ResolvedTheme } from './lib/theme';
import { isMockMode, rpc } from './rpc';
import { Channels, Events } from './rpc/contracts';
import { useConnectionStore } from './store/connectionStore';
import { useCounterStore } from './store/counterStore';
import { useAutoReplyStore } from './store/autoReplyStore';
import { useSequenceStore } from './store/sequenceStore';
import { useChatOverlayStore, useObsChatOverlayStore } from './store/chatOverlayStore';
import { useObsChatStore } from './store/obsChatStore';
import { useLogStore } from './store/logStore';
import { useKeybindStore } from './store/keybindStore';
import { useSettingsStore } from './store/settingsStore';
import { useToolStore } from './store/toolStore';
import { useUpdateStore } from './store/updateStore';
import { useChatterStore } from './store/chatterStore';
import { useVoteStore } from './store/voteStore';
import { ObsChatView } from './components/tools/chat/ObsChatView';
import { VotesView } from './components/tools/votes/VotesView';
import { AlertCompressorView } from './components/tools/alerts/AlertCompressorView';
import { useAlertCompressorStore } from './store/alertCompressorStore';
import { AutoUpdateToast } from './components/updates/AutoUpdateToast';
import { UndoToast } from './components/undo/UndoToast';
import { undoManager } from './store/undoStore';
import { useEmoteStore } from './store/emoteStore';
import { useGiftStore } from './store/giftStore';
import { WhatsNewDialog } from './components/updates/WhatsNewDialog';
import { ReauthPromptModal } from './components/modals/ReauthPromptModal';

export default function App() {
  const tab = useToolStore((s) => s.activeTab);
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const statusReceived = useConnectionStore((s) => s.statusReceived);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(theme, window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false),
  );
  const lang = language === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    if (twitchConnected && twitchChannel) {
      const username = twitchChannel.replace(/^#+/, '');
      rpc.invoke(Channels.TwitchCheckAvatar, { username })
        .then((res) => {
          if (res.ok && res.avatarUrl) {
            useConnectionStore.getState().setBroadcasterProfile(
              res.avatarUrl,
              res.displayName || res.username || username,
            );
          }
        })
        .catch(() => undefined);
    } else {
      useConnectionStore.getState().setBroadcasterProfile(null, null);
    }
  }, [twitchConnected, twitchChannel]);

  useEffect(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = resolveTheme(theme, media?.matches ?? false);
      setResolvedTheme(resolved);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.toggle('theme-dark', resolved !== 'light');
    };
    apply();
    media?.addEventListener('change', apply);
    return () => media?.removeEventListener('change', apply);
  }, [theme]);

  const effectiveScale = useSettingsStore((s) => s.effectiveScale);

  useEffect(() => {
    const root = document.documentElement as HTMLElement;
    root.style.setProperty('--app-ui-scale', String(effectiveScale));
    if (isMockMode) {
      // Browser preview has no host to zoom the page, so fall back to CSS zoom there
      root.style.zoom = String(effectiveScale);
      return;
    }
    // Real app: zoom the WebView itself (like browser page zoom) so layout and mouse coordinates stay consistent
    root.style.zoom = '';
    void rpc.invoke(Channels.WindowSetZoom, { factor: effectiveScale }).catch(() => undefined);
  }, [effectiveScale]);

  useEffect(() => {
    const handleScreenChange = () => {
      useSettingsStore.getState().refreshAutoScale();
    };
    window.addEventListener('resize', handleScreenChange);
    return () => window.removeEventListener('resize', handleScreenChange);
  }, []);

  useEffect(() => {
    const handleZoomHotkeys = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        useSettingsStore.getState().adjustScale(0.05);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        useSettingsStore.getState().adjustScale(-0.05);
      } else if (e.key === '0') {
        e.preventDefault();
        useSettingsStore.getState().resetScale();
      }
    };
    window.addEventListener('keydown', handleZoomHotkeys);
    return () => window.removeEventListener('keydown', handleZoomHotkeys);
  }, []);

  useEffect(() => { void useUpdateStore.getState().check(); }, []);

  // Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) on the Commands tab. Text fields keep their own undo, and an open dialog
  // owns the keyboard, so neither is intercepted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const undo = key === 'z' && !e.shiftKey;
      const redo = key === 'y' || (key === 'z' && e.shiftKey);
      if (!undo && !redo) return;
      if (useToolStore.getState().activeTab !== 'commands') return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      if (undo) undoManager.undo();
      else undoManager.redo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Repeating-message timers (sequences with a Timer trigger)
  useEffect(() => {
    const tick = window.setInterval(() => void useSequenceStore.getState().tickTimers(), 5_000);
    return () => window.clearInterval(tick);
  }, []);

  // Automatic updates: look shortly after launch (may install after a cancelable countdown), then every few hours
  // (an update found mid-session waits for the next launch so a live stream is never restarted).
  useEffect(() => {
    const first = window.setTimeout(() => void useUpdateStore.getState().runAutoCheck('startup'), 8_000);
    const periodic = window.setInterval(() => void useUpdateStore.getState().runAutoCheck('periodic'), 6 * 60 * 60 * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(periodic);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const offStatus = rpc.on(Events.CoreStatusChanged, (status) => {
      useConnectionStore.getState().setStatus(status);
      useChatOverlayStore.getState().setCoreConnected(status.coreConnected);
      useObsChatOverlayStore.getState().setCoreConnected(status.coreConnected);
    });
    const offMaximized = rpc.on(Events.WindowMaximizedChanged, (payload) => useConnectionStore.getState().setMaximized(payload.isMaximized));
    const offChat = rpc.on(Events.TwitchChatMessage, (message) => {
      useChatterStore.getState().recordChatter({
        userId: message.userId,
        login: message.userLogin || message.username,
        displayName: message.displayName || message.username,
        username: message.username,
        avatarUrl: message.avatarUrl,
        isMod: message.isMod || !!message.isLeadMod,
        isVip: message.isVip,
        isSubscriber: message.isSubscriber,
      });
      useLogStore.getState().addLocal({ kind: 'chat', message: message.message, username: message.username });
      useCounterStore.getState().handleChatMessage(message);
      useAutoReplyStore.getState().handleChatMessage(message);
      useSequenceStore.getState().handleChatMessage(message);
      useChatOverlayStore.getState().addMessage(message);
      useObsChatOverlayStore.getState().addMessage(message);
      useObsChatStore.getState().addMessage(message);
      useVoteStore.getState().handleChatMessage(message);
    });
    const offRedemption = rpc.on(Events.TwitchChannelPointsRedeemed, (redemption) => {
      useSequenceStore.getState().handleChannelPointsRedemption(redemption);
      useAutoReplyStore.getState().handleChannelPointsRedemption(redemption);
    });
    const offRaid = rpc.on(Events.TwitchRaid, (raid) => {
      useSequenceStore.getState().handleRaid(raid);
    });
    const offFollow = rpc.on(Events.TwitchFollow, (follow) => {
      useSequenceStore.getState().handleFollow(follow);
    });
    const offWatchStreak = rpc.on(Events.TwitchWatchStreak, (event) => {
      useSequenceStore.getState().handleWatchStreak(event);
    });
    const offObsStatus = rpc.on(Events.ObsWebsocketStatusChanged, (status) => {
      useSequenceStore.getState().setObsConnected(status.connected);
      useSequenceStore.getState().fetchObsStatus().catch(() => undefined);
      if (status.connected) {
        useSequenceStore.getState().fetchObsAudioSources().catch(() => undefined);
      }
    });
    const offProfile = rpc.on(Events.TwitchUserProfile, (payload) => {
      useChatterStore.getState().recordChatter({
        userId: payload.userId,
        avatarUrl: payload.avatarUrl,
      });
      useChatOverlayStore.getState().applyProfile(payload.userId, payload.avatarUrl, payload.color);
      useObsChatOverlayStore.getState().applyProfile(payload.userId, payload.avatarUrl, payload.color);
      useObsChatStore.getState().applyProfile(payload.userId, payload.avatarUrl, payload.color);
    });
    const offCleared = rpc.on(Events.TwitchChatCleared, (payload) => {
      useChatOverlayStore.getState().clearByScope(payload.scope, payload.id);
      useObsChatOverlayStore.getState().clearByScope(payload.scope, payload.id);
      useObsChatStore.getState().clearByScope(payload.scope, payload.id);
    });
    const offCoreLog = rpc.on(Events.CoreLog, (payload) => useLogStore.getState().addLocal({ kind: 'system', message: payload.message }));
    const offKeybind = rpc.on(Events.KeybindTriggered, ({ bindingId }) => useKeybindStore.getState().trigger(bindingId));
    const offTitle = rpc.on(Events.TwitchTitleChanged, (payload) => {
      window.dispatchEvent(new CustomEvent('twitch-title-changed', { detail: payload.title }));
    });
    const offVotes = rpc.on(Events.VotesChanged, (poll) => {
      useVoteStore.getState().applyRemotePoll(poll);
    });
    const offAlertsProgress = rpc.on(Events.AlertsProgress, (p) => {
      useAlertCompressorStore.getState().handleProgress(p);
    });
    const offAlertsCompleted = rpc.on(Events.AlertsCompleted, (res) => {
      useAlertCompressorStore.getState().handleCompleted(res);
    });
    const offAlertsDownload = rpc.on(Events.AlertsDownloadProgress, (p) => {
      useAlertCompressorStore.getState().handleDownloadProgress(p.percent);
    });

    const boot = async () => {
      try {
        const status = await rpc.invoke(Channels.CoreGetStatus);
        if (!disposed) {
          useConnectionStore.getState().setStatus(status);
          useChatOverlayStore.getState().setCoreConnected(status.coreConnected);
          useObsChatOverlayStore.getState().setCoreConnected(status.coreConnected);
        }
      } catch {
        if (!disposed) {
          useConnectionStore.getState().setCoreConnected(false);
          useChatOverlayStore.getState().setCoreConnected(false);
          useObsChatOverlayStore.getState().setCoreConnected(false);
        }
      }
      try { const maximized = await rpc.invoke(Channels.WindowIsMaximized); if (!disposed) useConnectionStore.getState().setMaximized(maximized.isMaximized); } catch { void 0; }
      try { await useKeybindStore.getState().load(); } catch { void 0; }
      try { const counters = await rpc.invoke(Channels.CountersGetState); if (!disposed) useCounterStore.getState().hydrate(counters); } catch { void 0; }
      try {
        const rules = await rpc.invoke(Channels.AutoRepliesGetState);
        if (!disposed) useAutoReplyStore.getState().hydrate(rules);
        const settings = await rpc.invoke(Channels.AutoRepliesSettingsGet);
        if (!disposed) useAutoReplyStore.getState().hydrateGlobalSettings(settings);
      } catch { void 0; }
      try {
        const sequences = await rpc.invoke(Channels.SequencesGetState);
        if (!disposed) useSequenceStore.getState().hydrate(sequences);
      } catch { void 0; }
      void useEmoteStore.getState().load();
      void useGiftStore.getState().load();
      // Everything saved is loaded: this is where Ctrl+Z history starts
      if (!disposed) undoManager.arm();
      try {
        if (!disposed) {
          await Promise.all([
            useChatOverlayStore.getState().load(),
            useObsChatOverlayStore.getState().load(),
            useVoteStore.getState().loadState(),
          ]);
        }
      } catch { void 0; }
      try {
        const settings = await rpc.invoke(Channels.SettingsGetState);
        if (!disposed) useSettingsStore.getState().hydrate(settings.twitch.clientId, settings.twitch.clientSecret, settings.language, settings.botAccountEnabled, settings.preferredChatSender, settings.startupEnabled, settings.closeToTray);
      } catch { void 0; }
      try { const keys = await rpc.invoke(Channels.OpenRouterGetState); if (!disposed) useSettingsStore.getState().hydrateOpenRouter(keys.configured, keys.groqConfigured); } catch { void 0; }
      try {
        if (!disposed) {
          useSequenceStore.getState().fetchObsStatus().catch(() => undefined);
          useSequenceStore.getState().fetchObsAudioSources().catch(() => undefined);
        }
      } catch { void 0; }
    };
    void boot();

    const poll = window.setInterval(() => {
      rpc.invoke(Channels.CoreGetStatus).then((status) => {
        useConnectionStore.getState().setStatus(status);
        useChatOverlayStore.getState().setCoreConnected(status.coreConnected);
        useObsChatOverlayStore.getState().setCoreConnected(status.coreConnected);
      }).catch(() => {
        useConnectionStore.getState().setCoreConnected(false);
        useChatOverlayStore.getState().setCoreConnected(false);
        useObsChatOverlayStore.getState().setCoreConnected(false);
      });
    }, 10000);

    return () => {
      disposed = true;
      offStatus(); offMaximized(); offChat(); offRedemption(); offRaid(); offFollow(); offWatchStreak(); offObsStatus(); offProfile(); offCleared(); offCoreLog(); offKeybind(); offTitle(); offVotes();
      offAlertsProgress(); offAlertsCompleted(); offAlertsDownload();
      window.clearInterval(poll);
    };
  }, []);

  return (
    <div
      data-app={resolvedTheme}
      className={cn(
        'app-shell flex h-full w-full flex-col overflow-hidden font-sans text-ink',
        resolvedTheme === 'dark' ? 'bg-[#1a2228]' : 'bg-surface',
      )}
      style={{ minWidth: 'min(900px, 100vw)' }}
    >
      <Titlebar />
      <ActionBar />
      {statusReceived && !twitchConnected && (
        <div className="flex min-h-[44px] shrink-0 items-center gap-3 border-b border-amber-500/25 bg-amber-500/10 px-4">
          <TriangleAlert size={16} className="shrink-0 text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1 text-[12px] text-ink">
            <strong className="text-amber-300">{t(lang, 'workspace.noCommandsFire')}</strong>{' '}
            <span className="text-muted">{t(lang, 'workspace.disconnectedExplanation')}</span>
          </div>
          <Button size="sm" onClick={() => rpc.invoke(Channels.TwitchAuthorize).catch(() => undefined)}>{t(lang, 'workspace.connectTwitch')}</Button>
        </div>
      )}
      {language === '' ? (
        <main className="flex min-h-0 flex-1 items-center justify-center bg-surface">
          <section className="w-[420px] rounded-xl border border-rule bg-surface-3 p-6 text-center shadow-xl" aria-labelledby="language-title">
            <h1 id="language-title" className="font-sans text-xl font-bold tracking-tight text-ink">{t(lang, 'firstrun.title')}</h1>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button size="lg" variant="outline" onClick={() => useSettingsStore.getState().setLanguage('ar')}>{t(lang, 'firstrun.arabic')}</Button>
              <Button size="lg" variant="outline" onClick={() => useSettingsStore.getState().setLanguage('en')}>{t(lang, 'firstrun.english')}</Button>
            </div>
          </section>
        </main>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#23282e]">
            {tab === 'home' && <HomeView />}
            {tab === 'commands' && <CommandsView />}
            {tab === 'overlay' && <ChatView target="overlay" />}
            {tab === 'obs-chat' && <ObsChatView />}
            {tab === 'votes' && <VotesView />}
            {tab === 'alerts' && <AlertCompressorView />}
            {tab === 'activity' && <ActivityLog className="min-h-0 flex-1" />}
            {tab === 'settings' && <SettingsView />}
          </main>
        </div>
      )}
      <ReauthPromptModal />
      <UndoToast />
      <WhatsNewDialog />
      <AutoUpdateToast />
      <WindowResizeHandles />
    </div>
  );
}
