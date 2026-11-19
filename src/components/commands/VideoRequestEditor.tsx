import { useState } from 'react';
import { Check, Copy, ExternalLink, MonitorPlay, Radio, Square, TriangleAlert } from 'lucide-react';
import type { OverlayPosition, SequenceStep } from '../../rpc/contracts';
import { t } from '../../i18n/translations';
import { parseYouTubeLink } from '../../lib/youtubeLink';
import type { ClipSkipWho } from '../../lib/clipSkip';
import {
  DEFAULT_VIDEO_APPROVE_COMMAND,
  DEFAULT_VIDEO_DENY_COMMAND,
  DEFAULT_VIDEO_INPUT,
  DEFAULT_VIDEO_SKIP_COMMAND,
  MAX_VIDEO_MAX_SECONDS,
  MIN_VIDEO_MAX_SECONDS,
  videoMessageTemplate,
  videoRequestSettings,
  type VideoApproval,
  type VideoLengthMode,
  type VideoMessageKind,
} from '../../lib/videoQueue';
import { useVideoRequestStore } from '../../store/videoRequestStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';

/** Everything the "Video request" sub-action lets the streamer set. */
export interface VideoRequestEditorValue {
  input: string;
  approval: VideoApproval;
  lengthMode: VideoLengthMode;
  maxSeconds: number;
  volume: number;
  position: OverlayPosition;
  size: number;
  messages: Record<VideoMessageKind, string>;
  skipCommand: string;
  skipWho: ClipSkipWho;
  approveCommand: string;
  denyCommand: string;
}

const MESSAGE_KINDS: VideoMessageKind[] = ['queued', 'waiting', 'approved', 'denied', 'invalid'];
/** Messages that only exist when requests wait for approval. */
const APPROVAL_ONLY: VideoMessageKind[] = ['waiting', 'approved', 'denied'];
const SKIP_WHO: ClipSkipWho[] = ['requester_mods', 'mods', 'everyone', 'off'];
const POSITIONS: OverlayPosition[] = ['center', 'top-center', 'bottom-center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'fullscreen'];
const OVERLAY_URL = 'http://127.0.0.1:49178/image-overlay.html';

export function videoRequestEditorValue(step: SequenceStep, lang: 'en' | 'ar'): VideoRequestEditorValue {
  const s = videoRequestSettings(step);
  return {
    input: s.input,
    approval: s.approval,
    lengthMode: s.lengthMode,
    maxSeconds: s.maxSeconds,
    volume: s.volume,
    position: s.position,
    size: s.size,
    messages: Object.fromEntries(MESSAGE_KINDS.map((kind) => [kind, videoMessageTemplate(step, kind, lang)])) as Record<VideoMessageKind, string>,
    skipCommand: s.skipCommand,
    skipWho: s.skipWho,
    approveCommand: s.approveCommand,
    denyCommand: s.denyCommand,
  };
}

export function videoRequestEditorToStep(value: VideoRequestEditorValue): Partial<SequenceStep> {
  return {
    videoInput: value.input.trim() || DEFAULT_VIDEO_INPUT,
    videoApproval: value.approval,
    videoLengthMode: value.lengthMode,
    videoMaxSeconds: value.maxSeconds,
    videoVolume: value.volume,
    videoPosition: value.position,
    videoSize: value.size,
    // empty = post nothing
    videoQueuedMessage: value.messages.queued.trim(),
    videoWaitingMessage: value.messages.waiting.trim(),
    videoApprovedMessage: value.messages.approved.trim(),
    videoDeniedMessage: value.messages.denied.trim(),
    videoInvalidMessage: value.messages.invalid.trim(),
    videoSkipCommand: value.skipCommand.trim() || DEFAULT_VIDEO_SKIP_COMMAND,
    videoSkipWho: value.skipWho,
    videoApproveCommand: value.approveCommand.trim() || DEFAULT_VIDEO_APPROVE_COMMAND,
    videoDenyCommand: value.denyCommand.trim() || DEFAULT_VIDEO_DENY_COMMAND,
  };
}

/** 90 -> "1:30". */
export function formatVideoSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

const selectClass =
  'h-9 rounded-md border border-white/15 bg-[#11131a] px-3 font-sans text-[12.5px] text-foreground focus:border-accent focus:outline-none';
const chipClass =
  'rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-accent-text hover:border-accent hover:bg-accent/10 transition-colors';
const labelClass = 'font-sans text-[12px] font-medium text-zinc-300';
const boxClass = 'flex flex-col gap-2 rounded-md border border-white/[0.08] bg-[#11131a] p-3';

interface VideoRequestEditorProps {
  lang: 'en' | 'ar';
  value: VideoRequestEditorValue;
  onChange: (patch: Partial<VideoRequestEditorValue>) => void;
}

export function VideoRequestEditor({ lang, value, onChange }: VideoRequestEditorProps) {
  const tx = (key: string, params?: Record<string, string | number>) => t(lang, `video.${key}`, params);
  const [copied, setCopied] = useState(false);
  const [testLink, setTestLink] = useState('');
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const playing = useVideoRequestStore((s) => s.playing);
  const manual = value.approval === 'manual';

  const setMessage = (kind: VideoMessageKind, text: string) => onChange({ messages: { ...value.messages, [kind]: text } });

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(OVERLAY_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  // A test goes through the real queue (without approval), so it also shows up in the Home panel.
  const runTest = async () => {
    const link = parseYouTubeLink(testLink);
    if (!link) {
      setTestMessage({ ok: false, text: tx('testInvalid') });
      return;
    }
    const step = { id: 'video-test', type: 'video_request' as const, ...videoRequestEditorToStep(value), videoApproval: 'auto' as const };
    const res = await useVideoRequestStore.getState().addFromStep(step, { username: 'Test', userLogin: 'test', source: 'test' }, link);
    setTestMessage({ ok: res.ok, text: res.ok ? tx('testQueued', { title: res.title ?? link.videoId, n: res.position ?? 1 }) : res.error ?? '?' });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-md border border-red-500/25 bg-red-500/[0.08] p-3 text-[11.5px] leading-relaxed text-zinc-200">
        <p>{tx('about')}</p>
        <p className="mt-1.5 font-mono text-[11px] text-red-200/90" dir="ltr">!request https://youtu.be/dQw4w9WgXcQ</p>
      </div>

      {/* Where the link comes from */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="video-input">{tx('input')}</label>
        <Input
          id="video-input"
          value={value.input}
          onChange={(e) => onChange({ input: e.target.value })}
          placeholder={DEFAULT_VIDEO_INPUT}
          dir="ltr"
          className="h-9 font-mono text-[12.5px]"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {['{input}', '{target}'].map((tok) => (
            <button key={tok} type="button" onClick={() => onChange({ input: tok })} className={chipClass}>
              {tok}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted">{tx('inputHint')}</p>
      </div>

      {/* Approval */}
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>{tx('approval')}</span>
        <SegmentedControl<VideoApproval>
          value={value.approval}
          onChange={(approval) => onChange({ approval })}
          options={[
            { value: 'manual', label: tx('approvalManual') },
            { value: 'auto', label: tx('approvalAuto') },
          ]}
        />
        {manual ? (
          <p className="text-[11px] text-muted">{tx('approvalManualHint')}</p>
        ) : (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11.5px] text-amber-200">
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
            <span className="leading-relaxed">{tx('autoWarning')}</span>
          </div>
        )}
      </div>

      {/* Length */}
      <div className={boxClass}>
        <span className={labelClass}>{tx('length')}</span>
        <SegmentedControl<VideoLengthMode>
          value={value.lengthMode}
          onChange={(lengthMode) => onChange({ lengthMode })}
          options={[
            { value: 'limit', label: tx('lengthLimit') },
            { value: 'full', label: tx('lengthFull') },
          ]}
        />
        {value.lengthMode === 'limit' ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">{tx('maxSeconds')}</span>
              <span className="font-mono text-[11px] text-zinc-400" dir="ltr">{formatVideoSeconds(value.maxSeconds)}</span>
            </div>
            <Slider
              value={value.maxSeconds}
              min={MIN_VIDEO_MAX_SECONDS}
              max={MAX_VIDEO_MAX_SECONDS}
              step={10}
              onChange={(maxSeconds) => onChange({ maxSeconds })}
              ariaLabel={tx('maxSeconds')}
            />
          </>
        ) : (
          <p className="text-[11px] text-amber-200/90">{tx('lengthFullHint')}</p>
        )}
      </div>

      {/* How it looks */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="video-position">{tx('position')}</label>
          <select
            id="video-position"
            value={value.position}
            onChange={(e) => onChange({ position: e.target.value as OverlayPosition })}
            className={selectClass}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>{tx(`pos.${p}`)}</option>
            ))}
          </select>
        </div>
        <div className={boxClass}>
          <div className="flex items-center justify-between">
            <span className={labelClass}>{tx('volume')}</span>
            <span className="font-mono text-[11px] text-zinc-400" dir="ltr">{Math.round(value.volume * 100)}%</span>
          </div>
          <Slider value={Math.round(value.volume * 100)} min={0} max={100} step={5} onChange={(v) => onChange({ volume: v / 100 })} ariaLabel={tx('volume')} />
        </div>
        <div className={boxClass}>
          <div className="flex items-center justify-between">
            <span className={labelClass}>{tx('size')}</span>
            <span className="font-mono text-[11px] text-zinc-400" dir="ltr">{value.size}%</span>
          </div>
          <Slider
            value={value.size}
            min={20}
            max={100}
            step={5}
            onChange={(size) => onChange({ size })}
            ariaLabel={tx('size')}
            disabled={value.position === 'fullscreen'}
          />
        </div>
      </div>

      {/* Chat commands */}
      <div className={boxClass}>
        <span className={labelClass}>{tx('commands')}</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted" htmlFor="video-skip-who">{tx('skipWho')}</label>
            <select
              id="video-skip-who"
              value={value.skipWho}
              onChange={(e) => onChange({ skipWho: e.target.value as ClipSkipWho })}
              className={selectClass}
            >
              {SKIP_WHO.map((w) => (
                <option key={w} value={w}>{tx(`who.${w}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted" htmlFor="video-skip-command">{tx('skipCommand')}</label>
            <Input
              id="video-skip-command"
              value={value.skipCommand}
              onChange={(e) => onChange({ skipCommand: e.target.value })}
              placeholder={DEFAULT_VIDEO_SKIP_COMMAND}
              disabled={value.skipWho === 'off'}
              dir="ltr"
              className="h-9 font-mono text-[12.5px]"
            />
          </div>
          {manual && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted" htmlFor="video-approve-command">{tx('approveCommand')}</label>
                <Input
                  id="video-approve-command"
                  value={value.approveCommand}
                  onChange={(e) => onChange({ approveCommand: e.target.value })}
                  placeholder={DEFAULT_VIDEO_APPROVE_COMMAND}
                  dir="ltr"
                  className="h-9 font-mono text-[12.5px]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted" htmlFor="video-deny-command">{tx('denyCommand')}</label>
                <Input
                  id="video-deny-command"
                  value={value.denyCommand}
                  onChange={(e) => onChange({ denyCommand: e.target.value })}
                  placeholder={DEFAULT_VIDEO_DENY_COMMAND}
                  dir="ltr"
                  className="h-9 font-mono text-[12.5px]"
                />
              </div>
            </>
          )}
        </div>
        <p className="text-[11px] text-muted">{manual ? tx('commandsHint') : tx('skipHint')}</p>
      </div>

      {/* Chat messages */}
      <div className={boxClass}>
        <span className={labelClass}>{tx('messages')}</span>
        {MESSAGE_KINDS.filter((kind) => manual || !APPROVAL_ONLY.includes(kind)).map((kind) => (
          <div key={kind} className="flex flex-col gap-1">
            <label className="text-[11px] text-muted" htmlFor={`video-msg-${kind}`}>{tx(`msg.${kind}`)}</label>
            <Input
              id={`video-msg-${kind}`}
              value={value.messages[kind]}
              onChange={(e) => setMessage(kind, e.target.value)}
              placeholder={tx('msgEmpty')}
              dir="auto"
              className="h-9 text-[12.5px]"
            />
          </div>
        ))}
        <p className="text-[11px] text-muted">{tx('messagesHint')}</p>
      </div>

      {/* OBS browser source */}
      <div className="flex flex-col gap-2 rounded-md border border-purple-500/30 bg-purple-500/10 p-3">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-purple-200">
          <Radio size={14} className="text-purple-400" aria-hidden />
          <span>{tx('source')}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-purple-200/90">{tx('sourceHint')}</p>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            readOnly
            value={OVERLAY_URL}
            dir="ltr"
            aria-label={tx('source')}
            className="h-8 flex-1 rounded border border-purple-500/30 bg-black/40 px-2.5 font-mono text-[11.5px] text-purple-100 select-all focus:border-purple-400 focus:outline-none"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void copyUrl()}
            className="h-8 shrink-0 cursor-pointer gap-1.5 border-none bg-purple-600 px-3 text-[11px] font-medium text-white hover:bg-purple-500"
          >
            {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
            <span>{copied ? t(lang, 'votes.copied') : t(lang, 'chat.copyUrl')}</span>
          </Button>
          <a
            href={OVERLAY_URL}
            target="_blank"
            rel="noreferrer"
            className="grid size-8 shrink-0 place-items-center rounded border border-purple-500/30 bg-purple-500/15 text-purple-200 transition-colors hover:bg-purple-500/25 hover:text-white"
            title={t(lang, 'chat.openBrowser')}
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Test */}
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label className={labelClass} htmlFor="video-test-link">{tx('testLink')}</label>
            <Input
              id="video-test-link"
              value={testLink}
              onChange={(e) => setTestLink(e.target.value)}
              placeholder="https://youtu.be/..."
              dir="ltr"
              className="h-9 font-mono text-[12.5px]"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void runTest()}
            className="h-9 gap-1.5 border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
          >
            <MonitorPlay size={13} />
            <span>{tx('test')}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!playing}
            onClick={() => void useVideoRequestStore.getState().skip(lang === 'ar' ? 'الستريمر' : 'Streamer')}
            className="h-9 gap-1.5"
          >
            <Square size={12} />
            <span>{tx('stop')}</span>
          </Button>
        </div>
        {testMessage && (
          <p className={`text-[11.5px] ${testMessage.ok ? 'text-emerald-300' : 'text-amber-300'}`} dir="auto">{testMessage.text}</p>
        )}
      </div>
    </div>
  );
}
