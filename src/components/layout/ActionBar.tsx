import { BarChart3, Film, Menu } from 'lucide-react';
import { useToolStore } from '../../store/toolStore';
import { t } from '../../i18n/translations';
import { useSettingsStore } from '../../store/settingsStore';

export function ActionBar() {
  const activeTab = useToolStore((s) => s.activeTab);
  const setTab = useToolStore((s) => s.setTab);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  return (
    <div
      className="flex h-[46px] shrink-0 select-none items-center gap-[2px] border-b border-white/[0.08] bg-[#1a2228] px-2 text-ink"
      data-od-id="actionbar"
    >
      {/* Menu / Home Button */}
      <button
        type="button"
        onClick={() => setTab('home')}
        className={`inline-flex h-[32px] items-center gap-[7px] rounded-[6px] px-[11px] text-[12.5px] font-medium transition-colors ${
          activeTab === 'home'
            ? 'bg-white/[0.08] text-white font-semibold'
            : 'text-[#C3CAD3] hover:bg-white/[0.06] hover:text-white'
        }`}
        title={t(lang, 'home.title')}
      >
        <Menu size={16} className="shrink-0" />
        <span>Menu</span>
      </button>

      {/* Separator */}
      <span className="mx-[5px] h-[18px] w-px bg-white/[0.15]" />

      {/* Live Votes */}
      <button
        type="button"
        onClick={() => setTab('votes')}
        data-nav="votes"
        className={`inline-flex h-[32px] items-center gap-[7px] rounded-[6px] px-[11px] text-[12.5px] font-medium transition-colors ${
          activeTab === 'votes'
            ? 'bg-white/[0.08] text-white font-semibold'
            : 'text-[#C3CAD3] hover:bg-white/[0.06] hover:text-white'
        }`}
        title={t(lang, 'nav.votes')}
      >
        <BarChart3 size={16} className="shrink-0 text-cyan-400/90" />
        <span>{t(lang, 'nav.votesShort')}</span>
      </button>

      {/* Alert Studio */}
      <button
        type="button"
        onClick={() => setTab('alerts')}
        data-nav="alerts"
        className={`inline-flex h-[32px] items-center gap-[7px] rounded-[6px] px-[11px] text-[12.5px] font-medium transition-colors ${
          activeTab === 'alerts'
            ? 'bg-white/[0.08] text-white font-semibold'
            : 'text-[#C3CAD3] hover:bg-white/[0.06] hover:text-white'
        }`}
        title={t(lang, 'nav.alerts')}
      >
        <Film size={16} className="shrink-0 text-purple-400" />
        <span>{t(lang, 'nav.alerts')}</span>
      </button>
    </div>
  );
}
