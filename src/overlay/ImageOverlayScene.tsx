import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ShowOverlayImagePayload } from '../rpc/contracts';
import { isVideoFile } from '../lib/mediaKind';
import { overlayMotionStyle, overlayPositionStyle } from './overlayLayout';

interface ImageOverlaySceneProps {
  image: ShowOverlayImagePayload | null;
  onDismiss?: () => void;
}

/** Older hosts send the size as `scale`; newer ones send both. */
type ImagePayload = ShowOverlayImagePayload & { scale?: number };

export function ImageOverlayScene({ image, onDismiss }: ImageOverlaySceneProps) {
  const [visible, setVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState<ImagePayload | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // The parent passes a fresh callback every render; keep the timers from restarting because of that.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const finish = useCallback(() => {
    setVisible(false);
    onDismissRef.current?.();
  }, []);

  const src = currentImage ? currentImage.imageUrl || currentImage.imagePath || '' : '';
  const isVideo = isVideoFile(src);

  useEffect(() => {
    if (!image || (!image.imageUrl && !image.imagePath)) {
      setVisible(false);
      const timer = setTimeout(() => setCurrentImage(null), 300);
      return () => clearTimeout(timer);
    }

    setCurrentImage(image);
    setVisible(true);

    // A video set to play to the end leaves when it ends (or fails); everything else after its duration.
    const playsToEnd = Boolean(image.imagePlayFullVideo) && isVideoFile(image.imageUrl || image.imagePath);
    if (playsToEnd) return undefined;

    const duration = image.durationSeconds && image.durationSeconds > 0 ? image.durationSeconds : 5;
    const hideTimer = setTimeout(finish, duration * 1000);
    return () => clearTimeout(hideTimer);
  }, [image, finish]);

  // Autoplay with sound; browsers other than OBS refuse sound before the page is touched, so play muted rather than not at all.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentImage || !isVideo) return;
    // The same file shown again starts over
    if (video.currentTime > 0) video.currentTime = 0;
    video.muted = false;
    video.volume = Math.min(1, Math.max(0, currentImage.imageVolume ?? 1));
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [currentImage, isVideo]);

  if (!currentImage || !src) return null;

  const pos = currentImage.position || 'center';
  const anim = currentImage.animation || 'bounce';
  const scale = currentImage.imageScale ?? currentImage.scale ?? 1.0;

  const isFullscreen = pos === 'fullscreen';
  const mediaStyle: CSSProperties = {
    display: 'block',
    userSelect: 'none',
    ...(isFullscreen
      ? { width: '100vw', height: '100vh', objectFit: 'cover' }
      : { maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 12, transform: `scale(${scale})` }),
    filter: 'drop-shadow(0 15px 25px rgba(0, 0, 0, 0.65)) drop-shadow(0 0 1px rgba(255, 255, 255, 0.2))',
  };

  return (
    <div style={overlayPositionStyle(pos)}>
      <div style={{ position: 'relative', maxWidth: '100%', overflow: 'hidden', ...overlayMotionStyle(anim, visible) }}>
        {isVideo ? (
          <video
            key={src}
            ref={videoRef}
            src={src}
            autoPlay
            playsInline
            style={mediaStyle}
            // The video leaves when it ends, or when its time is up (whichever comes first)
            onEnded={finish}
            onError={finish}
          />
        ) : (
          <img src={src} alt="OBS Sequence Display" style={mediaStyle} onError={finish} />
        )}
      </div>
    </div>
  );
}
