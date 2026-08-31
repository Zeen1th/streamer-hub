import {
  AppWindow,
  Bot,
  HelpCircle,
  KeyRound,
  Keyboard,
  Languages,
  LogOut,
  Radio,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react';
import React, { useState } from 'react';
import { t } from '../../../i18n/translations';
import { isMockMode, rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';
import { useConnectionStore } from '../../../store/connectionStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Switch } from '../../ui/Switch';
import { KeybindSettings } from './KeybindSettings';

type SettingsSection = 'general' | 'system' | 'keybinds' | 'twitch' | 'ai' | 'guide';

export function SettingsView() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

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
  const openRouterConfigured = useSettingsStore((s) => s.openRouterConfigured);
  const groqConfigured = useSettingsStore((s) => s.groqConfigured);
  const saveOpenRouterKey = useSettingsStore((s) => s.saveOpenRouterKey);
  const removeOpenRouterKey = useSettingsStore((s) => s.removeOpenRouterKey);

  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'openrouter' | 'groq'>('openrouter');
  const [keyStatus, setKeyStatus] = useState<string | null>(null);

  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const botConnected = useConnectionStore((s) => s.botConnected);
  const botLogin = useConnectionStore((s) => s.botLogin);

  const mockMode = isMockMode;
  const lang = language === 'ar' ? 'ar' : 'en';

  const guideSteps = [1, 2, 3, 4, 5, 6, 7].map((n) => t(lang, `settings.guide${n}`));

  const sections: {
    id: SettingsSection;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[] = [
    { id: 'general', label: t(lang, 'settings.sectionGeneral'), icon: Languages },
    { id: 'system', label: t(lang, 'settings.sectionWindow'), icon: AppWindow },
    { id: 'keybinds', label: lang === 'ar' ? 'الاختصارات' : 'Keybinds', icon: Keyboard },
    { id: 'twitch', label: t(lang, 'settings.sectionTwitch'), icon: Radio },
    { id: 'ai', label: t(lang, 'settings.sectionAi'), icon: Sparkles },
    { id: 'guide', label: t(lang, 'settings.sectionGuide'), icon: HelpCircle },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3">
          <SettingsIcon size={22} className="text-primary" aria-hidden />
          <h1 className="font-display text-3xl uppercase leading-none text-ink">
            {t(lang, 'settings.title')}
          </h1>
        </div>
        <div className="mt-4 h-px bg-ink/20">
          <div className="h-px w-56 bg-primary" />
        </div>
        <p className="mt-3 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-ink/65">
          {t(lang, 'settings.subtitle')}
        </p>
      </header>

      {/* Section Navigation Buttons */}
      <nav
        aria-label="Settings sections"
        className="flex flex-wrap gap-2 border-b border-ink/15 pb-4"
      >
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`group flex items-center gap-2.5 border px-4 py-2.5 font-sans text-xs font-bold uppercase tracking-[0.08em] transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'border-primary bg-primary text-on-primary shadow-sm'
                  : 'border-ink/20 bg-surface text-ink/75 hover:border-ink/40 hover:bg-ink/5 hover:text-ink'
              }`}
            >
              <Icon
                size={16}
                className={isActive ? 'text-on-primary' : 'text-primary group-hover:scale-110 transition-transform'}
              />
              <span>{section.label}</span>
            </button>
          );
        })}
      </nav>

      {/* SECTION 1: General & Appearance */}
      {activeSection === 'general' && (
        <section className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Language Selection */}
            <Card title={t(lang, 'settings.language')}>
              <p className="mb-4 font-sans text-xs text-ink/65">
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
              <p className="mb-4 font-sans text-xs text-ink/65">
                {t(lang, 'settings.themeHint')}
              </p>
              <SegmentedControl
                name="app-theme"
                value={theme}
                options={[
                  { value: 'light', label: t(lang, 'settings.themeLight') },
                  { value: 'dark', label: t(lang, 'settings.themeDark') },
                ]}
                onChange={(value) => setTheme(value as 'light' | 'dark')}
              />
            </Card>
          </div>
        </section>
      )}

      {/* SECTION 2: System & Window Behavior */}
      {activeSection === 'system' && (
        <section className="space-y-6 animate-fade-in">
          <Card>
            <div className="space-y-6">
              {/* Close to Tray Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pe-4">
                  <span className="font-sans text-sm font-bold uppercase tracking-[0.08em] text-ink">
                    {t(lang, 'settings.closeToTray')}
                  </span>
                  <span className="mt-1 text-xs text-ink/60 leading-relaxed">
                    {t(lang, 'settings.closeToTrayHint')}
                  </span>
                </div>
                <Switch
                  checked={closeToTray}
                  onChange={(enabled) => setCloseToTray(enabled)}
                  label={t(lang, 'settings.closeToTray')}
                />
              </div>

              {/* Launch on Startup Toggle */}
              <div className="flex items-center justify-between border-t border-ink/10 pt-5">
                <div className="flex flex-col pe-4">
                  <span className="font-sans text-sm font-bold uppercase tracking-[0.08em] text-ink">
                    {t(lang, 'settings.startup')}
                  </span>
                  <span className="mt-1 text-xs text-ink/60 leading-relaxed">
                    {t(lang, 'settings.startupHint')}
                  </span>
                </div>
                <Switch
                  checked={startupEnabled}
                  onChange={(enabled) => setStartupEnabled(enabled)}
                  label={t(lang, 'settings.startup')}
                />
              </div>
            </div>
          </Card>
        </section>
      )}

      {activeSection === 'keybinds' && (
        <section className="space-y-6 animate-fade-in">
          <KeybindSettings lang={lang} />
        </section>
      )}

            {/* SECTION 3: Twitch & Bot Connection */}
      {activeSection === 'twitch' && (
        <section className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Main Streamer Account */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <Radio size={16} className="text-primary" />
                  <span>{t(lang, 'settings.streamerAccount')}</span>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="border border-ink/20 bg-surface px-4 py-3">
                  <div className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-ink/70">
                    {t(lang, 'settings.builtInApp')}
                  </div>
                  <div className="mt-1 font-sans text-xs text-ink/75">
                    {t(lang, 'settings.builtInAppHint')}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-ink/15 pt-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2.5 rounded-full ${
                        twitchConnected ? 'bg-emerald-500 animate-pulse' : 'bg-ink/30'
                      }`}
                    />
                    <span className="font-sans text-xs font-bold uppercase tracking-[0.1em] text-ink/80">
                      {twitchConnected
                        ? twitchChannel
                          ? `@${twitchChannel}`
                          : t(lang, 'settings.connected')
                        : t(lang, 'settings.offline')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {twitchConnected && (
                      <Button
                        variant="danger"
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
                      disabled={mockMode}
                      title={mockMode ? t(lang, 'settings.browserPreview') : t(lang, 'settings.connect')}
                      onClick={() => rpc.invoke(Channels.TwitchAuthorize).catch(() => undefined)}
                    >
                      <KeyRound size={13} />
                      {twitchConnected
                        ? lang === 'ar'
                          ? 'إعادة ربط'
                          : 'Reconnect'
                        : t(lang, 'settings.connect')}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Bot / Moderator Account */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-primary" />
                  <span>{t(lang, 'settings.botAccount')}</span>
                </div>
              }
            >
              <div className="space-y-4">
                <p className="font-sans text-xs text-ink/65">
                  {t(lang, 'settings.botAccountHint')}
                </p>

                <div className="flex items-center justify-between border-t border-ink/10 pt-3">
                  <span className="font-sans text-xs font-bold uppercase tracking-[0.08em] text-ink">
                    {t(lang, 'settings.botAccountUse')}
                  </span>
                  <Switch
                    checked={botAccountEnabled}
                    onChange={(enabled) => setBotAccountEnabled(enabled)}
                    label={t(lang, 'settings.botAccountUse')}
                  />
                </div>

                {botAccountEnabled && (
                  <div className="flex items-center justify-between border-t border-ink/15 pt-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2.5 rounded-full ${
                          botConnected ? 'bg-emerald-500' : 'bg-ink/30'
                        }`}
                      />
                      <span className="font-sans text-xs font-bold uppercase tracking-[0.1em] text-ink/80">
                        {botConnected
                          ? botLogin
                            ? `@${botLogin}`
                            : lang === 'ar'
                              ? 'البوت متصل'
                              : 'Bot connected'
                          : lang === 'ar'
                            ? 'غير متصل'
                            : 'Offline'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {botConnected && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => rpc.invoke(Channels.TwitchBotForget).catch(() => undefined)}
                        >
                          <LogOut size={13} />
                          {lang === 'ar' ? 'إزالة' : 'Remove'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={mockMode}
                        onClick={() => rpc.invoke(Channels.TwitchBotAuthorize).catch(() => undefined)}
                      >
                        <Bot size={13} />
                        {t(lang, 'settings.botAccountConnect')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* SECTION 4: AI & Intelligence Providers */}
      {activeSection === 'ai' && (
        <section className="space-y-6 animate-fade-in">
          <Card title={t(lang, 'settings.aiProviders')}>
            <div className="space-y-5">
              <div className="flex items-start gap-3 border border-ink/20 bg-surface px-4 py-3">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <div>
                  <div className="font-sans text-xs font-semibold text-ink">
                    {t(lang, 'settings.aiProvidersHint')}
                  </div>
                  <div className="mt-1 font-sans text-[11px] leading-relaxed text-ink/65">
                    {t(lang, 'settings.openRouterPrivacy')}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                {/* Provider Selection */}
                <div className="min-w-0 flex-1">
                  <div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                    {t(lang, 'settings.aiProvider')}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5" role="group">
                    {(['openrouter', 'groq'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`cursor-pointer select-none border px-3.5 py-2 font-sans text-xs font-bold uppercase tracking-[0.08em] transition-colors duration-150 ${
                          provider === option
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-ink/25 bg-surface-2 text-ink/70 hover:border-ink/50 hover:bg-ink/5'
                        }`}
                        onClick={() => {
                          setProvider(option);
                          setApiKey('');
                          setKeyStatus(null);
                        }}
                      >
                        {option === 'openrouter' ? 'OpenRouter' : 'Groq (Ultra-Fast)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Key Input */}
                <label className="block min-w-0 flex-1 font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                  {provider === 'groq' ? t(lang, 'settings.groqKey') : t(lang, 'settings.openRouterKey')}
                  <Input
                    className="mt-2"
                    dir="ltr"
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={
                      (provider === 'groq' ? groqConfigured : openRouterConfigured)
                        ? '••••••••••••••••••••'
                        : provider === 'groq'
                          ? 'gsk_…'
                          : 'sk-or-v1-…'
                    }
                  />
                </label>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      const ok = await saveOpenRouterKey(provider, apiKey);
                      setKeyStatus(
                        ok ? t(lang, 'settings.openRouterSaved') : t(lang, 'settings.openRouterFailed'),
                      );
                      if (ok) setApiKey('');
                    }}
                  >
                    {t(lang, 'settings.openRouterSave')}
                  </Button>
                  {(provider === 'groq' ? groqConfigured : openRouterConfigured) && (
                    <Button
                      variant="danger"
                      onClick={async () => {
                        const ok = await removeOpenRouterKey(provider);
                        setKeyStatus(
                          ok
                            ? t(lang, 'settings.openRouterRemoved')
                            : t(lang, 'settings.openRouterFailed'),
                        );
                      }}
                    >
                      {t(lang, 'settings.openRouterRemove')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Configured Status */}
              <div className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">
                <span
                  className={`size-2 rounded-full ${
                    (provider === 'groq' ? groqConfigured : openRouterConfigured)
                      ? 'bg-emerald-500'
                      : 'bg-ink/25'
                  }`}
                />
                {(provider === 'groq' ? groqConfigured : openRouterConfigured)
                  ? t(lang, 'settings.openRouterConfigured')
                  : t(lang, 'settings.openRouterNotConfigured')}
                {keyStatus && (
                  <span className="font-normal normal-case tracking-normal text-ink/70">
                    · {keyStatus}
                  </span>
                )}
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* SECTION 5: Setup Guide */}
      {activeSection === 'guide' && (
        <section className="space-y-6 animate-fade-in">
          <Card title={t(lang, 'settings.guide')}>
            <p className="font-sans text-xs text-ink/70">{t(lang, 'settings.guideIntro')}</p>
            <ol className="mt-5 space-y-4">
              {guideSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-3.5">
                  <span
                    dir="ltr"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-display text-xs font-bold text-primary"
                  >
                    {index + 1}
                  </span>
                  <p className="font-sans text-xs leading-relaxed text-ink/80 pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      )}
    </div>
  );
}
