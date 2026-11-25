import {
  AlertCircle,
  AppWindow,
  Archive,
  Bot,
  Check,
  CircleHelp,
  Compass,
  Crown,
  Keyboard,
  KeyRound,
  Link2,
  LogOut,
  MessageSquareText,
  Minus,
  Monitor,
  Newspaper,
  Palette,
  Plus,
  Power,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  SquareStack,
  Timer,
  UserRound,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../i18n/translations';
import { THEME_OPTIONS } from '../../../lib/theme';
import { isMockMode, rpc } from '../../../rpc';
import { Channels, type FluentBackdrop } from '../../../rpc/contracts';
import { useConnectionStore } from '../../../store/connectionStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { useToolStore, type SettingsSection } from '../../../store/toolStore';
import { useTourStore } from '../../../store/tourStore';
import { useUpdateStore } from '../../../store/updateStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { Switch } from '../../ui/Switch';
import { BackupsCard } from './BackupsCard';
import { ShareCard } from './ShareCard';
import { LogCard } from './LogCard';
import { SecondsBox, SettingGroup, SettingRow } from './SettingRow';
import { useAutoReplyStore } from '../../../store/autoReplyStore';
import { ResetCard } from './ResetCard';
import { DevLuckStatus } from './DevLuckStatus';
import { LeadModRestoreCard } from './LeadModRestoreCard';
import { KeybindSettings } from './KeybindSettings';
import { ObsSettings } from './ObsSettings';

export function SettingsView() {
  const activeSection = useToolStore((s) => s.section);
  const setActiveSection = useToolStore((s) => s.setSection);

  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const startupEnabled = useSettingsStore((s) => s.startupEnabled);
  const setStartupEnabled = useSettingsStore((s) => s.setStartupEnabled);
  const closeToTray = useSettingsStore((s) => s.closeToTray);
  const setCloseToTray = useSettingsStore((s) => s.setCloseToTray);
  const botAccountEnabled = useSettingsStore((s) => s.botAccountEnabled);
  const setBotAccountEnabled = useSettingsStore((s) => s.setBotAccountEnabled);
  const preferredChatSender = useSettingsStore((s) => s.preferredChatSender);
  const setPreferredChatSender = useSettingsStore((s) => s.setPreferredChatSender);
  const openRouterConfigured = useSettingsStore((s) => s.openRouterConfigured);
  const groqConfigured = useSettingsStore((s) => s.groqConfigured);
  const saveOpenRouterKey = useSettingsStore((s) => s.saveOpenRouterKey);
  const removeOpenRouterKey = useSettingsStore((s) => s.removeOpenRouterKey);
  const simulateUpdate = useUpdateStore((s) => s.simulateUpdate);
  const autoUpdate = useUpdateStore((s) => s.autoUpdate);
  const setAutoUpdate = useUpdateStore((s) => s.setAutoUpdate);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const checkForUpdate = useUpdateStore((s) => s.check);
  const openWhatsNew = useUpdateStore((s) => s.openWhatsNew);
  const [updateCheckStatus, setUpdateCheckStatus] = useState<string | null>(null);
  const [scaleDraft, setScaleDraft] = useState<number | null>(null);
  const uiScaleMode = useSettingsStore((s) => s.uiScaleMode);
  const uiCustomScale = useSettingsStore((s) => s.uiCustomScale);
  const effectiveScale = useSettingsStore((s) => s.effectiveScale);
  const setUiScale = useSettingsStore((s) => s.setUiScale);
  const adjustScale = useSettingsStore((s) => s.adjustScale);
  const resetScale = useSettingsStore((s) => s.resetScale);

  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'openrouter' | 'groq'>('openrouter');
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [updateTestStatus, setUpdateTestStatus] = useState<string | null>(null);

  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const botConnected = useConnectionStore((s) => s.botConnected);
  const botLogin = useConnectionStore((s) => s.botLogin);
  const activeChatSender = useConnectionStore((s) => s.activeChatSender);
  const activeChatSenderLogin = useConnectionStore((s) => s.activeChatSenderLogin);
  const broadcasterAvatarUrl = useConnectionStore((s) => s.broadcasterAvatarUrl);
  const fluentBackdrop = useSettingsStore((s) => s.fluentBackdrop);
  const setFluentBackdrop = useSettingsStore((s) => s.setFluentBackdrop);
  const [search, setSearch] = useState('');
  const aiGlobal = useAutoReplyStore((s) => s.globalSettings);
  const updateAiGlobal = useAutoReplyStore((s) => s.updateGlobalSettings);

  const mockMode = isMockMode;
  const lang = language === 'ar' ? 'ar' : 'en';

  const guideSteps = [1, 2, 3, 4, 5, 6, 7].map((n) => t(lang, `settings.guide${n}`));

  const sections: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
    { id: 'connections', label: t(lang, 'settings.secConnections'), icon: Link2 },
    { id: 'appearance', label: t(lang, 'settings.secAppearance'), icon: Palette },
    { id: 'ai', label: t(lang, 'settings.secAi'), icon: MessageSquareText },
    { id: 'keybinds', label: t(lang, 'settings.secKeybinds'), icon: Keyboard },
    { id: 'backups', label: t(lang, 'settings.secBackups'), icon: Archive },
    { id: 'app', label: t(lang, 'settings.secApp'), icon: AppWindow },
    { id: 'help', label: t(lang, 'settings.secHelp'), icon: CircleHelp },
  ];

  // What the search box can find: every page plus the main setting on it, in the current language
  const searchIndex: { section: SettingsSection; label: string }[] = [
    ...sections.map((s) => ({ section: s.id, label: s.label })),
    { section: 'connections', label: t(lang, 'settings.streamerAccount') },
    { section: 'connections', label: t(lang, 'settings.botAccount') },
    { section: 'connections', label: t(lang, 'settings.sectionObs') },
    { section: 'connections', label: t(lang, 'settings.activeSender') },
    { section: 'appearance', label: t(lang, 'settings.language') },
    { section: 'appearance', label: t(lang, 'settings.theme') },
    { section: 'appearance', label: t(lang, 'settings.uiScaleTitle') },
    { section: 'ai', label: t(lang, 'settings.aiProviders') },
    { section: 'ai', label: t(lang, 'settings.aiProvider') },
    { section: 'app', label: t(lang, 'settings.closeToTray') },
    { section: 'app', label: t(lang, 'settings.startup') },
    { section: 'app', label: t(lang, 'updates.autoLabel') },
    { section: 'app', label: t(lang, 'settings.logTitle') },
    { section: 'help', label: t(lang, 'settings.guide') },
    { section: 'help', label: t(lang, 'settings.takeTour') },
    { section: 'help', label: t(lang, 'settings.whatsNewRow') },
  ];
  const needle = search.trim().toLowerCase();
  const results = needle ? searchIndex.filter((entry) => entry.label.toLowerCase().includes(needle)).slice(0, 8) : [];
  const current = sections.find((section) => section.id === activeSection) ?? sections[0];
  const accountName = twitchConnected && twitchChannel ? twitchChannel.replace(/^#+/, '') : null;

  return (
    <section className="settings-page grid min-h-0 flex-1 grid-cols-[264px_minmax(0,1fr)] bg-[#23282e]">
      <nav aria-label={t(lang, 'settings.title')} className="settings-nav flex min-h-0 flex-col gap-1 overflow-y-auto border-e border-white/[0.08] bg-[#1a2228] px-3 pb-4 pt-4">
        {/* Account, like the profile header in Windows Settings */}
        <button
          type="button"
          onClick={() => setActiveSection('connections')}
          className="mb-3 flex items-center gap-3 rounded-[6px] px-2 py-2 text-start transition-colors hover:bg-white/[0.05]"
        >
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#2f2a45] font-sans text-lg font-semibold text-white">
            {broadcasterAvatarUrl ? <img src={broadcasterAvatarUrl} alt="" className="size-full object-cover" /> : (accountName?.[0]?.toUpperCase() ?? '?')}
          </span>
          <span className="min-w-0">
            <span dir="auto" className="block truncate font-sans text-[14px] font-semibold text-ink">{accountName ?? t(lang, 'workspace.notConnected')}</span>
            <span className="block truncate font-sans text-[12px] text-muted">
              {twitchConnected ? `${t(lang, 'settings.groupTwitch')} · ${t(lang, 'nav.online')}` : t(lang, 'workspace.connectTwitch')}
            </span>
          </span>
        </button>

        <label className="relative mb-2 block">
          <span className="sr-only">{t(lang, 'settings.search')}</span>
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t(lang, 'settings.search')}
            className="settings-search h-[32px] pe-8 text-[13px]"
          />
          <Search size={14} aria-hidden className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-muted" />
        </label>

        {needle ? (
          results.length ? (
            results.map((entry, index) => (
              <button
                key={`${entry.section}-${index}`}
                type="button"
                onClick={() => {
                  setActiveSection(entry.section);
                  setSearch('');
                }}
                className="flex flex-col items-start rounded-[6px] px-3 py-2 text-start transition-colors hover:bg-white/[0.05]"
              >
                <span className="font-sans text-[13px] text-ink">{entry.label}</span>
                <span className="font-sans text-[11.5px] text-muted">{sections.find((s) => s.id === entry.section)?.label}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 font-sans text-[12.5px] text-muted">{t(lang, 'settings.noResults')}</p>
          )
        ) : (
          sections.map((section) => {
            const isActive = activeSection === section.id;
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveSection(section.id)}
                className={`settings-nav-item relative flex h-[36px] items-center gap-3 rounded-[6px] ps-4 pe-3 text-start font-sans text-[13.5px] transition-colors ${
                  isActive
                    ? 'bg-[#2A3138] font-semibold text-white before:absolute before:start-0 before:top-[10px] before:h-4 before:w-[3px] before:rounded-full before:bg-accent'
                    : 'text-[#c3cad3] hover:bg-white/[0.05] hover:text-[#f0f3f7]'
                }`}
              >
                <Icon size={16} aria-hidden className="shrink-0" />
                <span className="truncate">{section.label}</span>
              </button>
            );
          })
        )}
      </nav>

      <div className="app-scroll min-h-0 overflow-auto">
        <div className="w-[820px] max-w-full px-8 pb-10 pt-6">
          <h1 className="mb-6 font-sans text-[26px] font-semibold tracking-tight text-ink">{current.label}</h1>

      {/* Appearance */}
      {activeSection === 'appearance' && (
        <section className="space-y-6">
          <div className="flex flex-col gap-6">
            {/* Language Selection */}
            <Card title={t(lang, 'settings.language')}>
              <p className="mb-3 font-sans text-xs text-muted">
                {t(lang, 'settings.languageHint')}
              </p>
              <SegmentedControl
                name="app-language"
                value={lang}
                options={[
                  { value: 'en', label: 'English (US)' },
                  { value: 'ar', label: 'العربية (Arabic)' },
                ]}
                onChange={(value) => setLanguage(value as 'en' | 'ar')}
              />
            </Card>

            {/* Theme Selection */}
            <Card title={t(lang, 'settings.theme')}>
              <p className="mb-3 font-sans text-xs text-muted">
                {t(lang, 'settings.themeHint')}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {THEME_OPTIONS.map((opt) => {
                  const isSelected = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTheme(opt.id)}
                      className={`relative flex flex-col justify-between rounded-[5px] border p-3 text-start transition-all ${
                        isSelected
                          ? 'border-accent bg-accent/15 shadow-xs ring-1 ring-accent/40'
                          : 'border-[#384048] bg-[#2e3338] hover:border-[#4d5a6c] hover:bg-[#343a40]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-4 rounded-full border border-black/30 shadow-xs shrink-0"
                            style={{
                              backgroundColor: opt.surfaceColor,
                              outline: `2px solid ${opt.accentColor}`,
                              outlineOffset: '1px',
                            }}
                          />
                          <span className="font-sans text-xs font-bold text-ink">
                            {t(lang, opt.labelKey)}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="flex size-4 items-center justify-center rounded-full bg-accent text-on-accent">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      {opt.hintKey && (
                        <p className="font-sans text-[11px] leading-relaxed text-ink/60">
                          {t(lang, opt.hintKey)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Fluent only: which Windows 11 material sits behind the window */}
            {theme === 'fluent' && (
              <Card title={t(lang, 'settings.material')}>
                <p className="mb-3 font-sans text-xs text-muted">{t(lang, 'settings.materialHint')}</p>
                <SegmentedControl
                  name="fluent-material"
                  value={fluentBackdrop}
                  options={[
                    { value: 'acrylic', label: t(lang, 'settings.materialAcrylic') },
                    { value: 'mica', label: t(lang, 'settings.materialMica') },
                    { value: 'mica-alt', label: t(lang, 'settings.materialMicaAlt') },
                  ]}
                  onChange={(value) => setFluentBackdrop(value as FluentBackdrop)}
                />
                <p className="mt-3 font-sans text-[12px] leading-relaxed text-muted">
                  {t(lang, fluentBackdrop === 'acrylic' ? 'settings.materialAcrylicHint' : fluentBackdrop === 'mica-alt' ? 'settings.materialMicaAltHint' : 'settings.materialMicaHint')}
                </p>
              </Card>
            )}

            {/* Display & UI Scaling */}
            <Card title={t(lang, 'settings.uiScaleTitle')}>
              <p className="mb-3 font-sans text-xs text-muted">
                {t(lang, 'settings.uiScaleDesc')}
              </p>

              {/* Mode Selection */}
              <div className="mb-4">
                <SegmentedControl
                  name="ui-scale-mode"
                  value={uiScaleMode}
                  options={[
                    { value: 'auto', label: t(lang, 'settings.uiScaleAuto') },
                    { value: 'custom', label: t(lang, 'settings.uiScaleCustom') },
                  ]}
                  onChange={(val) => setUiScale(val as 'auto' | 'custom', uiCustomScale)}
                />
              </div>

              {/* Status Row */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[5px] border border-white/[0.08] bg-[#1d2228] p-3 text-xs">
                <div className="flex items-center gap-2 text-ink/80">
                  <Monitor size={15} className="text-accent" />
                  <span>{t(lang, 'settings.uiScaleDetected')}:</span>
                  <span className="font-mono font-bold text-ink">
                    {typeof window !== 'undefined' ? `${window.screen.width} × ${window.screen.height}` : '1920 × 1080'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted">{t(lang, 'settings.uiScaleActive')}:</span>
                  <span className="rounded bg-accent/20 px-2 py-0.5 font-mono text-xs font-bold text-accent">
                    {Math.round(effectiveScale * 100)}%
                  </span>
                </div>
              </div>

              {/* Custom Scale Controls */}
              {uiScaleMode === 'custom' && (
                <div className="space-y-4 rounded-[5px] border border-white/[0.08] bg-[#23282e] p-3.5">
                  {/* Preset chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    {[0.8, 0.9, 1.0, 1.1, 1.25, 1.5].map((preset) => {
                      const isCurrent = Math.abs(uiCustomScale - preset) < 0.01;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setUiScale('custom', preset)}
                          className={`rounded px-2.5 py-1 font-mono text-xs font-semibold transition-colors ${
                            isCurrent
                              ? 'bg-accent text-on-accent shadow-xs'
                              : 'bg-[#2f353c] text-ink/80 hover:bg-[#38414b] hover:text-ink'
                          }`}
                        >
                          {Math.round(preset * 100)}%
                        </button>
                      );
                    })}
                  </div>

                  {/* Slider & adjustment buttons */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustScale(-0.05)}
                      disabled={uiCustomScale <= 0.75}
                      title="Zoom out (-5%)"
                      className="size-8 p-0"
                    >
                      <Minus size={14} />
                    </Button>
                    <div className="flex-1">
                      <Slider
                        value={scaleDraft ?? Math.round(uiCustomScale * 100)}
                        min={75}
                        max={175}
                        step={5}
                        // Zooming the page while the thumb is held makes it jump under the pointer, so apply on release
                        onChange={(val) => setScaleDraft(val)}
                        onCommit={(val) => {
                          setScaleDraft(null);
                          if (Math.round(uiCustomScale * 100) !== val) setUiScale('custom', val / 100);
                        }}
                        ariaLabel={t(lang, 'settings.uiScaleActive')}
                      />
                      <div className="mt-1 text-center font-mono text-[11px] text-muted">
                        {scaleDraft ?? Math.round(uiCustomScale * 100)}%
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustScale(0.05)}
                      disabled={uiCustomScale >= 1.75}
                      title="Zoom in (+5%)"
                      className="size-8 p-0"
                    >
                      <Plus size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetScale()}
                      title={t(lang, 'settings.uiScaleReset')}
                      className="gap-1 px-2.5 text-xs"
                    >
                      <RotateCcw size={12} />
                      {t(lang, 'settings.uiScaleReset')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Hotkeys reminder */}
              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
                <ZoomIn size={13} className="shrink-0 text-muted" />
                <span>{t(lang, 'settings.uiScaleHotkeysHint')}</span>
              </div>
            </Card>

          </div>
        </section>
      )}

      {/* App: how the app runs on Windows, updates and troubleshooting */}
      {activeSection === 'app' && (
        <section className="space-y-7">
          <SettingGroup title={t(lang, 'settings.groupWindows')}>
            <SettingRow icon={<Power size={18} />} title={t(lang, 'settings.startup')} description={t(lang, 'settings.startupHint')}>
              <Switch checked={startupEnabled} onChange={(enabled) => setStartupEnabled(enabled)} label={t(lang, 'settings.startup')} />
            </SettingRow>
            <SettingRow icon={<SquareStack size={18} />} title={t(lang, 'settings.closeToTray')} description={t(lang, 'settings.closeToTrayHint')}>
              <Switch checked={closeToTray} onChange={(enabled) => setCloseToTray(enabled)} label={t(lang, 'settings.closeToTray')} />
            </SettingRow>
          </SettingGroup>

          <SettingGroup title={t(lang, 'settings.groupUpdates')}>
            <SettingRow icon={<RefreshCw size={18} />} title={t(lang, 'updates.autoLabel')} description={t(lang, 'updates.autoHint')}>
              <Switch checked={autoUpdate} onChange={setAutoUpdate} label={t(lang, 'updates.autoLabel')} />
            </SettingRow>
            <SettingRow
              icon={<Newspaper size={18} />}
              title={t(lang, 'settings.checkUpdatesRow')}
              description={updateCheckStatus ?? `${t(lang, 'updates.currentVersion')}: v${currentVersion}`}
            >
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setUpdateCheckStatus(t(lang, 'updates.checking'));
                    const result = await checkForUpdate();
                    setUpdateCheckStatus(
                      result?.updateAvailable
                        ? `${t(lang, 'updates.available')} · v${result.latestVersion}`
                        : result
                          ? t(lang, 'updates.upToDate')
                          : t(lang, 'updates.checkFailed'),
                    );
                  }}
                >
                  {t(lang, 'updates.checkNow')}
                </Button>
            </SettingRow>
            <SettingRow
              icon={<RotateCcw size={18} />}
              title={t(lang, 'settings.updateTestTitle')}
              description={updateTestStatus ?? t(lang, 'settings.updateTestHint')}
            >
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const ready = await simulateUpdate();
                  setUpdateTestStatus(ready ? t(lang, 'settings.updateTestReady') : t(lang, 'settings.updateTestUnavailable'));
                }}
              >
                {t(lang, 'settings.updateTestButton')}
              </Button>
            </SettingRow>
          </SettingGroup>

          <LogCard lang={lang} />
          <DevLuckStatus />
        </section>
      )}

      {/* Backups & sharing */}
      {activeSection === 'backups' && (
        <section className="space-y-6">
          <ShareCard />
          <BackupsCard />
          <ResetCard />
        </section>
      )}

      {activeSection === 'keybinds' && (
        <section className="space-y-6">
          <KeybindSettings lang={lang} />
        </section>
      )}

      {/* Connections: Twitch, the bot account, lead moderators and OBS */}
      {activeSection === 'connections' && (
        <section className="space-y-6">
          <h2 className="mb-3 font-sans text-[13.5px] font-semibold text-ink">{t(lang, 'settings.groupTwitch')}</h2>
          <SettingGroup>
            {/* Broadcaster account */}
            <SettingRow
              icon={<Radio size={18} />}
              title={t(lang, 'settings.streamerAccount')}
              description={
                twitchConnected
                  ? `${twitchChannel ? `@${twitchChannel}` : t(lang, 'settings.connected')} · ${t(lang, 'settings.builtInAppHint')}`
                  : t(lang, 'settings.builtInAppHint')
              }
            >
              {twitchConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  title={t(lang, 'settings.forget')}
                  onClick={() => rpc.invoke(Channels.TwitchForget).catch(() => undefined)}
                >
                  <LogOut size={13} />
                  {t(lang, 'settings.forget')}
                </Button>
              )}
              <Button
                size="sm"
                variant={twitchConnected ? 'outline' : 'primary'}
                disabled={mockMode}
                title={mockMode ? t(lang, 'settings.browserPreview') : t(lang, 'settings.connect')}
                onClick={() => rpc.invoke(Channels.TwitchAuthorize).catch(() => undefined)}
              >
                <KeyRound size={13} />
                {twitchConnected ? (lang === 'ar' ? 'إعادة ربط' : 'Reconnect') : t(lang, 'settings.connect')}
              </Button>
            </SettingRow>

            {/* Bot account: off by default; its details open below when it is on */}
            <SettingRow icon={<Bot size={18} />} title={t(lang, 'settings.botAccountUse')} description={t(lang, 'settings.botAccountHint')}>
              <Switch checked={botAccountEnabled} onChange={(enabled) => setBotAccountEnabled(enabled)} label={t(lang, 'settings.botAccountUse')} />
            </SettingRow>

            {botAccountEnabled && (
              <>
                <SettingRow
                  icon={<span className={`block size-2.5 rounded-full ${botConnected ? 'bg-emerald-500' : 'bg-ink/30'}`} />}
                  title={t(lang, 'settings.botAccount')}
                  description={
                    botConnected
                      ? botLogin
                        ? `@${botLogin}`
                        : lang === 'ar'
                          ? 'البوت متصل'
                          : 'Bot connected'
                      : lang === 'ar'
                        ? 'غير متصل'
                        : 'Offline'
                  }
                >
                  {botConnected && (
                    <Button variant="outline" size="sm" onClick={() => rpc.invoke(Channels.TwitchBotForget).catch(() => undefined)}>
                      <LogOut size={13} />
                      {lang === 'ar' ? 'إزالة' : 'Remove'}
                    </Button>
                  )}
                  <Button size="sm" disabled={mockMode} onClick={() => rpc.invoke(Channels.TwitchBotAuthorize).catch(() => undefined)}>
                    <Bot size={13} />
                    {t(lang, 'settings.botAccountConnect')}
                  </Button>
                </SettingRow>

                <SettingRow
                  icon={
                    activeChatSender === 'bot' ? (
                      <Bot size={18} className="text-emerald-400" />
                    ) : preferredChatSender === 'bot' && !botConnected ? (
                      <AlertCircle size={18} className="text-amber-400" />
                    ) : (
                      <Crown size={18} />
                    )
                  }
                  title={t(lang, 'settings.activeSender')}
                  description={
                    activeChatSender === 'bot'
                      ? t(lang, 'settings.senderBotActive', { name: activeChatSenderLogin || botLogin || 'Bot' })
                      : preferredChatSender === 'bot' && !botConnected
                        ? t(lang, 'settings.senderBotOfflineFallback', { name: twitchChannel || 'Broadcaster' })
                        : t(lang, 'settings.senderBroadcasterActive', { name: activeChatSenderLogin || twitchChannel || 'Broadcaster' })
                  }
                >
                  <SegmentedControl
                    value={preferredChatSender}
                    onChange={(val) => setPreferredChatSender(val as 'bot' | 'broadcaster')}
                    options={[
                      { value: 'bot', label: t(lang, 'settings.senderBot') },
                      { value: 'broadcaster', label: t(lang, 'settings.senderBroadcaster') },
                    ]}
                  />
                </SettingRow>

                {/* Lets the developer try bot features without a second Twitch account */}
                <SettingRow icon={<Sparkles size={18} />} title={t(lang, 'settings.debugExampleBot')} description={t(lang, 'settings.exampleBotHint')}>
                  <Button variant="ghost" size="sm" onClick={() => rpc.invoke(Channels.TwitchBotSimulate).catch(() => undefined)}>
                    {botConnected && botLogin === 'ExampleBot' ? t(lang, 'settings.disconnectExampleBot') : t(lang, 'settings.debugExampleBot')}
                  </Button>
                </SettingRow>
              </>
            )}
          </SettingGroup>
          <LeadModRestoreCard />
          <h2 className="mb-3 pt-2 font-sans text-[13.5px] font-semibold text-ink">{t(lang, 'settings.groupObs')}</h2>
          <ObsSettings />
        </section>
      )}

      {/* Chat & AI */}
      {activeSection === 'ai' && (
        <section className="space-y-6">
          <SettingGroup title={t(lang, 'settings.groupAiLimits')}>
            <SettingRow icon={<Timer size={18} />} title={t(lang, 'settings.aiCooldownRow')} description={t(lang, 'settings.aiCooldownRowHint')}>
              <SecondsBox
                value={aiGlobal.globalAiCooldownSeconds}
                onChange={(seconds) => updateAiGlobal({ globalAiCooldownSeconds: seconds })}
                label={t(lang, 'settings.aiCooldownRow')}
              />
            </SettingRow>
            <SettingRow icon={<UserRound size={18} />} title={t(lang, 'settings.aiUserCooldownRow')} description={t(lang, 'settings.aiUserCooldownRowHint')}>
              <SecondsBox
                value={aiGlobal.globalAiUserCooldownSeconds}
                onChange={(seconds) => updateAiGlobal({ globalAiUserCooldownSeconds: seconds })}
                label={t(lang, 'settings.aiUserCooldownRow')}
              />
            </SettingRow>
          </SettingGroup>

          <SettingGroup title={t(lang, 'settings.groupAiProvider')}>
            <SettingRow
              icon={<Sparkles size={18} />}
              title={t(lang, 'settings.aiProvider')}
              description={t(lang, 'settings.aiProvidersHint')}
            >
              <SegmentedControl
                name="ai-provider"
                className="w-[210px]"
                value={provider}
                options={[
                  { value: 'openrouter', label: 'OpenRouter' },
                  { value: 'groq', label: 'Groq' },
                ]}
                onChange={(value) => {
                  setProvider(value as 'openrouter' | 'groq');
                  setApiKey('');
                  setKeyStatus(null);
                }}
              />
            </SettingRow>
            <SettingRow
              icon={<KeyRound size={18} />}
              title={provider === 'groq' ? t(lang, 'settings.groqKey') : t(lang, 'settings.openRouterKey')}
              description={
                <span className="inline-flex items-center gap-1.5">
                  <span className={`inline-block size-2 rounded-full ${(provider === 'groq' ? groqConfigured : openRouterConfigured) ? 'bg-emerald-500' : 'bg-ink/30'}`} />
                  {keyStatus ??
                    ((provider === 'groq' ? groqConfigured : openRouterConfigured)
                      ? t(lang, 'settings.openRouterConfigured')
                      : t(lang, 'settings.openRouterNotConfigured'))}
                </span>
              }
            >
              <Input
                className="h-[32px] w-[200px] text-[13px]"
                dir="ltr"
                type="password"
                aria-label={provider === 'groq' ? t(lang, 'settings.groqKey') : t(lang, 'settings.openRouterKey')}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={(provider === 'groq' ? groqConfigured : openRouterConfigured) ? '••••••••••••' : provider === 'groq' ? 'gsk_…' : 'sk-or-v1-…'}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!apiKey.trim()}
                className="whitespace-nowrap"
                onClick={async () => {
                  const ok = await saveOpenRouterKey(provider, apiKey);
                  setKeyStatus(ok ? t(lang, 'settings.openRouterSaved') : t(lang, 'settings.openRouterFailed'));
                  if (ok) setApiKey('');
                }}
              >
                {t(lang, 'settings.openRouterSave')}
              </Button>
              {(provider === 'groq' ? groqConfigured : openRouterConfigured) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="whitespace-nowrap"
                  onClick={async () => {
                    const ok = await removeOpenRouterKey(provider);
                    setKeyStatus(ok ? t(lang, 'settings.openRouterRemoved') : t(lang, 'settings.openRouterFailed'));
                  }}
                >
                  {t(lang, 'settings.openRouterRemove')}
                </Button>
              )}
            </SettingRow>
            <p className="px-1 pt-1 font-sans text-[12px] leading-relaxed text-muted">{t(lang, 'settings.openRouterPrivacy')}</p>
          </SettingGroup>
        </section>
      )}

      {/* Help: tour, what's new and the setup guide */}
      {activeSection === 'help' && (
        <section className="space-y-7">
          <SettingGroup title={t(lang, 'settings.groupGetStarted')}>
            <SettingRow icon={<Compass size={18} />} title={t(lang, 'settings.tourRow')} description={t(lang, 'settings.tourRowHint')}>
              <Button size="sm" variant="outline" onClick={() => useTourStore.getState().start()}>
                {t(lang, 'settings.takeTour')}
              </Button>
            </SettingRow>
            <SettingRow icon={<Newspaper size={18} />} title={t(lang, 'settings.whatsNewRow')} description={`${t(lang, 'settings.whatsNewRowHint')} · v${currentVersion}`}>
              <Button size="sm" variant="outline" onClick={openWhatsNew}>
                {t(lang, 'updates.showWhatsNew')}
              </Button>
            </SettingRow>
          </SettingGroup>
          <Card title={t(lang, 'settings.guide')}>
            <p className="font-sans text-xs text-ink/70">{t(lang, 'settings.guideIntro')}</p>
            <ol className="mt-5 space-y-4">
              {guideSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-3.5">
                  <span
                    dir="ltr"
                    className="flex size-6 shrink-0 items-center justify-center border border-primary/40 bg-primary/10 font-display text-xs font-bold text-primary"
                  >
                    {index + 1}
                  </span>
                  <p className="font-sans text-xs leading-relaxed text-muted pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      )}
        </div>
      </div>
    </section>
  );
}
