import { useMemo, type ReactNode } from 'react';
import { BarChart3, ChevronsUpDown, Film, Home, MessageSquare, Settings, Terminal } from 'lucide-react';
import { cn } from '../../lib/cn';
import { t } from '../../i18n/translations';
import { useConnectionStore } from '../../store/connectionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useToolStore, type AppTab } from '../../store/toolStore';
import { rpc } from '../../rpc';
import { Channels } from '../../rpc/contracts';

/*
 * The sidebar holds only the main places. Each page carries its own sub-navigation
 * (command types on Commands, overlays and the streamer chat on Chat), and the
 * keybinds and the troubleshooting log live in Settings.
 */

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick(): void;
}

function NavButton({ item }: { item: NavItem }) {
  return (
    <button
      type="button"
      onClick={item.onClick}
      data-nav={item.id}
      data-od-id={`nav-${item.id}`}
      aria-current={item.active ? 'page' : undefined}
      className={cn(
        'group relative flex h-[36px] w-full items-center gap-3 rounded-[6px] ps-4 pe-3 text-start text-[13.5px] transition-colors',
        item.active
          ? 'bg-[#2A3138] text-white font-semibold before:content-[""] before:absolute before:start-0 before:top-[10px] before:h-4 before:w-[3px] before:rounded-full before:bg-accent'
          : 'text-[#c3cad3] hover:bg-white/[0.05] hover:text-[#f0f3f7]',
      )}
    >
      <span className="grid size-4 shrink-0 place-items-center">{item.icon}</span>
      <span className="flex-1 truncate">{item.label}</span>
    </button>
  );
}

export function AppSidebar() {
  const activeTab = useToolStore((s) => s.activeTab);
  const setTab = useToolStore((s) => s.setTab);
  const setSection = useToolStore((s) => s.setSection);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const broadcasterAvatarUrl = useConnectionStore((s) => s.broadcasterAvatarUrl);
  const broadcasterDisplayName = useConnectionStore((s) => s.broadcasterDisplayName);

  const formattedUsername = useMemo(() => {
    if (!twitchConnected) return null;
    const raw = broadcasterDisplayName || twitchChannel;
    if (!raw) return null;
    return raw.startsWith('@') ? raw : `@${raw.replace(/^#+/, '')}`;
  }, [broadcasterDisplayName, twitchChannel, twitchConnected]);

  const go = (tab: AppTab) => () => setTab(tab);
  const isChat = activeTab === 'overlay' || activeTab === 'obs-chat';

  const items: NavItem[] = [
    { id: 'home', label: t(lang, 'nav.home'), icon: <Home size={16} />, active: activeTab === 'home', onClick: go('home') },
    { id: 'commands', label: t(lang, 'workspace.commands'), icon: <Terminal size={16} />, active: activeTab === 'commands', onClick: go('commands') },
    // Opens the tab last used inside the Chat page (overlay editor or streamer chat)
    { id: 'overlay', label: t(lang, 'nav.chatSection'), icon: <MessageSquare size={16} />, active: isChat, onClick: () => { if (!isChat) setTab('overlay'); } },
  ];

  const tools: NavItem[] = [
    { id: 'votes', label: t(lang, 'nav.votesShort'), icon: <BarChart3 size={16} />, active: activeTab === 'votes', onClick: go('votes') },
    { id: 'alerts', label: t(lang, 'nav.alerts'), icon: <Film size={16} />, active: activeTab === 'alerts', onClick: go('alerts') },
  ];

  const settingsItem: NavItem = {
    id: 'settings',
    label: t(lang, 'nav.settings'),
    icon: <Settings size={16} />,
    active: activeTab === 'settings',
    onClick: () => {
      setSection('connections');
      setTab('settings');
    },
  };

  return (
    <aside
      data-chrome
      className="flex h-full w-[212px] shrink-0 select-none flex-col border-e border-white/[0.08] bg-[#1a2228] text-ink"
      data-od-id="sidebar"
      aria-label={t(lang, 'nav.sidebar')}
    >
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3 custom-scrollbar" aria-label={t(lang, 'nav.sidebar')}>
        {items.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}
        {/* Stand-alone tools, a quiet second group under the main pages */}
        <div className="mx-[10px] mb-1 mt-4 font-sans text-[11.5px] text-[#8b94a1]">{t(lang, 'nav.tools')}</div>
        {tools.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}
      </nav>

      <div className="flex shrink-0 flex-col gap-1.5 border-t border-white/[0.08] p-2" data-od-id="sidebar-footer">
        <NavButton item={settingsItem} />

        <button
          type="button"
          onClick={() => {
            if (!twitchConnected) {
              void rpc.invoke(Channels.TwitchAuthorize).catch(() => undefined);
            } else {
              setSection('connections');
              setTab('settings');
            }
          }}
          data-od-id="profile-card"
          title={twitchConnected ? formattedUsername ?? '' : t(lang, 'workspace.connectTwitch')}
          className="group flex w-full items-center gap-[10px] rounded-[7px] border border-white/[0.08] bg-[#222A30] p-2 text-start transition-colors hover:border-white/[0.15] hover:bg-[#262E35]"
        >
          <div className="flex size-[30px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[#2f2a45] text-[12px] font-bold text-white">
            {broadcasterAvatarUrl ? (
              <img
                src={broadcasterAvatarUrl}
                alt=""
                className="size-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <span>{formattedUsername ? formattedUsername.replace(/^@/, '')[0]?.toUpperCase() : '?'}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <strong dir="auto" className="block truncate pb-0.5 text-[12px] font-bold leading-normal text-white">
              {formattedUsername || t(lang, 'workspace.notConnected')}
            </strong>
            <span className="mt-[2px] flex items-center gap-[6px] text-[10.5px] leading-tight text-[#9aa3af]">
              <i className={cn('inline-block size-2 shrink-0 rounded-full', twitchConnected ? 'bg-[#22C55E]' : 'bg-[#F5B324]')} />
              <span className="truncate">{twitchConnected ? t(lang, 'nav.online') : t(lang, 'workspace.connectTwitch')}</span>
            </span>
          </div>
          <ChevronsUpDown size={14} className="shrink-0 text-[#868F9D] transition-colors group-hover:text-white" />
        </button>
      </div>
    </aside>
  );
}
