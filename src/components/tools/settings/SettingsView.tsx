import { KeyRound, Languages, LogOut, Moon, Settings as SettingsIcon, Sparkles, Sun } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../i18n/translations';
import { isMockMode, rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';
import { useConnectionStore } from '../../../store/connectionStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Input } from '../../ui/Input';

export function SettingsView() {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const openRouterConfigured = useSettingsStore((s) => s.openRouterConfigured);
  const groqConfigured = useSettingsStore((s) => s.groqConfigured);
  const saveOpenRouterKey = useSettingsStore((s) => s.saveOpenRouterKey);
  const removeOpenRouterKey = useSettingsStore((s) => s.removeOpenRouterKey);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'openrouter' | 'groq'>('openrouter');
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const mockMode = isMockMode;
  const lang = language === 'ar' ? 'ar' : 'en';

  const guideSteps = [1, 2, 3, 4, 5, 6, 7].map((n) => t(lang, `settings.guide${n}`));

  return (
    <div>
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <SettingsIcon size={22} className="text-primary" aria-hidden />
          <h1 className="font-display text-3xl uppercase leading-none text-ink">{t(lang, 'settings.title')}</h1>
        </div>
        <div className="mt-5 h-px bg-ink/20">
          <div className="h-px w-56 bg-primary" />
        </div>
        <p className="mt-4 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-ink/65">
          {t(lang, 'settings.subtitle')}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card title={t(lang, 'settings.connection')} className="xl:col-span-6">
          <div className="space-y-6">
            <div className="border border-ink/20 bg-surface px-4 py-3">
              <div className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-ink/70">
                {t(lang, 'settings.builtInApp')}
              </div>
              <div className="mt-1.5 font-sans text-sm text-ink/80">
                {t(lang, 'settings.builtInAppHint')}
              </div>
            </div>

            <div className="border border-ink/20 bg-surface px-4 py-3">
              <div className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-ink/70">
                {t(lang, 'settings.redirectLabel')}
              </div>
              <div dir="ltr" className="mt-1.5 text-start font-mono text-sm text-ink">
                http://localhost:8787/oauth
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-ink/15 pt-4">
              <span className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-ink/70">
                {twitchConnected ? t(lang, 'settings.connected') : t(lang, 'settings.offline')}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  title={t(lang, 'settings.forget')}
                  onClick={() => {
                    rpc.invoke(Channels.TwitchForget).catch(() => undefined);
                  }}
                >
                  <LogOut size={14} />
                  {t(lang, 'settings.forget')}
                </Button>
                <Button
                  disabled={mockMode}
                  title={mockMode ? t(lang, 'settings.browserPreview') : t(lang, 'settings.connect')}
                  onClick={() => {
                    rpc.invoke(Channels.TwitchAuthorize).catch(() => undefined);
                  }}
                >
                  <KeyRound size={14} />
                  {t(lang, 'settings.connect')}
                </Button>
              </div>
            </div>

            {mockMode && (
              <div className="border-t border-ink/15 pt-4">
                <Badge tone="warning">{t(lang, 'settings.browserPreview')}</Badge>
              </div>
            )}
          </div>
        </Card>

        <Card title={t(lang, 'settings.guide')} className="xl:col-span-6">
          <p className="font-sans text-sm text-ink/70">{t(lang, 'settings.guideIntro')}</p>
          <ol className="mt-6 space-y-5">
            {guideSteps.map((step, index) => (
              <li key={index} className="flex gap-4">
                <span aria-hidden dir="ltr" className="shrink-0 font-display text-lg leading-tight text-primary">
                  {index + 1}
                </span>
                <p className="font-sans text-sm leading-relaxed text-ink/80">{step}</p>
              </li>
            ))}
          </ol>
        </Card>

        <Card title={t(lang, 'settings.aiProviders')} className="xl:col-span-12">
          <div className="flex items-start gap-3 border border-ink/20 bg-surface px-4 py-3">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
            <div>
              <div className="font-sans text-sm font-semibold text-ink">{t(lang, 'settings.aiProvidersHint')}</div>
              <div className="mt-1 font-sans text-xs leading-relaxed text-ink/65">{t(lang, 'settings.openRouterPrivacy')}</div>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'settings.aiProvider')}</div>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t(lang, 'settings.aiProvider')}>
                {(['openrouter', 'groq'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`cursor-pointer select-none border px-3 py-1.5 font-sans text-xs font-bold uppercase tracking-[0.08em] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${provider === option ? 'border-primary bg-primary text-on-primary' : 'border-ink/25 bg-surface-2 text-ink/70 hover:border-ink/50 hover:bg-ink/5'}`}
                    onClick={() => { setProvider(option); setApiKey(''); setKeyStatus(null); }}
                  >
                    {option === 'openrouter' ? 'OpenRouter' : 'Groq'}
                  </button>
                ))}
              </div>
            </div>
            <label className="block min-w-0 flex-1 font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
              {provider === 'groq' ? t(lang, 'settings.groqKey') : t(lang, 'settings.openRouterKey')}
              <Input className="mt-2" dir="ltr" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={(provider === 'groq' ? groqConfigured : openRouterConfigured) ? '••••••••••••' : provider === 'groq' ? 'gsk_…' : 'sk-or-v1-…'} />
            </label>
            <div className="flex gap-2">
              <Button onClick={async () => { const ok = await saveOpenRouterKey(provider, apiKey); setKeyStatus(ok ? t(lang, 'settings.openRouterSaved') : t(lang, 'settings.openRouterFailed')); if (ok) setApiKey(''); }}>
                {t(lang, 'settings.openRouterSave')}
              </Button>
              {(provider === 'groq' ? groqConfigured : openRouterConfigured) && <Button variant="danger" onClick={async () => { const ok = await removeOpenRouterKey(provider); setKeyStatus(ok ? t(lang, 'settings.openRouterRemoved') : t(lang, 'settings.openRouterFailed')); }}>{t(lang, 'settings.openRouterRemove')}</Button>}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">
            <span className={`h-2 w-2 rounded-full ${(provider === 'groq' ? groqConfigured : openRouterConfigured) ? 'bg-primary' : 'bg-ink/25'}`} />
            {(provider === 'groq' ? groqConfigured : openRouterConfigured) ? t(lang, 'settings.openRouterConfigured') : t(lang, 'settings.openRouterNotConfigured')}
            {keyStatus && <span className="font-normal normal-case tracking-normal text-ink/70">· {keyStatus}</span>}
          </div>
        </Card>

        <Card title={t(lang, 'settings.language')} className="xl:col-span-12">
          <div className="flex items-center gap-3">
            <Languages size={16} className="text-primary" aria-hidden />
            <p className="font-sans text-sm text-ink/70">{t(lang, 'settings.languageHint')}</p>
          </div>
          <div className="mt-4 max-w-sm">
            <SegmentedControl
              name="app-language"
              value={lang}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ar', label: 'العربية' },
              ]}
              onChange={(value) => setLanguage(value)}
            />
          </div>
        </Card>

        <Card title={t(lang, 'settings.theme')} className="xl:col-span-12">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon size={16} className="text-primary" aria-hidden /> : <Sun size={16} className="text-primary" aria-hidden />}
            <p className="font-sans text-sm text-ink/70">{t(lang, 'settings.themeHint')}</p>
          </div>
          <div className="mt-4 max-w-sm">
            <SegmentedControl
              name="app-theme"
              value={theme}
              options={[
                { value: 'light', label: t(lang, 'settings.themeLight') },
                { value: 'dark', label: t(lang, 'settings.themeDark') },
              ]}
              onChange={(value) => setTheme(value as 'light' | 'dark')}
            />
          </div>
        </Card>      </div>
    </div>
  );
}

