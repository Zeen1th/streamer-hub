import { useEffect, useRef, useState } from 'react';
import type { ShowOverlayVideoPayload, VideoEndReason } from '../rpc/contracts';
import { overlayMotionStyle, overlayPositionStyle } from './overlayLayout';

/*
 * A viewer's YouTube video on the image browser source. It uses YouTube's own embedded player (IFrame API) so it
 * knows when the video ends or fails, cuts it at maxSeconds of playing time, and reports back how it ended.
 */

interface VideoOverlaySceneProps {
  video: ShowOverlayVideoPayload | null;
  /** Called once per video, when it ended, was cut off, or could not play. */
  onEnded: (requestId: string, reason: VideoEndReason) => void;
}

const LEAVE_MS = 350;
/** A video that has not started playing after this long is given up on (blocked, private, region locked...). */
const START_TIMEOUT_MS = 20_000;
/** If the player is still not playing this long after "play", sound was refused: play muted instead. */
const MUTED_RETRY_MS = 1_500;

// The parts of the YouTube IFrame API this page uses.
interface YtPlayer {
  playVideo(): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  getPlayerState(): number;
  destroy(): void;
}
interface YtNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YtPlayer }) => void;
        onStateChange?: (event: { data: number; target: YtPlayer }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YtPlayer;
}

const PLAYING = 1;
const ENDED = 0;

let apiPromise: Promise<YtNamespace> | null = null;

/** Loads https://www.youtube.com/iframe_api once. */
function loadYouTubeApi(): Promise<YtNamespace> {
  const win = window as unknown as { YT?: YtNamespace & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };
  if (win.YT?.Player) return Promise.resolve(win.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YtNamespace>((resolve, reject) => {
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (win.YT?.Player) resolve(win.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('YouTube player could not load'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function VideoOverlayScene({ video, onEnded }: VideoOverlaySceneProps) {
  const [current, setCurrent] = useState<ShowOverlayVideoPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  // A new video replaces whatever is playing; null hides it.
  useEffect(() => {
    if (!video) {
      setVisible(false);
      const timer = setTimeout(() => setCurrent(null), LEAVE_MS);
      return () => clearTimeout(timer);
    }
    setCurrent(video);
    return undefined;
  }, [video]);

  useEffect(() => {
    const host = hostRef.current;
    if (!current || !host) return undefined;

    let disposed = false;
    let reported = false;
    let player: YtPlayer | null = null;
    let cutTimer: number | undefined;
    let mutedTimer: number | undefined;
    const startTimer = window.setTimeout(() => finish('error'), START_TIMEOUT_MS);

    function finish(reason: VideoEndReason) {
      if (reported || disposed) return;
      reported = true;
      window.clearTimeout(startTimer);
      window.clearTimeout(cutTimer);
      window.clearTimeout(mutedTimer);
      setVisible(false);
      onEndedRef.current(current!.requestId, reason);
    }

    // The player replaces this element; a fresh one per video keeps React's own node untouched.
    const mount = document.createElement('div');
    mount.style.width = '100%';
    mount.style.height = '100%';
    host.appendChild(mount);

    loadYouTubeApi()
      .then((YT) => {
        if (disposed) return;
        player = new YT.Player(mount, {
          videoId: current.videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            start: Math.max(0, Math.floor(current.startSeconds)),
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              event.target.unMute();
              event.target.setVolume(Math.round(Math.min(1, Math.max(0, current.volume)) * 100));
              event.target.playVideo();
              setVisible(true);
              // Browsers other than OBS refuse sound before the page is touched: play muted rather than not at all.
              mutedTimer = window.setTimeout(() => {
                if (disposed || reported) return;
                if (event.target.getPlayerState() !== PLAYING) {
                  event.target.mute();
                  event.target.playVideo();
                }
              }, MUTED_RETRY_MS);
            },
            onStateChange: (event) => {
              if (event.data === PLAYING && cutTimer === undefined) {
                window.clearTimeout(startTimer);
                // The cut-off counts playing time from the first frame, not the time it took to load.
                if (current.maxSeconds > 0) cutTimer = window.setTimeout(() => finish('cutoff'), current.maxSeconds * 1000);
              } else if (event.data === ENDED) {
                finish('ended');
              }
            },
            onError: () => finish('error'),
          },
        });
      })
      .catch(() => finish('error'));

    return () => {
      disposed = true;
      window.clearTimeout(startTimer);
      window.clearTimeout(cutTimer);
      window.clearTimeout(mutedTimer);
      try {
        player?.destroy();
      } catch {
        // already gone
      }
      mount.remove();
    };
  }, [current]);

  if (!current) return null;

  const fullscreen = current.position === 'fullscreen';
  const size = Math.min(100, Math.max(10, current.size));
  const caption = [current.title, current.requestedBy ? `@${current.requestedBy}` : ''].filter(Boolean).join('  ·  ');

  return (
    <div style={overlayPositionStyle(current.position)}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#000',
          ...(fullscreen
            ? { width: '100vw', height: '100vh' }
            : {
                width: `${size}vw`,
                borderRadius: 12,
                boxShadow: '0 15px 25px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.18)',
              }),
          ...overlayMotionStyle('fade', visible),
        }}
      >
        <div
          ref={hostRef}
          style={fullscreen ? { width: '100%', height: '100%' } : { width: '100%', aspectRatio: '16 / 9' }}
        />
        {caption && (
          <div
            dir="auto"
            style={{
              ...(fullscreen ? { position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: 30 } : { fontSize: 18 }),
              padding: '8px 14px',
              textAlign: 'center',
              fontFamily: "'Cairo', 'Segoe UI', system-ui, sans-serif",
              fontWeight: 600,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
              background: 'linear-gradient(90deg, rgba(185, 28, 28, 0.92), rgba(220, 38, 38, 0.92))',
            }}
          >
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}
