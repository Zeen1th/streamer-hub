import { useMemo, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Home,
  Key,
  Menu,
  Settings,
  Terminal,
  Tv,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { t } from '../../i18n/translations';
import { useAutoReplyStore } from '../../store/autoReplyStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useCounterStore } from '../../store/counterStore';
import { useSequenceStore } from '../../store/sequenceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useToolStore } from '../../store/toolStore';
import { projectCommands, type CommandGroup } from '../../lib/commandProjection';
import { rpc } from '../../rpc';
import { Channels } from '../../rpc/contracts';

interface CommandCategoryItem {
  id: CommandGroup;
  labelKey: string;
  count: number;
}

export function AppSidebar() {
  const activeTab = useToolStore((s) => s.activeTab);
  const setTab = useToolStore((s) => s.setTab);
  const activeGroup = useToolStore((s) => s.group);
  const setGroup = useToolStore((s) => s.setGroup);
  const activeSection = useToolStore((s) => s.section);
  const setSection = useToolStore((s) => s.setSection);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const counters = useCounterStore((s) => s.counters);
  const autoReplies = useAutoReplyStore((s) => s.rules);
  const sequences = useSequenceStore((s) => s.sequences);

  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const broadcasterAvatarUrl = useConnectionStore((s) => s.broadcasterAvatarUrl);
  const broadcasterDisplayName = useConnectionStore((s) => s.broadcasterDisplayName);

  const [commandsExpanded, setCommandsExpanded] = useState(true);

  // Calculate live category counts directly via projection
  const rows = useMemo(
    () => projectCommands({ counters, replies: autoReplies, sequences, obsErrors: {} }),
    [counters, autoReplies, sequences],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      counters: rows.filter((r) => r.group === 'counters').length,
      replies: rows.filter((r) => r.group === 'replies').length,
      ai: rows.filter((r) => r.group === 'ai').length,
      sequences: rows.filter((r) => r.group === 'sequences').length,
      disabled: rows.filter((r) => !r.enabled).length,
    }),
    [rows],
  );

  const categories: CommandCategoryItem[] = [
    { id: 'all', labelKey: 'workspace.allCommands', count: counts.all },
    { id: 'counters', labelKey: 'workspace.counters', count: counts.counters },
    { id: 'replies', labelKey: 'workspace.preparedReplies', count: counts.replies },
    { id: 'ai', labelKey: 'workspace.aiReplies', count: counts.ai },
    { id: 'sequences', labelKey: 'workspace.sequences', count: counts.sequences },
    { id: 'disabled', labelKey: 'workspace.disabled', count: counts.disabled },
  ];

  const handleSelectGroup = (groupId: CommandGroup) => {
    setGroup(groupId);
    if (activeTab !== 'commands') {
      setTab('commands');
    }
  };

  const formattedUsername = useMemo(() => {
    if (!twitchConnected) return null;
    const raw = broadcasterDisplayName || twitchChannel;
    if (!raw) return null;
    return raw.startsWith('@') ? raw : `@${raw.replace(/^#+/, '')}`;
  }, [broadcasterDisplayName, twitchChannel, twitchConnected]);

  return (
    <aside
      className="flex h-full w-[236px] shrink-0 select-none flex-col border-e border-white/[0.08] bg-[#1a2228] text-ink"
      data-od-id="sidebar"
      aria-label="Application Sidebar"
    >
      {/* Top Workspace Header */}
      <div className="flex h-[40px] shrink-0 items-center gap-[9px] px-[14px] border-b border-white/[0.08]">
        <Menu size={16} className="text-[#9aa3af]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9aa3af]">
          Workspace
        </span>
      </div>

      {/* Main Navigation Scroll Area */}
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2 custom-scrollbar" aria-label="Primary">
        {/* Home Item */}
        <button
          type="button"
          onClick={() => setTab('home')}
          data-nav="home"
          data-od-id="nav-home"
          className={cn(
            'group relative mx-2 flex h-[34px] w-[calc(100%-16px)] items-center gap-[10px] rounded-[6px] px-[10px] text-start text-[12.5px] font-medium transition-colors',
            activeTab === 'home'
              ? 'bg-[#2A3138] text-white font-bold before:content-[""] before:absolute before:-left-2 before:top-[7px] before:bottom-[7px] before:w-[3px] before:rounded-r-[3px] before:bg-accent'
              : 'text-[#9aa3af] hover:bg-white/[0.05] hover:text-[#f0f3f7]',
          )}
        >
          <Home size={16} className="shrink-0" />
          <span className="flex-1 truncate">Home</span>
        </button>

        {/* Commands Group Accordion */}
        <div className="flex flex-col mt-0.5">
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'commands') {
                setTab('commands');
              } else {
                setCommandsExpanded((v) => !v);
              }
            }}
            data-nav="commands"
            data-od-id="nav-commands"
            className={cn(
              'group relative mx-2 flex h-[34px] w-[calc(100%-16px)] items-center gap-[10px] rounded-[6px] px-[10px] text-start text-[12.5px] font-medium transition-colors',
              activeTab === 'commands'
                ? 'bg-[#2A3138] text-white font-bold before:content-[""] before:absolute before:-left-2 before:top-[7px] before:bottom-[7px] before:w-[3px] before:rounded-r-[3px] before:bg-accent'
                : 'text-[#9aa3af] hover:bg-white/[0.05] hover:text-[#f0f3f7]',
            )}
          >
            <Terminal size={16} className="shrink-0" />
            <span className="flex-1 truncate">Commands</span>
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                setCommandsExpanded((v) => !v);
              }}
              className="grid size-[14px] place-items-center rounded-[4px] p-0.5 text-[#868F9D] hover:bg-white/[0.08] hover:text-white transition-colors"
              aria-label={commandsExpanded ? 'Collapse commands' : 'Expand commands'}
            >
              {commandsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>

          {/* Nested Command Categories */}
          {commandsExpanded && (
            <div className="flex flex-col gap-[1px] py-1 px-2">
              {categories.map((cat) => {
                const isSelected = activeTab === 'commands' && activeGroup === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectGroup(cat.id)}
                    className={cn(
                      'group flex h-[30px] w-full items-center gap-[9px] rounded-[6px] ps-[34px] pe-[10px] text-start text-[12px] transition-colors',
                      isSelected
                        ? 'bg-[#2A3138] text-white font-bold'
                        : 'text-[#9aa3af] hover:bg-white/[0.05] hover:text-[#f0f3f7] font-medium',
                    )}
                  >
                    <span className="flex-1 truncate">{t(lang, cat.labelKey)}</span>
                    <span
                      className={cn(
                        'ms-auto font-mono text-[10.5px] leading-[16px] px-[5px] rounded-[4px] border',
                        isSelected
                          ? 'border-white/[0.12] bg-white/[0.08] text-white font-bold'
                          : 'border-white/[0.08] bg-white/[0.04] text-[#9aa3af] group-hover:text-[#f0f3f7]',
                      )}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat Overlay Navigation Item */}
        <button
          type="button"
          onClick={() => setTab('overlay')}
          data-nav="overlay"
          data-od-id="nav-overlay"
          className={cn(
            'group relative mx-2 flex h-[34px] w-[calc(100%-16px)] items-center gap-[10px] rounded-[6px] px-[10px] text-start text-[12.5px] font-medium transition-colors',
            activeTab === 'overlay'
              ? 'bg-[#2A3138] text-white font-bold before:content-[""] before:absolute before:-left-2 before:top-[7px] before:bottom-[7px] before:w-[3px] before:rounded-r-[3px] before:bg-accent'
              : 'text-[#9aa3af] hover:bg-white/[0.05] hover:text-[#f0f3f7]',
          )}
        >
          <Tv size={16} className="shrink-0" />
          <span className="flex-1 truncate">Chat Overlay</span>
        </button>

        {/* Activity Log Navigation Item */}
        <button
          type="button"
          onClick={() => setTab('activity')}
          data-nav="activity"
          data-od-id="nav-activity"
          className={cn(
            'group relative mx-2 flex h-[34px] w-[calc(100%-16px)] items-center gap-[10px] rounded-[6px] px-[10px] text-start text-[12.5px] font-medium transition-colors',
            activeTab === 'activity'
              ? 'bg-[#2A3138] text-white font-bold before:content-[""] before:absolute before:-left-2 before:top-[7px] before:bottom-[7px] before:w-[3px] before:rounded-r-[3px] before:bg-accent'
              : 'text-[#9aa3af] hover:bg-white/[0.05] hover:text-[#f0f3f7]',
          )}
        >
          <Activity size={16} className="shrink-0" />
          <span className="flex-1 truncate">Activity</span>
        </button>

        {/* Keybinds Navigation Item */}
        <button
          type="button"
          onClick={() => {
            setSection('keybinds');
            setTab('settings');
          }}
          data-nav="keybinds"
          data-od-id="nav-keybinds"
          className={cn(
            'group relative mx-2 flex h-[34px] w-[calc(100%-16px)] items-center gap-[10px] rounded-[6px] px-[10px] text-start text-[12.5px] font-medium transition-colors',
            activeTab === 'settings' && activeSection === 'keybinds'
              ? 'bg-[#2A3138] text-white font-bold before:content-[""] before:absolute before:-left-2 before:top-[7px] before:bottom-[7px] before:w-[3px] before:rounded-r-[3px] before:bg-accent'
              : 'text-[#9aa3af] hover:bg-white/[0.05] hover:text-[#f0f3f7]',
          )}
        >
          <Key size={16} className="shrink-0" />
          <span className="flex-1 truncate">Keybinds</span>
        </button>
      </nav>

      {/* Footer: Settings Button + Streamer Profile Card */}
      <div className="shrink-0 p-2 border-t border-white/[0.08] flex flex-col gap-1.5" data-od-id="sidebar-footer">
        {/* Settings Navigation Item */}
        <button
          type="button"
          onClick={() => {
            setSection('general');
            setTab('settings');
          }}
          data-nav="settings"
          data-od-id="nav-settings"
          className={cn(
            'group relative flex h-[34px] w-full items-center gap-[10px] rounded-[6px] px-[10px] text-start text-[12.5px] font-medium transition-colors',
            activeTab === 'settings' && activeSection !== 'keybinds'
              ? 'bg-[#2A3138] text-white font-bold'
              : 'text-[#9aa3af] hover:bg-white/[0.05] hover:text-[#f0f3f7]',
          )}
        >
          <Settings size={16} className="shrink-0" />
          <span className="flex-1 truncate">Settings</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!twitchConnected) {
              void rpc.invoke(Channels.TwitchAuthorize).catch(() => undefined);
            } else {
              setSection('twitch');
              setTab('settings');
            }
          }}
          data-od-id="profile-card"
          title={twitchConnected ? `Logged in as ${formattedUsername || 'Streamer'}` : 'Click to connect Twitch account'}
          className="group flex w-full items-center gap-[10px] rounded-[7px] border border-white/[0.08] bg-[#222A30] p-2 text-start transition-all hover:border-white/[0.15] hover:bg-[#262E35]"
        >
          {/* Avatar */}
          <div className="size-[30px] shrink-0 overflow-hidden rounded-[6px] flex items-center justify-center font-bold text-[12px] text-white bg-gradient-to-br from-[#7C5CE0] to-[#1E8FE0]">
            {broadcasterAvatarUrl ? (
              <img
                src={broadcasterAvatarUrl}
                alt="Avatar"
                className="size-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <span>{formattedUsername ? formattedUsername.replace(/^@/, '')[0]?.toUpperCase() : 'A'}</span>
            )}
          </div>

          {/* Profile Meta */}
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[12px] font-bold text-white leading-normal pb-0.5">
              {formattedUsername || '@Streamer'}
            </strong>
            <span className="flex items-center gap-[6px] text-[10.5px] text-[#9aa3af] leading-tight mt-[2px]">
              <i
                className={cn(
                  'inline-block size-2 rounded-full shrink-0',
                  twitchConnected
                    ? 'bg-[#22C55E] shadow-[0_0_0_3px_rgba(34,197,94,0.16)]'
                    : 'bg-[#F5B324] shadow-[0_0_0_3px_rgba(245,179,36,0.16)]',
                )}
              />
              <span className="truncate">
                {twitchConnected ? 'Broadcaster · Online' : 'Offline · Connect'}
              </span>
            </span>
          </div>

          <ChevronsUpDown size={14} className="shrink-0 text-[#868F9D] group-hover:text-white transition-colors" />
        </button>
      </div>
    </aside>
  );
}
