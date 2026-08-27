import { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Sliders,
  Type,
  Palette,
  Eye,
  Radio,
  Sparkles,
  Layout,
  Layers,
  User,
  Wand2,
} from 'lucide-react';
import { t } from '../../../i18n/translations';
import { useChatOverlayStore } from '../../../store/chatOverlayStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { Switch } from '../../ui/Switch';
import type {
  ChatOverlayAlignment,
  ChatOverlayAnimation,
  ChatOverlayAvatarPosition,
  ChatOverlayAvatarShape,
  ChatOverlayDisplayMode,
  ChatOverlayFontFamily,
  ChatOverlayMessageStyle,
  ChatOverlaySettings,
  ChatOverlayTheme,
} from '../../../rpc/contracts';

interface Preset {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  settings: Partial<ChatOverlaySettings>;
}

const PRESETS: Preset[] = [
  {
    id: 'glass',
    name: 'Minimal Glass',
    nameAr: 'زجاجي شفاف',
    icon: '✨',
    settings: {
      theme: 'transparent',
      backgroundOpacity: 35,
      textShadow: true,
      fontFamily: 'barlow',
      avatarShape: 'circle',
      messageStyle: 'rounded',
      animation: 'slide',
      showBadges: true,
      compactMode: false,
    },
  },
  {
    id: 'ember',
    name: 'Ember RPG',
    nameAr: 'جمر ملحمي',
    icon: '🔥',
    settings: {
      theme: 'ember',
      backgroundOpacity: 85,
      textShadow: true,
      fontFamily: 'cinzel',
      avatarShape: 'squircle',
      messageStyle: 'rounded',
      animation: 'pop',
      showBadges: true,
      compactMode: false,
    },
  },
  {
    id: 'neon',
    name: 'Cyberpunk Neon',
    nameAr: 'نيون سايبر',
    icon: '⚡',
    settings: {
      theme: 'neon',
      backgroundOpacity: 90,
      textShadow: true,
      fontFamily: 'jetbrains-mono',
      avatarShape: 'square',
      messageStyle: 'square',
      animation: 'glow',
      showBadges: true,
      compactMode: false,
    },
  },
  {
    id: 'compact',
    name: 'Clean Compact',
    nameAr: 'مدمج وبسيط',
    icon: '📱',
    settings: {
      theme: 'dark',
      backgroundOpacity: 80,
      textShadow: true,
      fontFamily: 'cairo',
      avatarShape: 'rounded',
      messageStyle: 'rounded',
      animation: 'fade',
      showBadges: true,
      compactMode: true,
      fontSize: 20,
      avatarSize: 28,
    },
  },
  {
    id: 'light',
    name: 'Clean Light',
    nameAr: 'فاتح نقي',
    icon: '🌸',
    settings: {
      theme: 'light',
      backgroundOpacity: 95,
      textShadow: false,
      fontFamily: 'cairo',
      avatarShape: 'squircle',
      messageStyle: 'rounded',
      animation: 'slide',
      showBadges: true,
      compactMode: false,
    },
  },
];

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

  const applyPreset = (preset: Preset) => {
    void updateSettings(preset.settings);
  };

  return (
    <div className="space-y-6">
      {/* 1-Click Design Presets */}
      <Card title={t(lang, 'chat.presets')}>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-ink/65">
            <Wand2 size={13} className="text-primary" />
            <span>{t(lang, 'chat.presetsHint')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="slab flex items-center gap-2 px-3 py-2.5 text-start font-sans text-xs font-bold transition-all hover:border-primary hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="text-base">{preset.icon}</span>
                <span className="truncate">{lang === 'ar' ? preset.nameAr : preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

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

      {/* Appearance & Themes */}
      <Card title={t(lang, 'chat.appearance')}>
        <div className="space-y-5">
          {/* Theme */}
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
                { value: 'neon', label: t(lang, 'chat.themeNeon') },
                { value: 'ember', label: t(lang, 'chat.themeEmber') },
              ]}
            />
          </div>

          {/* Background Opacity */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                {t(lang, 'chat.backgroundOpacity')}
              </span>
              <span className="font-mono text-xs font-bold text-primary">
                {settings.backgroundOpacity}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={settings.backgroundOpacity}
              onChange={(backgroundOpacity) => updateSettings({ backgroundOpacity })}
              ariaLabel={t(lang, 'chat.backgroundOpacity')}
            />
          </div>

          {/* Message Shape & Text Outline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="flex items-center justify-between h-full pt-4 sm:pt-0">
                <div className="flex flex-col">
                  <span className="font-sans text-xs font-bold uppercase tracking-[0.08em] text-ink">
                    {t(lang, 'chat.textShadow')}
                  </span>
                  <span className="text-[11px] text-ink/60">
                    {t(lang, 'chat.textShadowHint')}
                  </span>
                </div>
                <Switch
                  checked={settings.textShadow}
                  onChange={(textShadow) => updateSettings({ textShadow })}
                  label={t(lang, 'chat.textShadow')}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Typography & Fonts */}
      <Card title={t(lang, 'chat.typography')}>
        <div className="space-y-5">
          {/* Font Family */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Type size={14} className="text-primary" />
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                {t(lang, 'chat.fontFamily')}
              </span>
            </div>
            <SegmentedControl<ChatOverlayFontFamily>
              name="chat-font-family"
              value={settings.fontFamily}
              onChange={(fontFamily) => updateSettings({ fontFamily })}
              options={[
                { value: 'barlow', label: 'Barlow' },
                { value: 'cairo', label: 'Cairo' },
                { value: 'cinzel', label: 'Cinzel' },
                { value: 'jetbrains-mono', label: 'Mono' },
                { value: 'system', label: 'System' },
              ]}
            />
          </div>

          {/* Font Size */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                {t(lang, 'chat.fontSize')}
              </span>
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

          {/* Overall Overlay Scale */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                {t(lang, 'chat.scale')}
              </span>
              <span className="font-mono text-xs font-bold text-primary">
                {settings.scale}%
              </span>
            </div>
            <Slider
              min={50}
              max={150}
              step={5}
              value={settings.scale}
              onChange={(scale) => updateSettings({ scale })}
              ariaLabel={t(lang, 'chat.scale')}
            />
          </div>
        </div>
      </Card>

      {/* Avatar & Badges */}
      <Card title={t(lang, 'chat.avatarAndBadges')}>
        <div className="space-y-5">
          {/* Avatar Shape */}
          <div>
            <div className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
              {t(lang, 'chat.avatarShape')}
            </div>
            <SegmentedControl<ChatOverlayAvatarShape>
              name="chat-avatar-shape"
              value={settings.avatarShape}
              onChange={(avatarShape) => updateSettings({ avatarShape })}
              options={[
                { value: 'circle', label: t(lang, 'chat.shapeCircle') },
                { value: 'squircle', label: t(lang, 'chat.shapeSquircle') },
                { value: 'rounded', label: t(lang, 'chat.shapeRounded') },
                { value: 'square', label: t(lang, 'chat.shapeSquare') },
              ]}
            />
          </div>

          {/* Avatar Size */}
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

          {/* Element Visibility Toggles */}
          <div className="space-y-3.5 border-t border-ink/15 pt-4">
            <div className="flex items-center justify-between">
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

            <div className="flex items-center justify-between border-t border-ink/10 pt-3">
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

            <div className="flex items-center justify-between border-t border-ink/10 pt-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-primary" />
                <span className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-ink">
                  {t(lang, 'chat.showBadges')}
                </span>
              </div>
              <Switch
                checked={settings.showBadges}
                onChange={(showBadges) => updateSettings({ showBadges })}
                label={t(lang, 'chat.showBadges')}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Layout, Timing & Animation */}
      <Card title={t(lang, 'chat.layoutAndAnimation')}>
        <div className="space-y-5">
          {/* Display Mode */}
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

          {/* Compact Mode */}
          <div className="flex items-center justify-between border-y border-ink/15 py-3">
            <div className="flex flex-col">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.08em] text-ink">
                {t(lang, 'chat.compactMode')}
              </span>
              <span className="text-[11px] text-ink/60">
                {t(lang, 'chat.compactModeHint')}
              </span>
            </div>
            <Switch
              checked={settings.compactMode}
              onChange={(compactMode) => updateSettings({ compactMode })}
              label={t(lang, 'chat.compactMode')}
            />
          </div>

          {/* Alignment */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Layout size={14} className="text-primary" />
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                {t(lang, 'chat.alignment')}
              </span>
            </div>
            <SegmentedControl<ChatOverlayAlignment>
              name="chat-alignment"
              value={settings.alignment}
              onChange={(alignment) => updateSettings({ alignment })}
              options={[
                { value: 'bottom-left', label: t(lang, 'chat.alignBottomLeft') },
                { value: 'bottom-right', label: t(lang, 'chat.alignBottomRight') },
                { value: 'top-left', label: t(lang, 'chat.alignTopLeft') },
                { value: 'top-right', label: t(lang, 'chat.alignTopRight') },
              ]}
            />
          </div>

          {/* Avatar Position / Card Layout */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <User size={14} className="text-primary" />
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                {t(lang, 'chat.avatarPosition')}
              </span>
            </div>
            <SegmentedControl<ChatOverlayAvatarPosition>
              name="chat-avatar-position"
              value={settings.avatarPosition ?? 'left'}
              onChange={(avatarPosition) => updateSettings({ avatarPosition })}
              options={[
                { value: 'left', label: t(lang, 'chat.avatarPositionLeft') },
                { value: 'right', label: t(lang, 'chat.avatarPositionRight') },
              ]}
            />
          </div>

          {/* Animation */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Layers size={14} className="text-primary" />
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
                {t(lang, 'chat.animation')}
              </span>
            </div>
            <SegmentedControl<ChatOverlayAnimation>
              name="chat-animation"
              value={settings.animation}
              onChange={(animation) => updateSettings({ animation })}
              options={[
                { value: 'slide', label: t(lang, 'chat.animSlide') },
                { value: 'fade', label: t(lang, 'chat.animFade') },
                { value: 'pop', label: t(lang, 'chat.animPop') },
                { value: 'glow', label: t(lang, 'chat.animGlow') },
                { value: 'flip', label: t(lang, 'chat.animFlip') },
                { value: 'off', label: t(lang, 'chat.animOff') },
              ]}
            />
          </div>

          {/* Max Messages */}
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

          {/* Duration */}
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
              min={3}
              max={120}
              step={settings.durationSeconds <= 15 ? 1 : 5}
              value={settings.durationSeconds}
              onChange={(durationSeconds) => updateSettings({ durationSeconds })}
              ariaLabel={t(lang, 'chat.duration')}
            />
          </div>

          {/* Message Spacing */}
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
    </div>
  );
}
