import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ShowOverlayClipPayload } from '../rpc/contracts';
import { overlayMotionStyle, overlayPositionStyle } from './overlayLayout';

interface ClipOverlaySceneProps {
  clip: ShowOverlayClipPayload | null;
  onDismiss?: () => void;
}

const LEAVE_MS = 350;
/** The card is mounted hidden first so its entry animation has something to animate from. */
const ENTER_DELAY_MS = 30;

/** Twitch's embedded clip player. Used when no direct video file is known, or the file fails to load. */
function embedUrl(clipId: string): string {
  const parent = window.location.hostname || 'localhost';
  return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clipId)}&parent=${encodeURIComponent(parent)}&autoplay=true&muted=false`;
}

const fill: CSSProperties = { width: '100%', height: '100%', border: 0, display: 'block' };

export function ClipOverlayScene({ clip, onDismiss }: ClipOverlaySceneProps) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<ShowOverlayClipPayload | null>(null);
  const [useEmbed, setUseEmbed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // The parent passes a fresh callback every render; keep the timers from restarting because of that.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const finish = useCallback(() => {
    setVisible(false);
    onDismissRef.current?.();
  }, []);

  // A new clip replaces whatever is playing; it ends when its time is up (the file's own `ended` can come sooner).
  useEffect(() => {
    if (!clip) {
      setVisible(false);
      const timer = setTimeout(() => setCurrent(null), LEAVE_MS);
      return () => clearTimeout(timer);
    }

    setVisible(false);
    setCurrent(clip);
    setUseEmbed(!clip.videoUrl);
    const showTimer = setTimeout(() => setVisible(true), ENTER_DELAY_MS);

    const seconds = clip.durationSeconds > 0 ? clip.durationSeconds : 30;
    const hideTimer = setTimeout(finish, seconds * 1000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [clip, finish]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !current) return;
    video.volume = Math.min(1, Math.max(0, current.volume));
    // Browsers other than OBS refuse sound before the page is touched; play muted rather than not at all.
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [current, useEmbed]);

  if (!current) return null;

  const fullscreen = current.position === 'fullscreen';
  const size = Math.min(100, Math.max(10, current.size));

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
          ...overlayMotionStyle(current.animation, visible),
        }}
      >
        <div style={fullscreen ? { width: '100%', height: '100%' } : { width: '100%', aspectRatio: '16 / 9' }}>
          {useEmbed ? (
            <iframe key={current.clipId} src={embedUrl(current.clipId)} title={current.title} allow="autoplay" style={fill} />
          ) : (
            <video
              key={current.clipId}
              ref={videoRef}
              src={current.videoUrl ?? undefined}
              autoPlay
              playsInline
              style={{ ...fill, objectFit: 'contain' }}
              onEnded={finish}
              onError={() => setUseEmbed(true)}
            />
          )}
        </div>

        {current.caption && (
          <div
            dir="auto"
            style={{
              ...(fullscreen ? { position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: 36 } : { fontSize: 22 }),
              padding: '10px 16px',
              textAlign: 'center',
              fontFamily: "'Cairo', 'Segoe UI', system-ui, sans-serif",
              fontWeight: 600,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
              background: 'linear-gradient(90deg, rgba(91, 33, 182, 0.92), rgba(124, 58, 237, 0.92))',
            }}
          >
            {current.caption}
          </div>
        )}
      </div>
    </div>
  );
}
