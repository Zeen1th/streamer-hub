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
import { rpc } from './rpc';
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
import { ObsChatView } from './components/tools/chat/ObsChatView';
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

  useEffect(() => { void useUpdateStore.getState().check(); }, []);

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
      });
      useLogStore.getState().addLocal({ kind: 'chat', message: message.message, username: message.username });
      useCounterStore.getState().handleChatMessage(message);
      useAutoReplyStore.getState().handleChatMessage(message);
      useSequenceStore.getState().handleChatMessage(message);
      useChatOverlayStore.getState().addMessage(message);
      useObsChatOverlayStore.getState().addMessage(message);
      useObsChatStore.getState().addMessage(message);
    });
    const offRedemption = rpc.on(Events.TwitchChannelPointsRedeemed, (redemption) => {
      useSequenceStore.getState().handleChannelPointsRedemption(redemption);
    });
    const offRaid = rpc.on(Events.TwitchRaid, (raid) => {
      useSequenceStore.getState().handleRaid(raid);
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
      try {
        if (!disposed) {
          await Promise.all([
            useChatOverlayStore.getState().load(),
            useObsChatOverlayStore.getState().load(),
          ]);
        }
      } catch { void 0; }
      try {
        const settings = await rpc.invoke(Channels.SettingsGetState);
        if (!disposed) useSettingsStore.getState().hydrate(settings.twitch.clientId, settings.twitch.clientSecret, settings.language, settings.botAccountEnabled, settings.preferredChatSender, settings.startupEnabled, settings.closeToTray);
      } catch { void 0; }
      try { const keys = await rpc.invoke(Channels.OpenRouterGetState); if (!disposed) useSettingsStore.getState().hydrateOpenRouter(keys.configured, keys.groqConfigured); } catch { void 0; }
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
      offStatus(); offMaximized(); offChat(); offRedemption(); offRaid(); offProfile(); offCleared(); offCoreLog(); offKeybind(); offTitle();
      window.clearInterval(poll);
    };
  }, []);

  return (
    <div
      data-app={resolvedTheme}
      className={cn(
        'app-shell flex h-full w-full min-w-[900px] flex-col overflow-hidden font-sans text-ink',
        resolvedTheme === 'dark' ? 'bg-[#1a2228]' : 'bg-surface',
      )}
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
            {tab === 'activity' && <ActivityLog className="min-h-0 flex-1" />}
            {tab === 'settings' && <SettingsView />}
          </main>
        </div>
      )}
      <ReauthPromptModal />
      <WindowResizeHandles />
    </div>
  );
}
