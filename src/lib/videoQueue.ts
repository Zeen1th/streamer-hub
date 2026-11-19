import type { CommandSequence, OverlayPosition, SequenceStep } from '../rpc/contracts';
import { DEFAULT_CLIP_SKIP_WHO, type ClipSkipWho } from './clipSkip.ts';

/*
 * Viewer video requests (YouTube). Pure queue logic, kept free of the app so it can be tested:
 * - "waiting" holds requests that wait for the streamer (or a mod) to approve them,
 * - "queue" holds approved requests in play order,
 * - one video plays at a time; when it ends the next one starts.
 */

export type VideoApproval = 'manual' | 'auto';
export type VideoLengthMode = 'full' | 'limit';
export type VideoMessageKind = 'queued' | 'waiting' | 'invalid' | 'approved' | 'denied';

export const DEFAULT_VIDEO_INPUT = '{input}';
export const DEFAULT_VIDEO_APPROVAL: VideoApproval = 'manual';
export const DEFAULT_VIDEO_LENGTH_MODE: VideoLengthMode = 'limit';
export const DEFAULT_VIDEO_MAX_SECONDS = 60;
export const MIN_VIDEO_MAX_SECONDS = 10;
export const MAX_VIDEO_MAX_SECONDS = 600;
export const DEFAULT_VIDEO_VOLUME = 0.8;
export const DEFAULT_VIDEO_SIZE = 50;
export const DEFAULT_VIDEO_POSITION: OverlayPosition = 'center';
export const DEFAULT_VIDEO_SKIP_COMMAND = '!skip';
export const DEFAULT_VIDEO_APPROVE_COMMAND = '!approve';
export const DEFAULT_VIDEO_DENY_COMMAND = '!deny';
/** Extra time a video may run past its cut-off before the app stops waiting for the overlay and moves on. */
export const VIDEO_SAFETY_MARGIN_MS = 15_000;
/** A "play the whole video" request with no answer from the overlay is given up on after this long. */
export const VIDEO_FULL_LENGTH_SAFETY_MS = 2 * 60 * 60 * 1000;

/** The chat messages a Video request step posts. Tokens: {username} {title} {position}. Empty = post nothing. */
export const DEFAULT_VIDEO_MESSAGES: Record<'en' | 'ar', Record<VideoMessageKind, string>> = {
  en: {
    queued: '@{username} your video "{title}" is #{position} in line.',
    waiting: '@{username} got it! "{title}" is waiting for approval.',
    invalid: '@{username} that is not a YouTube link. Use: !request https://youtu.be/...',
    approved: '@{username} your video "{title}" was approved and is #{position} in line.',
    denied: '@{username} sorry, your video "{title}" was not approved.',
  },
  ar: {
    queued: '@{username} فيديوك "{title}" رقم {position} في الدور.',
    waiting: '@{username} وصل طلبك! "{title}" ينتظر الموافقة.',
    invalid: '@{username} هذا ليس رابط يوتيوب. اكتب: !request https://youtu.be/...',
    approved: '@{username} تمت الموافقة على فيديوك "{title}" وهو رقم {position} في الدور.',
    denied: '@{username} للأسف لم تتم الموافقة على فيديوك "{title}".',
  },
};

const MESSAGE_FIELD: Record<VideoMessageKind, keyof SequenceStep> = {
  queued: 'videoQueuedMessage',
  waiting: 'videoWaitingMessage',
  invalid: 'videoInvalidMessage',
  approved: 'videoApprovedMessage',
  denied: 'videoDeniedMessage',
};

/** The step's own text for this message, or the default in the app language when the step never set one. */
export function videoMessageTemplate(step: SequenceStep, kind: VideoMessageKind, lang: 'en' | 'ar' = 'en'): string {
  const own = step[MESSAGE_FIELD[kind]];
  return typeof own === 'string' ? own : DEFAULT_VIDEO_MESSAGES[lang][kind];
}

/** Fills {username} {title} {position}. */
export function fillVideoMessage(template: string, values: { username: string; title: string; position?: number }): string {
  return template
    .replace(/\{username\}/gi, values.username)
    .replace(/\{title\}/gi, values.title)
    .replace(/\{position\}/gi, values.position != null ? String(values.position) : '');
}

export interface VideoRequestSettings {
  input: string;
  approval: VideoApproval;
  lengthMode: VideoLengthMode;
  maxSeconds: number;
  volume: number;
  position: OverlayPosition;
  size: number;
  skipCommand: string;
  skipWho: ClipSkipWho;
  approveCommand: string;
  denyCommand: string;
}

export function clampVideoMaxSeconds(value: number | undefined): number {
  const n = Number.isFinite(value) ? Math.round(value as number) : DEFAULT_VIDEO_MAX_SECONDS;
  return Math.min(MAX_VIDEO_MAX_SECONDS, Math.max(MIN_VIDEO_MAX_SECONDS, n));
}

/** Every Video request option with its default filled in. */
export function videoRequestSettings(step: SequenceStep): VideoRequestSettings {
  return {
    input: step.videoInput ?? DEFAULT_VIDEO_INPUT,
    approval: step.videoApproval ?? DEFAULT_VIDEO_APPROVAL,
    lengthMode: step.videoLengthMode ?? DEFAULT_VIDEO_LENGTH_MODE,
    maxSeconds: clampVideoMaxSeconds(step.videoMaxSeconds),
    volume: Math.min(1, Math.max(0, step.videoVolume ?? DEFAULT_VIDEO_VOLUME)),
    position: step.videoPosition ?? DEFAULT_VIDEO_POSITION,
    size: Math.min(100, Math.max(10, step.videoSize ?? DEFAULT_VIDEO_SIZE)),
    skipCommand: step.videoSkipCommand?.trim() || DEFAULT_VIDEO_SKIP_COMMAND,
    skipWho: step.videoSkipWho ?? DEFAULT_CLIP_SKIP_WHO,
    approveCommand: step.videoApproveCommand?.trim() || DEFAULT_VIDEO_APPROVE_COMMAND,
    denyCommand: step.videoDenyCommand?.trim() || DEFAULT_VIDEO_DENY_COMMAND,
  };
}

export interface VideoRequest {
  id: string;
  videoId: string;
  startSeconds: number;
  title: string;
  /** Display name of the viewer who asked. */
  requestedBy: string;
  requesterLogin: string;
  /** Where the play stops, in seconds of playing time. 0 = the whole video. */
  maxSeconds: number;
  volume: number;
  position: OverlayPosition;
  size: number;
  requestedAt: number;
  /** Who may skip it from chat (from the step that took the request). */
  skipWho: ClipSkipWho;
  /** Chat messages for later (approval / denial), already in the right language. Empty = post nothing. */
  approvedMessage: string;
  deniedMessage: string;
}

export interface PlayingVideo extends VideoRequest {
  startedAt: number;
}

export interface VideoQueueState {
  waiting: VideoRequest[];
  queue: VideoRequest[];
  playing: PlayingVideo | null;
}

export const EMPTY_VIDEO_QUEUE: VideoQueueState = { waiting: [], queue: [], playing: null };

/** Place in line counting the video on screen: 1 = plays next (or right now when nothing is playing). */
function lineNumber(state: VideoQueueState, queueIndex: number): number {
  return queueIndex + 1 + (state.playing ? 1 : 0);
}

/**
 * Adds in the order viewers asked: a request whose title lookup came back late still goes before the ones asked
 * after it. Returns the new list and where the request landed.
 */
function insertByTime(list: VideoRequest[], request: VideoRequest): { list: VideoRequest[]; index: number } {
  let index = list.length;
  while (index > 0 && list[index - 1].requestedAt > request.requestedAt) index--;
  return { list: [...list.slice(0, index), request, ...list.slice(index)], index };
}

/** Takes a new request: it waits for approval (manual) or goes straight into the play queue (auto). */
export function addVideoRequest(
  state: VideoQueueState,
  request: VideoRequest,
  approval: VideoApproval,
): { state: VideoQueueState; status: 'waiting' | 'queued'; position: number } {
  if (approval === 'auto') {
    const { list, index } = insertByTime(state.queue, request);
    const next = { ...state, queue: list };
    return { state: next, status: 'queued', position: lineNumber(next, index) };
  }
  const { list, index } = insertByTime(state.waiting, request);
  return { state: { ...state, waiting: list }, status: 'waiting', position: index + 1 };
}

function pickWaiting(state: VideoQueueState, which: { nth?: number; id?: string }): number {
  if (which.id) return state.waiting.findIndex((r) => r.id === which.id);
  const nth = Math.floor(which.nth ?? 1);
  return nth >= 1 && nth <= state.waiting.length ? nth - 1 : -1;
}

/** Approves the nth waiting request (1 = the oldest), or the one with this id. */
export function approveVideoRequest(
  state: VideoQueueState,
  which: { nth?: number; id?: string } = {},
): { state: VideoQueueState; request: VideoRequest | null; position: number } {
  const index = pickWaiting(state, which);
  if (index < 0) return { state, request: null, position: 0 };
  const request = state.waiting[index];
  const next = {
    ...state,
    waiting: state.waiting.filter((_, i) => i !== index),
    queue: [...state.queue, request],
  };
  return { state: next, request, position: lineNumber(next, next.queue.length - 1) };
}

/** Denies the nth waiting request (1 = the oldest), or the one with this id. */
export function denyVideoRequest(
  state: VideoQueueState,
  which: { nth?: number; id?: string } = {},
): { state: VideoQueueState; request: VideoRequest | null } {
  const index = pickWaiting(state, which);
  if (index < 0) return { state, request: null };
  const request = state.waiting[index];
  return { state: { ...state, waiting: state.waiting.filter((_, i) => i !== index) }, request };
}

/** Takes an approved request out of the play queue before it plays. */
export function removeQueuedVideo(state: VideoQueueState, id: string): { state: VideoQueueState; request: VideoRequest | null } {
  const request = state.queue.find((r) => r.id === id) ?? null;
  if (!request) return { state, request: null };
  return { state: { ...state, queue: state.queue.filter((r) => r.id !== id) }, request };
}

/** Starts the next video when nothing is playing. `started` is null when nothing changed. */
export function startNextVideo(state: VideoQueueState, now: number): { state: VideoQueueState; started: PlayingVideo | null } {
  if (state.playing || state.queue.length === 0) return { state, started: null };
  const [first, ...rest] = state.queue;
  const started: PlayingVideo = { ...first, startedAt: now };
  return { state: { ...state, queue: rest, playing: started }, started };
}

/** The overlay says this video ended. Ignored unless it is the one playing (a late or duplicate message). */
export function finishVideo(state: VideoQueueState, requestId: string): { state: VideoQueueState; finished: PlayingVideo | null } {
  if (!state.playing || state.playing.id !== requestId) return { state, finished: null };
  return { state: { ...state, playing: null }, finished: state.playing };
}

/** Stops the video on screen. */
export function skipVideo(state: VideoQueueState): { state: VideoQueueState; skipped: PlayingVideo | null } {
  if (!state.playing) return { state, skipped: null };
  return { state: { ...state, playing: null }, skipped: state.playing };
}

/** When the app stops waiting for the overlay's "ended" message and moves on. */
export function videoSafetyDeadline(playing: PlayingVideo): number {
  const allowed = playing.maxSeconds > 0 ? playing.maxSeconds * 1000 + VIDEO_SAFETY_MARGIN_MS : VIDEO_FULL_LENGTH_SAFETY_MS;
  return playing.startedAt + allowed;
}

/** True when the playing video is past its safety deadline (no ended message came). */
export function isVideoOverdue(state: VideoQueueState, now: number): boolean {
  return Boolean(state.playing) && now >= videoSafetyDeadline(state.playing!);
}

// ---------------------------------------------------------------------------------------------------------------
// Chat commands: skip (who the step allows), approve / deny (mods and the streamer)
// ---------------------------------------------------------------------------------------------------------------

export interface VideoCommandMatch {
  action: 'skip' | 'approve' | 'deny';
  /** Which waiting request: 1 = the oldest ("!approve 2" = the second). */
  nth: number;
  settings: VideoRequestSettings;
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function* walkSteps(steps: SequenceStep[]): Generator<SequenceStep> {
  for (const step of steps) {
    yield step;
    if (step.ifThen) yield* walkSteps(step.ifThen);
    if (step.ifElse) yield* walkSteps(step.ifElse);
  }
}

/** True when some enabled sequence has a Video request step (so its commands are live). */
export function videoRequestSteps(sequences: CommandSequence[]): SequenceStep[] {
  const found: SequenceStep[] = [];
  for (const seq of sequences) {
    if (!seq.enabled) continue;
    for (const step of walkSteps(seq.steps ?? [])) if (step.type === 'video_request') found.push(step);
  }
  return found;
}

/** The skip / approve / deny command this chat line is, from any enabled sequence's Video request step. */
export function matchVideoCommand(sequences: CommandSequence[], message: string): VideoCommandMatch | null {
  const said = normalize(message);
  if (!said) return null;
  for (const step of videoRequestSteps(sequences)) {
    const settings = videoRequestSettings(step);
    if (settings.skipWho !== 'off' && normalize(settings.skipCommand) === said) {
      return { action: 'skip', nth: 1, settings };
    }
    for (const action of ['approve', 'deny'] as const) {
      const command = normalize(action === 'approve' ? settings.approveCommand : settings.denyCommand);
      if (said === command) return { action, nth: 1, settings };
      if (said.startsWith(`${command} `)) {
        const rest = said.slice(command.length + 1).replace(/^#/, '');
        if (/^\d{1,3}$/.test(rest)) return { action, nth: Number(rest), settings };
      }
    }
  }
  return null;
}
