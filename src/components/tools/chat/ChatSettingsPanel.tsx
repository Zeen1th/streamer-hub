import { useState } from 'react';
import { Check, Copy, ExternalLink, Sliders, Type, Palette, Eye, Radio } from 'lucide-react';
import { t } from '../../../i18n/translations';
import { useChatOverlayStore } from '../../../store/chatOverlayStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { Switch } from '../../ui/Switch';
import type {
  ChatOverlayAnimation,
  ChatOverlayDisplayMode,
  ChatOverlayMessageStyle,
  ChatOverlayTheme,
} from '../../../rpc/contracts';

export function ChatSettingsPanel() {
  const store = useChatOverlayStore();
  const settings = store.settings;
  const overlayUrl = store.overlayUrl;
  const updateSettings = store.updateSettings;
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    if (!overlayUrl) return;
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleOpenBrowser = () => {
    if (!overlayUrl) return;
    window.open(overlayUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Master Enable & OBS URL Card */}
      <Card title={t(lang, 'chat.enable')}>
        <div className="space-y-5">
          {/* Master Enable Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-ink">
                {t(lang, 'chat.enable')}
              </div>
              <div className="mt-1 font-sans text-xs text-ink/70">
                {t(lang, 'chat.enableHint')}
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onChange={(enabled) => updateSettings({ enabled })}
              label={t(lang, 'chat.enable')}
            />
          </div>

          {/* OBS Browser Source URL */}
          <div className="border border-ink/20 bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-primary" />
                <span className="font-sans text-xs font-bold uppercase tracking-[0.15em] text-ink/70">
                  {t(lang, 'chat.obsUrl')}
                </span>
              </div>
            </div>

            <div dir="ltr" className="mt-2.5 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={overlayUrl || 'http://127.0.0.1:49178/chat-overlay.html'}
                className="w-full border border-ink/25 bg-surface-2 px-3 py-2 font-mono text-xs text-ink selection:bg-primary/30"
              />
              <Button
                variant={copied ? 'outline' : 'primary'}
                size="sm"
                title={copied ? t(lang, 'chat.copied') : t(lang, 'chat.copyUrl')}
                onClick={handleCopyUrl}
                className="shrink-0"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copied ? t(lang, 'chat.copied') : t(lang, 'chat.copyUrl')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                title={t(lang, 'chat.openBrowser')}
                onClick={handleOpenBrowser}
                className="shrink-0"
              >
                <ExternalLink size={14} />
              </Button>
            </div>

            <p className="mt-2.5 font-sans text-xs leading-relaxed text-ink/65">
              {t(lang, 'chat.obsUrlHint')}
            </p>
          </div>
        </div>
      </Card>

      {/* Display Mode & Timing */}
      <Card title={t(lang, 'chat.displayMode')}>
        <div className="space-y-5">
          <div>
            <div className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
              {t(lang, 'chat.displayMode')}
            </div>
            <SegmentedControl<ChatOverlayDisplayMode>
              name="chat-display-mode"
              value={settings.displayMode}
              onChange={(displayMode) => updateSettings({ displayMode })}
              options={[
                { value: 'stacked', label: t(lang, 'chat.modeStacked'), title: t(lang, 'chat.modeStackedHint') },
                { value: 'latest', label: t(lang, 'chat.modeLatest'), title: t(lang, 'chat.modeLatestHint') },
              ]}
            />
          </div>

          {settings.displayMode === 'stacked' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                  {t(lang, 'chat.maxMessages')}
                </span>
                <span className="font-mono text-xs font-bold text-primary">
                  {settings.maxMessages}
                </span>
              </div>
              <Slider
                min={1}
                max={24}
                step={1}
                value={settings.maxMessages}
                onChange={(maxMessages) => updateSettings({ maxMessages })}
                ariaLabel={t(lang, 'chat.maxMessages')}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                {t(lang, 'chat.duration')}
              </span>
              <span className="font-mono text-xs font-bold text-primary">
                {t(lang, 'chat.durationSeconds', { count: settings.durationSeconds })}
              </span>
            </div>
            <Slider
              min={5}
              max={120}
              step={5}
              value={settings.durationSeconds}
              onChange={(durationSeconds) => updateSettings({ durationSeconds })}
              ariaLabel={t(lang, 'chat.duration')}
            />
          </div>
        </div>
      </Card>

      {/* Appearance & Themes */}
      <Card title={t(lang, 'chat.appearance')}>
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Palette size={14} className="text-primary" />
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                {t(lang, 'chat.theme')}
              </span>
            </div>
            <SegmentedControl<ChatOverlayTheme>
              name="chat-theme"
              value={settings.theme}
              onChange={(theme) => updateSettings({ theme })}
              options={[
                { value: 'dark', label: t(lang, 'chat.themeDark') },
                { value: 'light', label: t(lang, 'chat.themeLight') },
                { value: 'transparent', label: t(lang, 'chat.themeTransparent') },
              ]}
            />
          </div>

          <div>
            <div className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
              {t(lang, 'chat.messageStyle')}
            </div>
            <SegmentedControl<ChatOverlayMessageStyle>
              name="chat-style"
              value={settings.messageStyle}
              onChange={(messageStyle) => updateSettings({ messageStyle })}
              options={[
                { value: 'rounded', label: t(lang, 'chat.styleRounded') },
                { value: 'square', label: t(lang, 'chat.styleSquare') },
              ]}
            />
          </div>

          <div>
            <div className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
              {t(lang, 'chat.animation')}
            </div>
            <SegmentedControl<ChatOverlayAnimation>
              name="chat-animation"
              value={settings.animation}
              onChange={(animation) => updateSettings({ animation })}
              options={[
                { value: 'slide', label: t(lang, 'chat.animSlide') },
                { value: 'fade', label: t(lang, 'chat.animFade') },
                { value: 'off', label: t(lang, 'chat.animOff') },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Typography & Sizing */}
      <Card title={t(lang, 'chat.typography')}>
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Type size={14} className="text-primary" />
                <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                  {t(lang, 'chat.fontSize')}
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-primary">
                {t(lang, 'chat.fontSizePx', { size: settings.fontSize })}
              </span>
            </div>
            <Slider
              min={12}
              max={48}
              step={1}
              value={settings.fontSize}
              onChange={(fontSize) => updateSettings({ fontSize })}
              ariaLabel={t(lang, 'chat.fontSize')}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sliders size={14} className="text-primary" />
                <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                  {t(lang, 'chat.avatarSize')}
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-primary">
                {t(lang, 'chat.avatarSizePx', { size: settings.avatarSize })}
              </span>
            </div>
            <Slider
              min={16}
              max={64}
              step={2}
              value={settings.avatarSize}
              onChange={(avatarSize) => updateSettings({ avatarSize })}
              ariaLabel={t(lang, 'chat.avatarSize')}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                {t(lang, 'chat.spacing')}
              </span>
              <span className="font-mono text-xs font-bold text-primary">
                {t(lang, 'chat.spacingPx', { spacing: settings.spacing })}
              </span>
            </div>
            <Slider
              min={0}
              max={32}
              step={2}
              value={settings.spacing}
              onChange={(spacing) => updateSettings({ spacing })}
              ariaLabel={t(lang, 'chat.spacing')}
            />
          </div>
        </div>
      </Card>

      {/* Visibility Toggles */}
      <Card title={t(lang, 'chat.visibility')}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={14} className="text-primary" />
              <span className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-ink">
                {t(lang, 'chat.showUsernames')}
              </span>
            </div>
            <Switch
              checked={settings.showUsernames}
              onChange={(showUsernames) => updateSettings({ showUsernames })}
              label={t(lang, 'chat.showUsernames')}
            />
          </div>

          <div className="flex items-center justify-between border-t border-ink/15 pt-4">
            <div className="flex items-center gap-2">
              <Eye size={14} className="text-primary" />
              <span className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-ink">
                {t(lang, 'chat.showAvatars')}
              </span>
            </div>
            <Switch
              checked={settings.showAvatars}
              onChange={(showAvatars) => updateSettings({ showAvatars })}
              label={t(lang, 'chat.showAvatars')}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
