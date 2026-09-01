import React, { useEffect, useRef, useState } from 'react';
import {
  AtSign,
  Award,
  Copy,
  Check,
  Filter,
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  Smile,
  Sparkles,
  Square,
  Type,
  Wand2,
} from 'lucide-react';
import { CHAT_OVERLAY_LIMITS, defaultBlockForAnchor } from '../../../lib/chatOverlay';
import { CHAT_OVERLAY_PRESETS } from '../../../lib/chatOverlayPresets';
import { matchInstalledFontFamily, normalizeInstalledFontFamilies } from '../../../lib/fontChoices';
import { resolveFontStack } from '../../../overlay/tokens';
import { rpc } from '../../../rpc';
import {
  Channels,
  type ChatOverlayAlignment,
  type ChatOverlaySettings,
} from '../../../rpc/contracts';
import type { ChatOverlayPart } from '../../../overlay/ChatMessageCard';
import { useChatOverlayStore, type DeepPartial } from '../../../store/chatOverlayStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { t } from '../../../i18n/translations';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { Switch } from '../../ui/Switch';

type SectionId =
  | 'presets'
  | 'layout'
  | 'bubble'
  | 'username'
  | 'text'
  | 'avatar'
  | 'badges'
  | 'emotes'
  | 'filters'
  | 'obs';

/** Which panel section a selected message part maps to. */
const PART_SECTIONS: Record<ChatOverlayPart, SectionId> = {
  bubble: 'bubble',
  avatar: 'avatar',
  username: 'username',
  badge: 'badges',
  text: 'text',
};

interface ChatSettingsPanelProps {
  selectedPart: ChatOverlayPart | null;
}

export function ChatSettingsPanel({ selectedPart }: ChatSettingsPanelProps) {
  const store = useChatOverlayStore();
  const settings = store.settings;
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const [copied, setCopied] = useState(false);
  const [installedFonts, setInstalledFonts] = useState<string[]>([]);
  const [fontListState, setFontListState] = useState<'loading' | 'ready' | 'error'>('loading');

  const patch = (value: DeepPartial<ChatOverlaySettings>) => void store.updateSettings(value);

  // Selecting a part on the canvas scrolls the matching section into view and
  // highlights it, so clicking the username lands you on username styling.
  const highlighted = selectedPart ? PART_SECTIONS[selectedPart] : null;
  useEffect(() => {
    if (!highlighted) return;
    sectionRefs.current[highlighted]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [highlighted, selectedPart]);

  useEffect(() => {
    let cancelled = false;
    rpc.invoke(Channels.SystemListFonts).then(({ fonts }) => {
      if (cancelled) return;
      setInstalledFonts(normalizeInstalledFontFamilies(fonts));
      setFontListState('ready');
    }).catch(() => {
      if (!cancelled) setFontListState('error');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const L = CHAT_OVERLAY_LIMITS;

  const section = (id: SectionId, title: string, icon: React.ReactNode, children: React.ReactNode) => (
    <section
      ref={(el) => {
        sectionRefs.current[id] = el;
      }}
      className={[
        'border-t border-ink/15 px-5 py-5 transition-colors duration-300',
        highlighted === id ? 'bg-primary/10' : '',
      ].join(' ')}
    >
      <h3 className="mb-4 flex items-center gap-2 font-display text-sm uppercase tracking-[0.06em] text-ink">
        {icon}
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );

  return (
    <div className="slab flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Wand2 size={16} className="text-primary" />
          <h2 className="font-display text-base uppercase tracking-[0.04em] text-ink">
            {t(lang, 'chat.settings')}
          </h2>
        </div>
        <Switch
          checked={settings.enabled}
          onChange={(enabled) => patch({ enabled })}
          label={t(lang, 'chat.enable')}
        />
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Presets ------------------------------------------------------- */}
        {section(
          'presets',
          t(lang, 'chat.presets'),
          <Sparkles size={14} className="text-primary" />,
          <div className="flex flex-wrap gap-2">
            {CHAT_OVERLAY_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                size="sm"
                onClick={() => patch(preset.tokens)}
              >
                {preset.name}
              </Button>
            ))}
          </div>,
        )}

        {/* Layout & flow ------------------------------------------------- */}
        {section(
          'layout',
          t(lang, 'chat.section.layout'),
          <LayoutGrid size={14} className="text-primary" />,
          <>
            <Field label={t(lang, 'chat.alignment')} hint={t(lang, 'chat.anchorHint')}>
              <SegmentedControl<ChatOverlayAlignment>
                value={settings.block.anchor}
                onChange={(anchor) => patch({ block: defaultBlockForAnchor(anchor) })}
                options={[
                  { value: 'top-left', label: t(lang, 'chat.alignTopLeft') },
                  { value: 'top-right', label: t(lang, 'chat.alignTopRight') },
                  { value: 'bottom-left', label: t(lang, 'chat.alignBottomLeft') },
                  { value: 'bottom-right', label: t(lang, 'chat.alignBottomRight') },
                ]}
              />
            </Field>

            <Field label={t(lang, 'chat.displayMode')}>
              <SegmentedControl
                value={settings.flow.displayMode}
                onChange={(displayMode) => patch({ flow: { displayMode } })}
                options={[
                  { value: 'stacked', label: t(lang, 'chat.modeStacked') },
                  { value: 'latest', label: t(lang, 'chat.modeLatest') },
                ]}
              />
            </Field>

            <Field label={t(lang, 'chat.flowDirection')} hint={t(lang, 'chat.flowDirectionHint')}>
              <SegmentedControl
                value={settings.flow.direction}
                onChange={(direction) => patch({ flow: { direction } })}
                options={[
                  { value: 'up', label: t(lang, 'chat.flowUp') },
                  { value: 'down', label: t(lang, 'chat.flowDown') },
                ]}
              />
            </Field>

            <NumberRow
              label={t(lang, 'chat.maxMessages')}
              value={settings.flow.maxMessages}
              range={L.maxMessages}
              onChange={(maxMessages) => patch({ flow: { maxMessages } })}
            />
            <NumberRow
              label={t(lang, 'chat.duration')}
              value={settings.flow.durationSeconds}
              range={{ min: 0, max: L.durationSeconds.max }}
              suffix="s"
              hint={settings.flow.durationSeconds === 0 ? t(lang, 'chat.durationNever') : undefined}
              onChange={(durationSeconds) => patch({ flow: { durationSeconds } })}
            />
            <NumberRow
              label={t(lang, 'chat.spacing')}
              value={settings.flow.gap}
              range={L.gap}
              suffix="px"
              onChange={(gap) => patch({ flow: { gap } })}
            />
            <NumberRow
              label={t(lang, 'chat.sizeScale')}
              value={settings.flow.sizeScale}
              range={L.sizeScale}
              suffix="%"
              hint={t(lang, 'chat.sizeScaleHint')}
              onChange={(sizeScale) => patch({ flow: { sizeScale } })}
            />
          </>,
        )}

        {/* Bubble -------------------------------------------------------- */}
        {section(
          'bubble',
          t(lang, 'chat.section.bubble'),
          <Square size={14} className="text-primary" />,
          <>
            <ColorRow
              label={t(lang, 'chat.bubbleBackground')}
              value={settings.bubble.background.color}
              onChange={(color) => patch({ bubble: { background: { color } } })}
            />
            <NumberRow
              label={t(lang, 'chat.backgroundOpacity')}
              value={settings.bubble.background.alpha}
              range={L.alpha}
              suffix="%"
              onChange={(alpha) => patch({ bubble: { background: { alpha } } })}
            />
            <NumberRow
              label={t(lang, 'chat.borderWidth')}
              value={settings.bubble.border.width}
              range={L.borderWidth}
              suffix="px"
              onChange={(width) => patch({ bubble: { border: { width } } })}
            />
            <ColorRow
              label={t(lang, 'chat.borderColor')}
              value={settings.bubble.border.color}
              onChange={(color) => patch({ bubble: { border: { color } } })}
            />
            <NumberRow
              label={t(lang, 'chat.borderRadius')}
              value={settings.bubble.border.radius}
              range={L.borderRadius}
              suffix="px"
              onChange={(radius) => patch({ bubble: { border: { radius } } })}
            />
            <NumberRow
              label={t(lang, 'chat.paddingX')}
              value={settings.bubble.padding.x}
              range={L.padding}
              suffix="px"
              onChange={(x) => patch({ bubble: { padding: { x } } })}
            />
            <NumberRow
              label={t(lang, 'chat.paddingY')}
              value={settings.bubble.padding.y}
              range={L.padding}
              suffix="px"
              onChange={(y) => patch({ bubble: { padding: { y } } })}
            />
            <Field label={t(lang, 'chat.shadow')}>
              <SegmentedControl
                value={settings.bubble.shadow}
                onChange={(shadow) => patch({ bubble: { shadow } })}
                options={[
                  { value: 'off', label: t(lang, 'chat.shadowOff') },
                  { value: 'soft', label: t(lang, 'chat.shadowSoft') },
                  { value: 'hard', label: t(lang, 'chat.shadowHard') },
                ]}
              />
            </Field>
            <NumberRow
              label={t(lang, 'chat.blur')}
              value={settings.bubble.blur}
              range={L.blur}
              suffix="px"
              hint={t(lang, 'chat.blurHint')}
              onChange={(blur) => patch({ bubble: { blur } })}
            />
            <NumberRow
              label={t(lang, 'chat.accentWidth')}
              value={settings.bubble.accent.width}
              range={L.accentWidth}
              suffix="px"
              hint={t(lang, 'chat.accentHint')}
              onChange={(width) => patch({ bubble: { accent: { width } } })}
            />
            <Field label={t(lang, 'chat.accentColorMode')}>
              <SegmentedControl
                value={settings.bubble.accent.colorMode}
                onChange={(colorMode) => patch({ bubble: { accent: { colorMode } } })}
                options={[
                  { value: 'role', label: t(lang, 'chat.colorRole') },
                  { value: 'custom', label: t(lang, 'chat.colorCustom') },
                ]}
              />
            </Field>
            {settings.bubble.accent.colorMode === 'custom' && (
              <ColorRow
                label={t(lang, 'chat.accentColor')}
                value={settings.bubble.accent.color}
                onChange={(color) => patch({ bubble: { accent: { color } } })}
              />
            )}
          </>,
        )}

        {/* Username ------------------------------------------------------ */}
        {section(
          'username',
          t(lang, 'chat.section.username'),
          <AtSign size={14} className="text-primary" />,
          <>
            <ToggleRow
              label={t(lang, 'chat.showUsernames')}
              checked={settings.username.show}
              onChange={(show) => patch({ username: { show } })}
            />
            <FontRow
              id="username-font"
              lang={lang}
              value={settings.username.font}
              installedFonts={installedFonts}
              fontListState={fontListState}
              onChange={(font) => patch({ username: { font } })}
            />
            <NumberRow
              label={t(lang, 'chat.nameSize')}
              value={settings.username.size}
              range={L.usernameSize}
              suffix="px"
              hint={t(lang, 'chat.nameSizeHint')}
              onChange={(size) => patch({ username: { size } })}
            />
            <NumberRow
              label={t(lang, 'chat.fontWeight')}
              value={settings.username.weight}
              range={L.fontWeight}
              step={100}
              onChange={(weight) => patch({ username: { weight } })}
            />
            <Field label={t(lang, 'chat.nameColorMode')}>
              <SegmentedControl
                value={settings.username.colorMode}
                onChange={(colorMode) => patch({ username: { colorMode } })}
                options={[
                  { value: 'role', label: t(lang, 'chat.colorRole') },
                  { value: 'twitch', label: t(lang, 'chat.colorTwitch') },
                  { value: 'custom', label: t(lang, 'chat.colorCustom') },
                ]}
              />
            </Field>
            {settings.username.colorMode === 'custom' && (
              <ColorRow
                label={t(lang, 'chat.nameColor')}
                value={settings.username.color}
                onChange={(color) => patch({ username: { color } })}
              />
            )}
            <Field label={t(lang, 'chat.namePosition')}>
              <SegmentedControl
                value={settings.username.position}
                onChange={(position) => patch({ username: { position } })}
                options={[
                  { value: 'above', label: t(lang, 'chat.namePositionAbove') },
                  { value: 'inline', label: t(lang, 'chat.namePositionInline') },
                ]}
              />
            </Field>
            <Field label={t(lang, 'chat.textTransform')}>
              <SegmentedControl
                value={settings.username.transform}
                onChange={(transform) => patch({ username: { transform } })}
                options={[
                  { value: 'none', label: t(lang, 'chat.transformNone') },
                  { value: 'uppercase', label: t(lang, 'chat.transformUpper') },
                  { value: 'lowercase', label: t(lang, 'chat.transformLower') },
                ]}
              />
            </Field>
          </>,
        )}

        {/* Text ---------------------------------------------------------- */}
        {section(
          'text',
          t(lang, 'chat.section.text'),
          <Type size={14} className="text-primary" />,
          <>
            <FontRow
              id="message-font"
              lang={lang}
              value={settings.text.font}
              installedFonts={installedFonts}
              fontListState={fontListState}
              onChange={(font) => patch({ text: { font } })}
            />
            <NumberRow
              label={t(lang, 'chat.fontSize')}
              value={settings.text.size}
              range={L.fontSize}
              suffix="px"
              onChange={(size) => patch({ text: { size } })}
            />
            <NumberRow
              label={t(lang, 'chat.fontWeight')}
              value={settings.text.weight}
              range={L.fontWeight}
              step={100}
              onChange={(weight) => patch({ text: { weight } })}
            />
            <ColorRow
              label={t(lang, 'chat.textColor')}
              value={settings.text.color}
              onChange={(color) => patch({ text: { color } })}
            />
            <Field label={t(lang, 'chat.wrapMode')} hint={t(lang, 'chat.wrapModeHint')}>
              <SegmentedControl
                value={settings.text.wrapMode}
                onChange={(wrapMode) => patch({ text: { wrapMode } })}
                options={[
                  { value: 'normal', label: t(lang, 'chat.wrapNormal') },
                  { value: 'break-anywhere', label: t(lang, 'chat.wrapAnywhere') },
                  { value: 'clip', label: t(lang, 'chat.wrapClip') },
                ]}
              />
            </Field>
            <NumberRow
              label={t(lang, 'chat.lineHeight')}
              value={settings.text.lineHeight}
              range={L.lineHeight}
              step={0.05}
              decimals={2}
              onChange={(lineHeight) => patch({ text: { lineHeight } })}
            />
            <NumberRow
              label={t(lang, 'chat.maxWidth')}
              value={settings.text.maxWidth}
              range={L.maxWidth}
              suffix="px"
              hint={t(lang, 'chat.maxWidthHint')}
              onChange={(maxWidth) => patch({ text: { maxWidth } })}
            />
            <ToggleRow
              label={t(lang, 'chat.textShadow')}
              hint={t(lang, 'chat.textShadowHint')}
              checked={settings.text.shadow}
              onChange={(shadow) => patch({ text: { shadow } })}
            />
          </>,
        )}

        {/* Avatar -------------------------------------------------------- */}
        {section(
          'avatar',
          t(lang, 'chat.section.avatar'),
          <ImageIcon size={14} className="text-primary" />,
          <>
            <ToggleRow
              label={t(lang, 'chat.showAvatars')}
              checked={settings.avatar.show}
              onChange={(show) => patch({ avatar: { show } })}
            />
            <NumberRow
              label={t(lang, 'chat.avatarSize')}
              value={settings.avatar.size}
              range={L.avatarSize}
              suffix="px"
              onChange={(size) => patch({ avatar: { size } })}
            />
            <Field label={t(lang, 'chat.avatarShape')}>
              <SegmentedControl
                value={settings.avatar.shape}
                onChange={(shape) => patch({ avatar: { shape } })}
                options={[
                  { value: 'circle', label: t(lang, 'chat.shapeCircle') },
                  { value: 'squircle', label: t(lang, 'chat.shapeSquircle') },
                  { value: 'rounded', label: t(lang, 'chat.shapeRounded') },
                  { value: 'square', label: t(lang, 'chat.shapeSquare') },
                ]}
              />
            </Field>
            <Field
              label={t(lang, 'chat.identityLayout')}
              hint={t(lang, 'chat.identityLayoutHint')}
            >
              <SegmentedControl
                value={settings.identity.direction}
                onChange={(direction) => patch({ identity: { direction } })}
                options={[
                  { value: 'ltr', label: t(lang, 'chat.identityLtr') },
                  { value: 'rtl', label: t(lang, 'chat.identityRtl') },
                ]}
              />
            </Field>
            <NumberRow
              label={t(lang, 'chat.avatarBorder')}
              value={settings.avatar.borderWidth}
              range={L.borderWidth}
              suffix="px"
              onChange={(borderWidth) => patch({ avatar: { borderWidth } })}
            />
          </>,
        )}

        {/* Badges -------------------------------------------------------- */}
        {section(
          'badges',
          t(lang, 'chat.section.badges'),
          <Award size={14} className="text-primary" />,
          <>
            <ToggleRow
              label={t(lang, 'chat.showBadges')}
              checked={settings.badges.show}
              onChange={(show) => patch({ badges: { show } })}
            />
            <NumberRow
              label={t(lang, 'chat.badgeSize')}
              value={settings.badges.size}
              range={L.badgeSize}
              suffix="px"
              onChange={(size) => patch({ badges: { size } })}
            />
          </>,
        )}

        {/* Emotes -------------------------------------------------------- */}
        {section(
          'emotes',
          t(lang, 'chat.section.emotes'),
          <Smile size={14} className="text-primary" />,
          <>
            <ToggleRow
              label={t(lang, 'chat.emoteTwitch')}
              checked={settings.emotes.twitch}
              onChange={(twitch) => patch({ emotes: { twitch } })}
            />
            <ToggleRow
              label="BetterTTV"
              checked={settings.emotes.bttv}
              onChange={(bttv) => patch({ emotes: { bttv } })}
            />
            <ToggleRow
              label="FrankerFaceZ"
              checked={settings.emotes.ffz}
              onChange={(ffz) => patch({ emotes: { ffz } })}
            />
            <ToggleRow
              label="7TV"
              checked={settings.emotes.sevenTv}
              onChange={(sevenTv) => patch({ emotes: { sevenTv } })}
            />
            <NumberRow
              label={t(lang, 'chat.emoteSize')}
              value={settings.emotes.sizeScale}
              range={L.emoteScale}
              suffix="%"
              onChange={(sizeScale) => patch({ emotes: { sizeScale } })}
            />
            <NumberRow
              label={t(lang, 'chat.emoteOnlyScale')}
              value={settings.emotes.emoteOnlyScale}
              range={L.emoteOnlyScale}
              suffix="%"
              hint={t(lang, 'chat.emoteOnlyScaleHint')}
              onChange={(emoteOnlyScale) => patch({ emotes: { emoteOnlyScale } })}
            />
          </>,
        )}

        {/* Filters ------------------------------------------------------- */}
        {section(
          'filters',
          t(lang, 'chat.section.filters'),
          <Filter size={14} className="text-primary" />,
          <>
            <ListEditor
              label={t(lang, 'chat.blockedUsernames')}
              hint={t(lang, 'chat.blockedUsernamesHint')}
              values={settings.filters.blockedUsernames}
              placeholder="spambot*"
              onChange={(blockedUsernames) => patch({ filters: { blockedUsernames } })}
            />
            <ToggleRow
              label={t(lang, 'chat.hideBots')}
              hint={settings.filters.botList.join(', ')}
              checked={settings.filters.hideBots}
              onChange={(hideBots) => patch({ filters: { hideBots } })}
            />
            <ToggleRow
              label={t(lang, 'chat.hideCommands')}
              hint={t(lang, 'chat.hideCommandsHint')}
              checked={settings.filters.hideCommands}
              onChange={(hideCommands) => patch({ filters: { hideCommands } })}
            />
            <ListEditor
              label={t(lang, 'chat.blockedWords')}
              values={settings.filters.blockedWords}
              placeholder={t(lang, 'chat.blockedWordsPlaceholder')}
              onChange={(blockedWords) => patch({ filters: { blockedWords } })}
            />
            <Field label={t(lang, 'chat.blockedWordAction')}>
              <SegmentedControl
                value={settings.filters.blockedWordAction}
                onChange={(blockedWordAction) => patch({ filters: { blockedWordAction } })}
                options={[
                  { value: 'drop', label: t(lang, 'chat.actionDrop') },
                  { value: 'mask', label: t(lang, 'chat.actionMask') },
                ]}
              />
            </Field>
            <NumberRow
              label={t(lang, 'chat.minLength')}
              value={settings.filters.minLength}
              range={L.minLength}
              hint={t(lang, 'chat.minLengthHint')}
              onChange={(minLength) => patch({ filters: { minLength } })}
            />
          </>,
        )}

        {/* Animation + OBS ----------------------------------------------- */}
        {section(
          'obs',
          t(lang, 'chat.section.output'),
          <Palette size={14} className="text-primary" />,
          <>
            <Field label={t(lang, 'chat.animation')}>
              <SegmentedControl
                value={settings.animation.kind}
                onChange={(kind) => patch({ animation: { kind } })}
                options={[
                  { value: 'slide', label: t(lang, 'chat.animSlide') },
                  { value: 'fade', label: t(lang, 'chat.animFade') },
                  { value: 'pop', label: 'Pop' },
                  { value: 'glow', label: 'Glow' },
                  { value: 'flip', label: 'Flip' },
                  { value: 'off', label: t(lang, 'chat.animOff') },
                ]}
              />
            </Field>
            <NumberRow
              label={t(lang, 'chat.animationDuration')}
              value={settings.animation.durationMs}
              range={L.animationDurationMs}
              step={10}
              suffix="ms"
              onChange={(durationMs) => patch({ animation: { durationMs } })}
            />

            <Field label={t(lang, 'chat.obsUrl')} hint={t(lang, 'chat.obsUrlHint2')}>
              <div className="flex gap-2">
                <Input readOnly value={store.overlayUrl} />
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(store.overlayUrl);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                  disabled={!store.overlayUrl}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
            </Field>
          </>,
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ controls

interface NumberRowProps {
  label: string;
  value: number;
  range: { min: number; max: number };
  step?: number;
  decimals?: number;
  suffix?: string;
  hint?: string;
  onChange: (value: number) => void;
}

function NumberRow({ label, value, range, step = 1, decimals = 0, suffix, hint, onChange }: NumberRowProps) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <Slider
          value={value}
          min={range.min}
          max={range.max}
          step={step}
          onChange={onChange}
          ariaLabel={label}
        />
        <span className="w-16 shrink-0 text-end font-mono text-xs text-ink/70">
          {value.toFixed(decimals)}
          {suffix}
        </span>
      </div>
    </Field>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
          {label}
        </span>
        {hint && <span className="mt-1 block truncate font-sans text-xs text-ink/55">{hint}</span>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value.slice(0, 7)}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 shrink-0 cursor-pointer border border-ink/25 bg-surface-2"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      </div>
    </Field>
  );
}

function FontRow({
  id,
  lang,
  value,
  installedFonts,
  fontListState,
  onChange,
}: {
  id: string;
  lang: 'en' | 'ar';
  value: ChatOverlaySettings['text']['font'];
  installedFonts: string[];
  fontListState: 'loading' | 'ready' | 'error';
  onChange: (font: ChatOverlaySettings['text']['font']) => void;
}) {
  const [available, setAvailable] = useState(true);
  const installedMatch = matchInstalledFontFamily(value.customName, installedFonts);

  useEffect(() => {
    if (value.family !== 'custom' || !value.customName) {
      setAvailable(true);
      return;
    }
    // Reports a missing custom font instead of silently falling back.
    if (fontListState === 'ready') {
      setAvailable(installedMatch !== null);
      return;
    }
    if (fontListState === 'loading') return;
    try {
      setAvailable(document.fonts.check(`16px "${value.customName}"`));
    } catch {
      setAvailable(true);
    }
  }, [fontListState, installedMatch, value.family, value.customName]);

  return (
    <Field
      label={t(lang, 'chat.fontFamily')}
      hint={value.family === 'custom' && !available ? t(lang, 'chat.fontMissing') : undefined}
    >
      <div className="space-y-3">
        <SegmentedControl
          value={value.family}
          onChange={(family) => onChange({ ...value, family })}
          options={[
            { value: 'barlow', label: 'Barlow' },
            { value: 'cairo', label: 'Cairo' },
            { value: 'cinzel', label: 'Cinzel' },
            { value: 'jetbrains-mono', label: 'Mono' },
            { value: 'system', label: 'System' },
            { value: 'custom', label: t(lang, 'chat.fontCustom') },
          ]}
        />
        {value.family === 'custom' && (
          <div className="space-y-2">
            <Input
              list={`${id}-installed-fonts`}
              value={value.customName}
              placeholder={t(lang, 'chat.fontSearchPlaceholder')}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => onChange({ ...value, customName: event.target.value })}
              onBlur={() => {
                if (installedMatch && installedMatch !== value.customName) {
                  onChange({ ...value, customName: installedMatch });
                }
              }}
            />
            <datalist id={`${id}-installed-fonts`}>
              {installedFonts.map((font) => <option key={font} value={font} />)}
            </datalist>
            <p className="font-sans text-xs text-ink/60">
              {fontListState === 'loading'
                ? t(lang, 'chat.fontLoading')
                : fontListState === 'error'
                  ? t(lang, 'chat.fontListUnavailable')
                  : t(lang, 'chat.fontPickerHint')}
            </p>
            <div className="border border-ink/15 bg-surface px-3 py-2">
              <div className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-ink/50">
                {t(lang, 'chat.fontPreview')}
              </div>
              <div
                className="mt-1 truncate text-lg text-ink"
                style={{ fontFamily: resolveFontStack(value) }}
              >
                Stream chat · أهلاً بالبث
              </div>
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

function ListEditor({
  label,
  hint,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  values: string[];
  placeholder?: string;
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const entry = draft.trim();
    if (!entry) return;
    if (values.some((v) => v.toLowerCase() === entry.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, entry]);
    setDraft('');
  };

  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={draft}
            placeholder={placeholder}
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button variant="outline" onClick={add} disabled={!draft.trim()}>
            +
          </Button>
        </div>
        {values.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {values.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => onChange(values.filter((v) => v !== entry))}
                className="inline-flex items-center gap-1 border border-ink/25 bg-surface-2 px-2 py-0.5 font-mono text-xs text-ink/80 hover:border-danger hover:text-danger"
              >
                {entry} <span aria-hidden>x</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}
