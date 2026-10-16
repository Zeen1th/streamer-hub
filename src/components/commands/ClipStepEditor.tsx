import { useState } from 'react';
import { Check, Clapperboard, Copy, ExternalLink, Radio, Square } from 'lucide-react';
import type { ClipPeriod, ClipSelection, OverlayAnimation, OverlayPosition, SequenceStep } from '../../rpc/contracts';
import { Channels } from '../../rpc/contracts';
import { rpc } from '../../rpc';
import { useConnectionStore } from '../../store/connectionStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Switch } from '../ui/Switch';

/** Everything the "Show a clip" sub-action lets the streamer tweak. */
export interface ClipSettings {
  channel: string;
  selection: ClipSelection;
  period: ClipPeriod;
  maxSeconds: number;
  useClipLength: boolean;
  volume: number;
  position: OverlayPosition;
  animation: OverlayAnimation;
  size: number;
  showCaption: boolean;
  caption: string;
  waitForEnd: boolean;
}

export const CLIP_DEFAULT_CAPTION = 'Go follow {channel}!';

export function clipSettingsFromStep(step: SequenceStep): ClipSettings {
  return {
    channel: step.clipChannel ?? '{target}',
    selection: step.clipSelection ?? 'top',
    period: step.clipPeriod ?? 'month',
    maxSeconds: step.clipMaxSeconds ?? 30,
    useClipLength: step.clipUseClipLength ?? false,
    volume: step.clipVolume ?? 0.7,
    position: step.clipPosition ?? 'center',
    animation: step.clipAnimation ?? 'zoom',
    size: step.clipSize ?? 50,
    showCaption: step.clipShowCaption ?? true,
    caption: step.clipCaption ?? CLIP_DEFAULT_CAPTION,
    waitForEnd: step.clipWaitForEnd ?? false,
  };
}

export function clipSettingsToStep(clip: ClipSettings): Partial<SequenceStep> {
  return {
    clipChannel: clip.channel.trim(),
    clipSelection: clip.selection,
    clipPeriod: clip.period,
    clipMaxSeconds: clip.maxSeconds,
    clipUseClipLength: clip.useClipLength,
    clipVolume: clip.volume,
    clipPosition: clip.position,
    clipAnimation: clip.animation,
    clipSize: clip.size,
    clipShowCaption: clip.showCaption,
    clipCaption: clip.caption.trim(),
    clipWaitForEnd: clip.waitForEnd,
  };
}

const OVERLAY_URL = 'http://127.0.0.1:49178/image-overlay.html';

const TEXT = {
  en: {
    channel: 'Take the clip from',
    channelHint: '{target} is the raider, or whoever is named after the command (!so name).',
    tokens: 'Tokens',
    selection: 'Which clip',
    top: 'Most viewed',
    random: 'Random',
    recent: 'Newest',
    period: 'From the last',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    all: 'All time',
    maxSeconds: 'Longest it may play',
    useClipLength: 'Show the whole clip (its own length)',
    volume: 'Volume',
    position: 'Position',
    animation: 'Animation',
    size: 'Size on screen',
    caption: 'Show a caption under the clip',
    captionText: 'Caption',
    captionTokens: 'The caption can use {channel}, {clip_title} and {clip_creator}.',
    waitForEnd: 'Wait for the clip to finish before the next sub-action',
    source: 'OBS browser source (same one as pictures and GIFs)',
    sourceHint: 'Add this URL as a Browser Source in OBS (1920 x 1080) and turn on "Control audio via OBS" to hear the clip.',
    copy: 'Copy',
    copied: 'Copied',
    open: 'Open in browser',
    testChannel: 'Test with channel',
    test: 'Play a test clip',
    stop: 'Stop',
    playing: 'Playing',
    center: 'Center',
    'top-center': 'Top center',
    'bottom-center': 'Bottom center',
    'top-left': 'Top left',
    'top-right': 'Top right',
    'bottom-left': 'Bottom left',
    'bottom-right': 'Bottom right',
    fullscreen: 'Fullscreen',
    zoom: 'Zoom in',
    bounce: 'Bounce',
    fade: 'Fade in',
    'slide-up': 'Slide up',
    'slide-down': 'Slide down',
    none: 'None',
    noClips: 'That channel has no clips in this time window. Try a longer period.',
    noChannel: 'Type a channel to test with.',
    notConnected: 'Connect to Twitch first (Settings > Twitch).',
  },
  ar: {
    channel: 'خذ المقطع من قناة',
    channelHint: '{target} هو الرايدر، أو الاسم المكتوب بعد الأمر (!so اسم).',
    tokens: 'متغيرات',
    selection: 'أي مقطع',
    top: 'الأكثر مشاهدة',
    random: 'عشوائي',
    recent: 'الأحدث',
    period: 'خلال آخر',
    week: 'أسبوع',
    month: 'شهر',
    year: 'سنة',
    all: 'كل الوقت',
    maxSeconds: 'أطول مدة للعرض',
    useClipLength: 'اعرض المقطع كاملاً (حسب طوله)',
    volume: 'مستوى الصوت',
    position: 'المكان',
    animation: 'حركة الظهور',
    size: 'الحجم على الشاشة',
    caption: 'إظهار عنوان تحت المقطع',
    captionText: 'العنوان',
    captionTokens: 'يمكن استخدام {channel} و {clip_title} و {clip_creator} في العنوان.',
    waitForEnd: 'انتظر حتى ينتهي المقطع قبل الإجراء التالي',
    source: 'مصدر المتصفح في OBS (نفس مصدر الصور والـ GIF)',
    sourceHint: 'أضف هذا الرابط كـ Browser Source في OBS بدقة 1920 × 1080، وفعّل "Control audio via OBS" لسماع المقطع.',
    copy: 'نسخ',
    copied: 'تم النسخ',
    open: 'فتح في المتصفح',
    testChannel: 'جرّب مع قناة',
    test: 'تشغيل مقطع تجريبي',
    stop: 'إيقاف',
    playing: 'يعمل الآن',
    center: 'المنتصف',
    'top-center': 'أعلى الوسط',
    'bottom-center': 'أسفل الوسط',
    'top-left': 'أعلى اليسار',
    'top-right': 'أعلى اليمين',
    'bottom-left': 'أسفل اليسار',
    'bottom-right': 'أسفل اليمين',
    fullscreen: 'ملء الشاشة',
    zoom: 'تكبير',
    bounce: 'قفز',
    fade: 'تلاشي',
    'slide-up': 'انزلاق من الأسفل',
    'slide-down': 'انزلاق من الأعلى',
    none: 'بدون تأثير',
    noClips: 'هذه القناة ليس لديها مقاطع في هذه الفترة. جرّب فترة أطول.',
    noChannel: 'اكتب اسم قناة للتجربة.',
    notConnected: 'اربط حسابك مع تويتش أولاً (الإعدادات > تويتش).',
  },
} as const;

const POSITIONS: OverlayPosition[] = ['center', 'top-center', 'bottom-center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'fullscreen'];
const ANIMATIONS: OverlayAnimation[] = ['zoom', 'bounce', 'fade', 'slide-up', 'slide-down', 'none'];

const selectClass =
  'h-9 rounded-md border border-white/15 bg-[#11131a] px-3 font-sans text-[12.5px] text-foreground focus:border-accent focus:outline-none';
const chipClass =
  'rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-accent-text hover:border-accent hover:bg-accent/10 transition-colors';
const labelClass = 'font-sans text-[12px] font-medium text-zinc-300';
const boxClass = 'flex flex-col gap-2 rounded-md border border-white/[0.08] bg-[#11131a] p-3';

interface ClipStepEditorProps {
  lang: 'en' | 'ar';
  value: ClipSettings;
  onChange: (patch: Partial<ClipSettings>) => void;
}

export function ClipStepEditor({ lang, value, onChange }: ClipStepEditorProps) {
  const tx = TEXT[lang];
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const [testChannel, setTestChannel] = useState((twitchChannel ?? '').replace(/^#+/, ''));
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const addToken = (field: 'channel' | 'caption', token: string) =>
    onChange({ [field]: `${value[field]}${value[field] && !value[field].endsWith(' ') ? ' ' : ''}${token}` });

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(OVERLAY_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  const runTest = async () => {
    const channel = testChannel.trim().replace(/^[@#]+/, '');
    if (!channel) {
      setTestMessage({ ok: false, text: tx.noChannel });
      return;
    }
    setTesting(true);
    setTestMessage(null);
    try {
      const res = await rpc.invoke(Channels.ChatOverlayShowClip, {
        channel,
        selection: value.selection,
        period: value.period,
        maxSeconds: value.maxSeconds,
        useClipLength: value.useClipLength,
        volume: value.volume,
        position: value.position,
        animation: value.animation,
        size: value.size,
        showCaption: value.showCaption,
        caption: value.caption.trim(),
      });
      if (res?.ok) {
        setTestMessage({ ok: true, text: `${tx.playing}: ${res.title ?? ''} (${Math.round(res.durationSeconds)}s)` });
      } else if (res?.error === 'NO_CLIPS') {
        setTestMessage({ ok: false, text: tx.noClips });
      } else if (res?.error?.startsWith('TWITCH IS NOT CONNECTED')) {
        setTestMessage({ ok: false, text: tx.notConnected });
      } else {
        setTestMessage({ ok: false, text: res?.error ?? 'Failed' });
      }
    } catch (err) {
      setTestMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setTesting(false);
    }
  };

  const stopTest = async () => {
    try {
      await rpc.invoke(Channels.ChatOverlayHideImage, undefined);
    } catch { }
    setTestMessage(null);
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Where the clip comes from */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>{tx.channel}</label>
        <Input
          value={value.channel}
          onChange={(e) => onChange({ channel: e.target.value })}
          placeholder="{target}"
          className="h-9 font-mono text-[12.5px]"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10.5px] text-muted">{tx.tokens}:</span>
          {['{target}', '{raider}', '{input}', '{username}'].map((tok) => (
            <button key={tok} type="button" onClick={() => addToken('channel', tok)} className={chipClass}>
              {tok}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted">{tx.channelHint}</p>
      </div>

      {/* Which clip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>{tx.selection}</label>
          <SegmentedControl<ClipSelection>
            value={value.selection}
            onChange={(selection) => onChange({ selection })}
            options={[
              { value: 'top', label: tx.top },
              { value: 'random', label: tx.random },
              { value: 'recent', label: tx.recent },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>{tx.period}</label>
          <SegmentedControl<ClipPeriod>
            value={value.period}
            onChange={(period) => onChange({ period })}
            options={[
              { value: 'week', label: tx.week },
              { value: 'month', label: tx.month },
              { value: 'year', label: tx.year },
              { value: 'all', label: tx.all },
            ]}
          />
        </div>
      </div>

      {/* How it looks */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>{tx.position}</label>
          <select
            value={value.position}
            onChange={(e) => onChange({ position: e.target.value as OverlayPosition })}
            className={selectClass}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>{tx[p]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>{tx.animation}</label>
          <select
            value={value.animation}
            onChange={(e) => onChange({ animation: e.target.value as OverlayAnimation })}
            className={selectClass}
          >
            {ANIMATIONS.map((a) => (
              <option key={a} value={a}>{tx[a]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-[#11131a] p-3">
        <span className={labelClass}>{tx.useClipLength}</span>
        <Switch checked={value.useClipLength} onChange={(useClipLength) => onChange({ useClipLength })} label={tx.useClipLength} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={boxClass}>
          <div className="flex items-center justify-between">
            <span className={labelClass}>{tx.maxSeconds}</span>
            <span className="font-mono text-[11px] text-zinc-400">{value.useClipLength ? '—' : `${value.maxSeconds}s`}</span>
          </div>
          <Slider
            value={value.maxSeconds}
            min={5}
            max={120}
            step={5}
            onChange={(maxSeconds) => onChange({ maxSeconds })}
            ariaLabel={tx.maxSeconds}
            disabled={value.useClipLength}
          />
        </div>
        <div className={boxClass}>
          <div className="flex items-center justify-between">
            <span className={labelClass}>{tx.volume}</span>
            <span className="font-mono text-[11px] text-zinc-400">{Math.round(value.volume * 100)}%</span>
          </div>
          <Slider
            value={Math.round(value.volume * 100)}
            min={0}
            max={100}
            step={5}
            onChange={(v) => onChange({ volume: v / 100 })}
            ariaLabel={tx.volume}
          />
        </div>
        <div className={boxClass}>
          <div className="flex items-center justify-between">
            <span className={labelClass}>{tx.size}</span>
            <span className="font-mono text-[11px] text-zinc-400">{value.size}%</span>
          </div>
          <Slider
            value={value.size}
            min={20}
            max={100}
            step={5}
            onChange={(size) => onChange({ size })}
            ariaLabel={tx.size}
            disabled={value.position === 'fullscreen'}
          />
        </div>
      </div>

      {/* Caption */}
      <div className={boxClass}>
        <div className="flex items-center justify-between gap-3">
          <span className={labelClass}>{tx.caption}</span>
          <Switch checked={value.showCaption} onChange={(showCaption) => onChange({ showCaption })} label={tx.caption} />
        </div>
        {value.showCaption && (
          <>
            <Input
              value={value.caption}
              onChange={(e) => onChange({ caption: e.target.value })}
              placeholder={CLIP_DEFAULT_CAPTION}
              aria-label={tx.captionText}
              className="h-9 text-[12.5px]"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {['{channel}', '{clip_title}', '{clip_creator}'].map((tok) => (
                <button key={tok} type="button" onClick={() => addToken('caption', tok)} className={chipClass}>
                  {tok}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted">{tx.captionTokens}</p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-[#11131a] p-3">
        <span className={labelClass}>{tx.waitForEnd}</span>
        <Switch checked={value.waitForEnd} onChange={(waitForEnd) => onChange({ waitForEnd })} label={tx.waitForEnd} />
      </div>

      {/* OBS browser source */}
      <div className="flex flex-col gap-2 rounded-md border border-purple-500/30 bg-purple-500/10 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-purple-200">
            <Radio size={14} className="text-purple-400" />
            <span>{tx.source}</span>
          </div>
          <span className="text-[10px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
            1920 × 1080 px
          </span>
        </div>
        <p className="text-[11px] text-purple-200/90 leading-relaxed">{tx.sourceHint}</p>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            readOnly
            value={OVERLAY_URL}
            className="h-8 flex-1 rounded border border-purple-500/30 bg-black/40 px-2.5 font-mono text-[11.5px] text-purple-100 select-all focus:border-purple-400 focus:outline-none"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void copyUrl()}
            className="h-8 gap-1.5 px-3 bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] shrink-0 border-none cursor-pointer"
          >
            {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
            <span>{copied ? tx.copied : tx.copy}</span>
          </Button>
          <a
            href={OVERLAY_URL}
            target="_blank"
            rel="noreferrer"
            className="grid size-8 place-items-center rounded border border-purple-500/30 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25 hover:text-white transition-colors shrink-0"
            title={tx.open}
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Test */}
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label className={labelClass}>{tx.testChannel}</label>
            <Input
              value={testChannel}
              onChange={(e) => setTestChannel(e.target.value)}
              placeholder="channelname"
              className="h-9 font-mono text-[12.5px]"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void runTest()}
            disabled={testing}
            className="h-9 gap-1.5 text-pink-400 hover:text-pink-300 border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20"
          >
            <Clapperboard size={13} className={testing ? 'animate-pulse' : ''} />
            <span>{tx.test}</span>
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void stopTest()} className="h-9 gap-1.5">
            <Square size={12} />
            <span>{tx.stop}</span>
          </Button>
        </div>
        {testMessage && (
          <p className={`text-[11.5px] ${testMessage.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{testMessage.text}</p>
        )}
      </div>
    </div>
  );
}
