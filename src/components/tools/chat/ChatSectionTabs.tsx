import { MessageSquare, Tv } from 'lucide-react';
import { t } from '../../../i18n/translations';
import { useSettingsStore } from '../../../store/settingsStore';
import { useToolStore, type AppTab } from '../../../store/toolStore';

const TABS: { id: AppTab; labelKey: string; icon: typeof Tv }[] = [
  { id: 'overlay', labelKey: 'chat.tabOverlays', icon: Tv },
  { id: 'obs-chat', labelKey: 'chat.tabStreamerChat', icon: MessageSquare },
];

/** The Chat page's own navigation: the chat overlay editor and the streamer chat dock (both used to be sidebar items). */
export function ChatSectionTabs() {
  const activeTab = useToolStore((s) => s.activeTab);
  const setTab = useToolStore((s) => s.setTab);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  return (
    <div role="tablist" aria-label={t(lang, 'chat.tabsLabel')} className="flex h-[42px] shrink-0 items-end gap-1 border-b border-white/[0.08] bg-[#1a2228] px-3">
      {TABS.map((tab) => {
        const selected = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-nav={tab.id === 'obs-chat' ? 'obs-chat' : undefined}
            onClick={() => setTab(tab.id)}
            className={`relative flex h-[36px] items-center gap-2 px-3 text-[13px] transition-colors ${
              selected
                ? 'font-semibold text-white after:absolute after:inset-x-2 after:-bottom-px after:h-[2px] after:rounded-full after:bg-accent'
                : 'font-medium text-[#9aa3af] hover:text-[#f0f3f7]'
            }`}
          >
            <Icon size={14} aria-hidden />
            {t(lang, tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
