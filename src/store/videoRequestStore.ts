import { create } from 'zustand';
import type { SequenceStep, VideoEndReason } from '../rpc/contracts';
import { Channels } from '../rpc/contracts';
import { rpc } from '../rpc';
import { useLogStore } from './logStore';
import { useSettingsStore } from './settingsStore';
import type { SequenceExecutionContext } from '../lib/sequenceRunner';
import type { YouTubeLink } from '../lib/youtubeLink';
import {
  EMPTY_VIDEO_QUEUE,
  addVideoRequest,
  approveVideoRequest,
  denyVideoRequest,
  fillVideoMessage,
  finishVideo,
  isVideoOverdue,
  removeQueuedVideo,
  skipVideo,
  startNextVideo,
  videoMessageTemplate,
  videoRequestSettings,
  videoSafetyDeadline,
  type PlayingVideo,
  type VideoQueueState,
  type VideoRequest,
} from '../lib/videoQueue';

/*
 * Viewer video requests: who is waiting for approval, what plays next, and what is on screen now.
 * The queue rules live in lib/videoQueue (tested); this store talks to chat, the log and the image browser source.
 */

interface VideoRequestState extends VideoQueueState {
  /** The image browser source was not connected when a video should have started; the queue waits for it. */
  overlayMissing: boolean;

  /** A Video request step took a valid link. */
  addFromStep(
    step: SequenceStep,
    ctx: SequenceExecutionContext,
    link: YouTubeLink,
  ): Promise<{ ok: boolean; status?: 'waiting' | 'queued'; position?: number; title?: string; error?: string }>;
  approve(which: { nth?: number; id?: string }, by: string): Promise<VideoRequest | null>;
  deny(which: { nth?: number; id?: string }, by: string): Promise<VideoRequest | null>;
  /** Takes an approved video out of the queue before it plays. */
  remove(id: string, by: string): void;
  /** Stops the video on screen and plays the next one. */
  skip(by: string): Promise<PlayingVideo | null>;
  /** The overlay says the video is over. */
  handleEnded(requestId: string, reason: VideoEndReason | string): void;
  /** Starts the next video when nothing is playing. */
  playNext(): Promise<void>;
}

let safetyTimer: ReturnType<typeof setTimeout> | undefined;

const log = (kind: 'trigger' | 'system' | 'obs-ok' | 'obs-error', message: string) =>
  useLogStore.getState().addLocal({ kind, message: `[Video requests] ${message}` });

const appLanguage = (): 'en' | 'ar' => (useSettingsStore.getState().language === 'ar' ? 'ar' : 'en');

async function sendChat(text: string): Promise<void> {
  if (!text.trim()) return;
  try {
    await rpc.invoke(Channels.TwitchSendChatMessage, { message: text });
  } catch {
    // chat being down never blocks the queue
  }
}

async function lookupTitle(videoId: string): Promise<string> {
  try {
    // Short: the chat reply waits for the title, and YouTube normally answers in well under a second
    const res = await rpc.invoke(Channels.VideoGetInfo, { videoId }, 4_000);
    if (res?.ok && res.title?.trim()) return res.title.trim();
  } catch {
    // fall back to the id
  }
  return videoId;
}

const queueOf = (s: VideoQueueState): VideoQueueState => ({ waiting: s.waiting, queue: s.queue, playing: s.playing });

export const useVideoRequestStore = create<VideoRequestState>((set, get) => {
  const armSafetyTimer = (playing: PlayingVideo) => {
    if (safetyTimer) clearTimeout(safetyTimer);
    const wait = Math.max(0, videoSafetyDeadline(playing) - Date.now());
    safetyTimer = setTimeout(() => {
      safetyTimer = undefined;
      if (get().playing?.id !== playing.id || !isVideoOverdue(queueOf(get()), Date.now())) return;
      log('obs-error', `"${playing.title}" never reported its end; moving on to the next video.`);
      get().handleEnded(playing.id, 'timeout');
    }, wait);
  };

  return {
    ...EMPTY_VIDEO_QUEUE,
    overlayMissing: false,

    addFromStep: async (step, ctx, link) => {
      const settings = videoRequestSettings(step);
      const lang = appLanguage();
      // Taken before the title lookup, so a slow answer from YouTube does not move the viewer down the line
      const requestedAt = Date.now();
      const title = await lookupTitle(link.videoId);
      const request: VideoRequest = {
        id: crypto.randomUUID(),
        videoId: link.videoId,
        startSeconds: link.startSeconds,
        title,
        requestedBy: ctx.username || ctx.userLogin || 'viewer',
        requesterLogin: (ctx.userLogin || ctx.username || '').toLowerCase(),
        maxSeconds: settings.lengthMode === 'full' ? 0 : settings.maxSeconds,
        volume: settings.volume,
        position: settings.position,
        size: settings.size,
        requestedAt,
        skipWho: settings.skipWho,
        approvedMessage: videoMessageTemplate(step, 'approved', lang),
        deniedMessage: videoMessageTemplate(step, 'denied', lang),
      };
      const added = addVideoRequest(queueOf(get()), request, settings.approval);
      set(added.state);
      log(
        'trigger',
        added.status === 'waiting'
          ? `${request.requestedBy} asked for "${title}" (${link.videoId}); waiting for approval.`
          : `${request.requestedBy} asked for "${title}" (${link.videoId}); queued without approval (#${added.position}).`,
      );
      if (added.status === 'queued') void get().playNext();
      return { ok: true, status: added.status, position: added.position, title };
    },

    approve: async (which, by) => {
      const res = approveVideoRequest(queueOf(get()), which);
      if (!res.request) return null;
      set(res.state);
      log('trigger', `${by} approved "${res.request.title}" from ${res.request.requestedBy} (#${res.position} in line).`);
      await sendChat(fillVideoMessage(res.request.approvedMessage, { username: res.request.requestedBy, title: res.request.title, position: res.position }));
      void get().playNext();
      return res.request;
    },

    deny: async (which, by) => {
      const res = denyVideoRequest(queueOf(get()), which);
      if (!res.request) return null;
      set(res.state);
      log('trigger', `${by} denied "${res.request.title}" from ${res.request.requestedBy}.`);
      await sendChat(fillVideoMessage(res.request.deniedMessage, { username: res.request.requestedBy, title: res.request.title }));
      return res.request;
    },

    remove: (id, by) => {
      const res = removeQueuedVideo(queueOf(get()), id);
      if (!res.request) return;
      set(res.state);
      log('trigger', `${by} removed "${res.request.title}" from ${res.request.requestedBy} from the queue.`);
    },

    skip: async (by) => {
      const res = skipVideo(queueOf(get()));
      if (!res.skipped) return null;
      if (safetyTimer) clearTimeout(safetyTimer);
      safetyTimer = undefined;
      set(res.state);
      log('trigger', `${by} skipped "${res.skipped.title}" from ${res.skipped.requestedBy}.`);
      try {
        await rpc.invoke(Channels.ChatOverlayStopVideo, { requestId: res.skipped.id });
      } catch {
        // the overlay cuts it off by itself
      }
      void get().playNext();
      return res.skipped;
    },

    handleEnded: (requestId, reason) => {
      const res = finishVideo(queueOf(get()), requestId);
      if (!res.finished) return;
      if (safetyTimer) clearTimeout(safetyTimer);
      safetyTimer = undefined;
      set(res.state);
      const why = reason === 'cutoff' ? 'reached its time limit' : reason === 'error' ? 'could not play on YouTube' : reason === 'timeout' ? 'timed out' : 'finished';
      log(reason === 'error' ? 'obs-error' : 'obs-ok', `"${res.finished.title}" from ${res.finished.requestedBy} ${why}.`);
      void get().playNext();
    },

    playNext: async () => {
      const res = startNextVideo(queueOf(get()), Date.now());
      if (!res.started) return;
      const started = res.started;
      set({ ...res.state, overlayMissing: false });
      let ok = false;
      let error: string | null | undefined;
      try {
        const sent = await rpc.invoke(Channels.ChatOverlayShowVideo, {
          requestId: started.id,
          videoId: started.videoId,
          startSeconds: started.startSeconds,
          maxSeconds: started.maxSeconds,
          volume: started.volume,
          position: started.position,
          size: started.size,
          title: started.title,
          requestedBy: started.requestedBy,
        });
        ok = Boolean(sent?.ok);
        error = sent?.error;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      if (get().playing?.id !== started.id) return; // skipped while it was being sent
      if (!ok) {
        // Put it back at the front: it plays once the image browser source is open again
        const { startedAt: _startedAt, ...request } = started;
        void _startedAt;
        set((s) => ({ playing: null, queue: [request, ...s.queue], overlayMissing: error === 'NO_OVERLAY' }));
        log(
          'obs-error',
          error === 'NO_OVERLAY'
            ? `"${started.title}" is waiting: the image browser source is not open in OBS. Add it, then press Play next in the Video requests panel.`
            : `"${started.title}" could not be sent to the overlay (${error ?? 'unknown'}).`,
        );
        return;
      }
      log('obs-ok', `Playing "${started.title}" from ${started.requestedBy}${started.maxSeconds > 0 ? ` (up to ${started.maxSeconds}s)` : ' (whole video)'}.`);
      armSafetyTimer(started);
    },
  };
});
