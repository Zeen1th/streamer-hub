import { ChevronDown, Menu, MessageSquare } from 'lucide-react';
import { useConnectionStore } from '../../store/connectionStore';
import { useToolStore } from '../../store/toolStore';
import { rpc } from '../../rpc';
import { Channels } from '../../rpc/contracts';
import { t } from '../../i18n/translations';
import { useSettingsStore } from '../../store/settingsStore';

export function ActionBar() {
  const activeTab = useToolStore((s) => s.activeTab);
  const setTab = useToolStore((s) => s.setTab);
  const setSection = useToolStore((s) => s.setSection);
  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const handleConnectionClick = () => {
    if (!twitchConnected) {
      void rpc.invoke(Channels.TwitchAuthorize).catch(() => undefined);
    } else {
      setSection('twitch');
      setTab('settings');
    }
  };

  const channelName = twitchChannel ? twitchChannel.replace(/^#+/, '') : null;

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

      {/* OBS Streamer Chat Quick Button */}
      <button
        type="button"
        onClick={() => setTab('obs-chat')}
        className={`inline-flex h-[32px] items-center gap-[7px] rounded-[6px] px-[11px] text-[12.5px] font-medium transition-colors ${
          activeTab === 'obs-chat'
            ? 'bg-white/[0.08] text-white font-semibold'
            : 'text-[#C3CAD3] hover:bg-white/[0.06] hover:text-white'
        }`}
        title={t(lang, 'nav.obsChat')}
      >
        <MessageSquare size={16} className="shrink-0" />
        <span>Chat</span>
      </button>

      {/* Connection Status Pill on the Right */}
      <button
        type="button"
        onClick={handleConnectionClick}
        className="ms-auto inline-flex h-[30px] items-center gap-2 rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-[#D7DDE4] transition-colors hover:bg-white/[0.08]"
        data-od-id="connection-status"
        title={twitchConnected ? `Connected to Twitch (${channelName || 'live'})` : 'Click to connect Twitch'}
      >
        <span
          className={`inline-block size-2 rounded-full shrink-0 ${
            twitchConnected
              ? 'bg-[#22C55E] shadow-[0_0_0_3px_rgba(34,197,94,0.16)]'
              : 'bg-[#F5B324] shadow-[0_0_0_3px_rgba(245,179,36,0.16)]'
          }`}
        />
        <span>{twitchConnected ? 'Connected' : 'Offline'}</span>
        <span className="font-mono text-[11px] text-[#9AA3AF]">
          {twitchConnected ? (channelName ? `(@${channelName})` : '(Twitch)') : '(Connect)'}
        </span>
        <ChevronDown size={13} className="text-[#868F9D]" />
      </button>
    </div>
  );
}
