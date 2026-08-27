import type { LucideIcon } from 'lucide-react';
import { Home, List, MessageSquare, Settings, Tally5, Timer, Tv } from 'lucide-react';
import { cn } from '../../lib/cn';
import { t } from '../../i18n/translations';
import { useSettingsStore } from '../../store/settingsStore';
import { useToolStore } from '../../store/toolStore';

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  soon?: boolean;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, active, soon, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      disabled={soon || !onClick}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 border-s px-6 py-3.5 text-start font-sans text-sm font-semibold uppercase tracking-[0.08em] transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
        active
          ? 'border-primary bg-ink/8 text-ink'
          : 'border-transparent text-ink/70 hover:bg-ink/5 hover:text-ink/85',
        soon && 'cursor-not-allowed hover:bg-transparent hover:text-ink/70',
      )}
    >
      <Icon size={16} strokeWidth={2} className={cn(active ? 'text-primary' : 'text-ink/50')} />
      <span className="flex-1">{label}</span>
      {soon && (
        <span className="border border-ink/30 px-1 py-0.5 font-sans text-xs font-bold tracking-wider text-ink/65">
          {t(useSettingsStore.getState().language === 'ar' ? 'ar' : 'en', 'common.soon')}
        </span>
      )}
    </button>
  );
}

export function Sidebar() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  return (
    <aside className="flex w-56 shrink-0 flex-col border-e border-ink/15 bg-surface">
      <div className="px-6 pb-4 pt-8">
        <div className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-ink/70">
          {t(lang, 'nav.counters')}
        </div>
      </div>
      <nav className="flex flex-col" aria-label="Tools">
        <NavItem
          icon={Home}
          label={t(lang, 'nav.home')}
          active={activeTool === 'home'}
          onClick={() => setActiveTool('home')}
        />
        <NavItem
          icon={Tally5}
          label={t(lang, 'nav.counters')}
          active={activeTool === 'counter'}
          onClick={() => setActiveTool('counter')}
        />
        <NavItem
          icon={MessageSquare}
          label={t(lang, 'nav.autoReplies')}
          active={activeTool === 'autoReplies'}
          onClick={() => setActiveTool('autoReplies')}
        />
        <NavItem
          icon={Tv}
          label={t(lang, 'nav.chat')}
          active={activeTool === 'chat'}
          onClick={() => setActiveTool('chat')}
        />
        <NavItem icon={Timer} label={t(lang, 'nav.timer')} soon />
        <NavItem
          icon={List}
          label={t(lang, 'nav.feed')}
          active={activeTool === 'feed'}
          onClick={() => setActiveTool('feed')}
        />
      </nav>
      <div aria-hidden className="mx-6 my-4 border-t border-ink/10" />
      <nav className="flex flex-col" aria-label="Application">
        <NavItem
          icon={Settings}
          label={t(lang, 'nav.settings')}
          active={activeTool === 'settings'}
          onClick={() => setActiveTool('settings')}
        />
      </nav>
    </aside>
  );
}
