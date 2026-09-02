import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Titlebar } from './components/titlebar/Titlebar';
import { WindowResizeHandles } from './components/titlebar/WindowResizeHandles';
import { CommandsView } from './components/commands/CommandsView';
import { SettingsView } from './components/tools/settings/SettingsView';
import { ChatView } from './components/tools/chat/ChatView';
import { ActivityLog } from './components/tools/counter/ActivityLog';
import { Button } from './components/ui/Button';
import { t } from './i18n/translations';
import { resolveTheme, type ResolvedTheme } from './lib/theme';
import { rpc } from './rpc';
import { Channels, Events } from './rpc/contracts';
import { useConnectionStore } from './store/connectionStore';
import { useCounterStore } from './store/counterStore';
import { useAutoReplyStore } from './store/autoReplyStore';
import { useChatOverlayStore } from './store/chatOverlayStore';
import { useLogStore } from './store/logStore';
import { useKeybindStore } from './store/keybindStore';
import { useSettingsStore } from './store/settingsStore';
import { useToolStore, type AppTab } from './store/toolStore';
import { useUpdateStore } from './store/updateStore';

const TAB_KEYS: Record<AppTab, string> = {
  commands: 'workspace.commands',
  overlay: 'workspace.overlay',
  activity: 'workspace.activity',
  settings: 'workspace.settings',
};

export default function App() {
  const tab = useToolStore((s) => s.activeTab);
  const setTab = useToolStore((s) => s.setTab);
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const statusReceived = useConnectionStore((s) => s.statusReceived);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(theme, window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false),
  );
  const lang = language === 'ar' ? 'ar' : 'en';

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
      document.documentElement.classList.toggle('theme-dark', resolved === 'dark');
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
    });
    const offMaximized = rpc.on(Events.WindowMaximizedChanged, (payload) => useConnectionStore.getState().setMaximized(payload.isMaximized));
    const offChat = rpc.on(Events.TwitchChatMessage, (message) => {
      useLogStore.getState().addLocal({ kind: 'chat', message: message.message, username: message.username });
      useCounterStore.getState().handleChatMessage(message);
      useAutoReplyStore.getState().handleChatMessage(message);
      useChatOverlayStore.getState().addMessage(message);
    });
    const offProfile = rpc.on(Events.TwitchUserProfile, (payload) => useChatOverlayStore.getState().applyProfile(payload.userId, payload.avatarUrl, payload.color));
    const offCleared = rpc.on(Events.TwitchChatCleared, (payload) => useChatOverlayStore.getState().clearByScope(payload.scope, payload.id));
    const offCoreLog = rpc.on(Events.CoreLog, (payload) => useLogStore.getState().addLocal({ kind: 'system', message: payload.message }));
    const offKeybind = rpc.on(Events.KeybindTriggered, ({ bindingId }) => useKeybindStore.getState().trigger(bindingId));

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
      try { const maximized = await rpc.invoke(Channels.WindowIsMaximized); if (!disposed) useConnectionStore.getState().setMaximized(maximized.isMaximized); } catch { void 0; }
      try { await useKeybindStore.getState().load(); } catch { void 0; }
      try { const counters = await rpc.invoke(Channels.CountersGetState); if (!disposed) useCounterStore.getState().hydrate(counters); } catch { void 0; }
      try {
        const rules = await rpc.invoke(Channels.AutoRepliesGetState);
        if (!disposed) useAutoReplyStore.getState().hydrate(rules);
        const settings = await rpc.invoke(Channels.AutoRepliesSettingsGet);
        if (!disposed) useAutoReplyStore.getState().hydrateGlobalSettings(settings);
      } catch { void 0; }
      try { if (!disposed) await useChatOverlayStore.getState().load(); } catch { void 0; }
      try {
        const settings = await rpc.invoke(Channels.SettingsGetState);
        if (!disposed) useSettingsStore.getState().hydrate(settings.twitch.clientId, settings.twitch.clientSecret, settings.language, settings.botAccountEnabled, settings.startupEnabled, settings.closeToTray);
      } catch { void 0; }
      try { const keys = await rpc.invoke(Channels.OpenRouterGetState); if (!disposed) useSettingsStore.getState().hydrateOpenRouter(keys.configured, keys.groqConfigured); } catch { void 0; }
    };
    void boot();

    const poll = window.setInterval(() => {
      rpc.invoke(Channels.CoreGetStatus).then((status) => {
        useConnectionStore.getState().setStatus(status);
        useChatOverlayStore.getState().setCoreConnected(status.coreConnected);
      }).catch(() => {
        useConnectionStore.getState().setCoreConnected(false);
        useChatOverlayStore.getState().setCoreConnected(false);
      });
    }, 10000);

    return () => {
      disposed = true;
      offStatus(); offMaximized(); offChat(); offProfile(); offCleared(); offCoreLog(); offKeybind();
      window.clearInterval(poll);
    };
  }, []);

  return (
    <div data-app={resolvedTheme} className="app-shell flex h-screen min-w-[900px] flex-col overflow-hidden bg-surface font-sans text-ink">
      <Titlebar />
      <nav className="flex h-[34px] shrink-0 items-stretch border-b border-rule bg-surface-2" aria-label={t(lang, 'workspace.tabs')}>
        {(Object.keys(TAB_KEYS) as AppTab[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
            className={`relative px-[22px] text-[13px] ${tab === id ? 'border-t-2 border-accent bg-surface font-extrabold text-ink' : 'border-t-2 border-transparent font-medium text-muted hover:bg-accent-soft hover:text-ink'}`}
          >
            {t(lang, TAB_KEYS[id])}
          </button>
        ))}
      </nav>
      {statusReceived && !twitchConnected && (
        <div className="flex min-h-[52px] shrink-0 items-center gap-3 border-y-2 border-accent bg-accent-soft px-3">
          <TriangleAlert size={16} className="shrink-0 text-accent-text" aria-hidden />
          <div className="min-w-0 flex-1 text-[12px] text-ink">
            <strong>{t(lang, 'workspace.noCommandsFire')}</strong>{' '}
            <span>{t(lang, 'workspace.disconnectedExplanation')}</span>
          </div>
          <Button size="sm" onClick={() => rpc.invoke(Channels.TwitchAuthorize).catch(() => undefined)}>{t(lang, 'workspace.connectTwitch')}</Button>
        </div>
      )}
      {language === '' ? (
        <main className="flex min-h-0 flex-1 items-center justify-center bg-surface">
          <section className="w-[420px] border-2 border-rule bg-surface-2 p-6 text-center" aria-labelledby="language-title">
            <h1 id="language-title" className="font-sans text-xl font-extrabold tracking-[-.015em]">{t(lang, 'firstrun.title')}</h1>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button size="lg" variant="outline" onClick={() => useSettingsStore.getState().setLanguage('ar')}>{t(lang, 'firstrun.arabic')}</Button>
              <Button size="lg" variant="outline" onClick={() => useSettingsStore.getState().setLanguage('en')}>{t(lang, 'firstrun.english')}</Button>
            </div>
          </section>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1">
          {tab === 'commands' && <CommandsView />}
          {tab === 'overlay' && <ChatView />}
          {tab === 'activity' && <ActivityLog className="min-h-0 flex-1" />}
          {tab === 'settings' && <SettingsView />}
        </main>
      )}
      <WindowResizeHandles />
    </div>
  );
}
