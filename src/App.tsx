import { useEffect } from 'react';
import { Languages } from 'lucide-react';
import { Sidebar } from './components/layout/Sidebar';
import { Titlebar } from './components/titlebar/Titlebar';
import { CounterView } from './components/tools/counter/CounterView';
import { HomeView } from './components/tools/home/HomeView';
import { SettingsView } from './components/tools/settings/SettingsView';
import { AutoRepliesView } from './components/tools/auto-replies/AutoRepliesView';
import { ChatView } from './components/tools/chat/ChatView';
import { ActivityLog } from './components/tools/counter/ActivityLog';
import { t } from './i18n/translations';
import { rpc } from './rpc';
import { Channels, Events } from './rpc/contracts';
import { useConnectionStore } from './store/connectionStore';
import { useCounterStore } from './store/counterStore';
import { useAutoReplyStore } from './store/autoReplyStore';
import { useChatOverlayStore } from './store/chatOverlayStore';
import { useLogStore } from './store/logStore';
import { useSettingsStore } from './store/settingsStore';
import { useToolStore } from './store/toolStore';
import { useUpdateStore } from './store/updateStore';

export default function App() {
  const activeTool = useToolStore((s) => s.activeTool);
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const lang = language === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = lang;
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    void useUpdateStore.getState().check();
  }, []);

  useEffect(() => {
    let disposed = false;

    const offStatus = rpc.on(Events.CoreStatusChanged, (status) => {
      useConnectionStore.getState().setStatus(status);
      useChatOverlayStore.getState().setCoreConnected(status.coreConnected);
    });
    const offMaximized = rpc.on(Events.WindowMaximizedChanged, (payload) => {
      useConnectionStore.getState().setMaximized(payload.isMaximized);
    });
    const offChat = rpc.on(Events.TwitchChatMessage, (message) => {
      useLogStore.getState().addLocal({ kind: 'chat', message: message.message, username: message.username });
      useCounterStore.getState().handleChatMessage(message);
      useAutoReplyStore.getState().handleChatMessage(message);
      useChatOverlayStore.getState().addMessage(message);
    });
    // A viewer's first message is published before their avatar is known, so
    // the resolved profile arrives separately and patches messages on screen.
    const offProfile = rpc.on(Events.TwitchUserProfile, (payload) => {
      useChatOverlayStore.getState().applyProfile(payload.userId, payload.avatarUrl, payload.color);
    });
    const offCleared = rpc.on(Events.TwitchChatCleared, (payload) => {
      useChatOverlayStore.getState().clearByScope(payload.scope, payload.id);
    });
    const offCoreLog = rpc.on(Events.CoreLog, (payload) => {
      useLogStore.getState().addLocal({ kind: 'system', message: payload.message });
    });

    const boot = async () => {
      try {
        const status = await rpc.invoke(Channels.CoreGetStatus);
        if (!disposed) {
          useConnectionStore.getState().setStatus(status);
          useChatOverlayStore.getState().setCoreConnected(status.coreConnected);
        }
      } catch {
        if (!disposed) {
          useConnectionStore.getState().setCoreConnected(false);
          useChatOverlayStore.getState().setCoreConnected(false);
        }
      }
      try {
        const maximized = await rpc.invoke(Channels.WindowIsMaximized);
        if (!disposed) useConnectionStore.getState().setMaximized(maximized.isMaximized);
      } catch {
        void 0;
      }
      try {
        const counters = await rpc.invoke(Channels.CountersGetState);
        if (!disposed) useCounterStore.getState().hydrate(counters);
      } catch {
        void 0;
      }
      try {
        const rules = await rpc.invoke(Channels.AutoRepliesGetState);
        if (!disposed) useAutoReplyStore.getState().hydrate(rules);
        const autoReplySettings = await rpc.invoke(Channels.AutoRepliesSettingsGet);
        if (!disposed) useAutoReplyStore.getState().hydrateGlobalSettings(autoReplySettings);
      } catch {
        void 0;
      }
      try {
        if (!disposed) {
          await useChatOverlayStore.getState().load();
        }
      } catch {
        void 0;
      }
      try {
        const settings = await rpc.invoke(Channels.SettingsGetState);
        if (!disposed) {
          useSettingsStore
            .getState()
            .hydrate(settings.twitch.clientId, settings.twitch.clientSecret, settings.language, settings.botAccountEnabled, settings.startupEnabled, settings.closeToTray);
        }
      } catch {
        void 0;
      }
      try {
        const openRouter = await rpc.invoke(Channels.OpenRouterGetState);
        if (!disposed) useSettingsStore.getState().hydrateOpenRouter(openRouter.configured, openRouter.groqConfigured);
      } catch {
        void 0;
      }
    };
    void boot();

    const poll = window.setInterval(() => {
      rpc
        .invoke(Channels.CoreGetStatus)
        .then((status) => {
          useConnectionStore.getState().setStatus(status);
          useChatOverlayStore.getState().setCoreConnected(status.coreConnected);
        })
        .catch(() => {
          useConnectionStore.getState().setCoreConnected(false);
          useChatOverlayStore.getState().setCoreConnected(false);
        });
    }, 10000);

    return () => {
      disposed = true;
      offStatus();
      offMaximized();
      offChat();
      offProfile();
      offCleared();
      offCoreLog();
      window.clearInterval(poll);
    };
  }, []);

  const effectiveLang = language === 'ar' ? 'ar' : 'en';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface font-sans text-ink">
      <Titlebar />
      {language === '' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50">
          <div className="slab w-full max-w-sm p-8 text-center">
            <div className="flex justify-center">
              <Languages size={26} className="text-primary" aria-hidden />
            </div>
            <h1 className="mt-4 font-display text-xl uppercase leading-tight tracking-[0.04em] text-ink">
              {t(effectiveLang, 'firstrun.title')}
            </h1>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="slab cursor-pointer px-4 py-4 font-display text-lg text-ink transition-colors duration-150 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={() => useSettingsStore.getState().setLanguage('ar')}
              >
                {t(effectiveLang, 'firstrun.arabic')}
              </button>
              <button
                type="button"
                className="slab cursor-pointer px-4 py-4 font-display text-lg text-ink transition-colors duration-150 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={() => useSettingsStore.getState().setLanguage('en')}
              >
                {t(effectiveLang, 'firstrun.english')}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="app-scroll min-w-0 flex-1">
          <div className="mx-auto max-w-[1400px] px-8 py-8">
            {activeTool === 'home' && <HomeView />}
            {activeTool === 'counter' && <CounterView />}
            {activeTool === 'autoReplies' && <AutoRepliesView />}
            {activeTool === 'chat' && <ChatView />}
            {activeTool === 'feed' && <ActivityLog className="w-full" />}
            {activeTool === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>
    </div>
  );
}

