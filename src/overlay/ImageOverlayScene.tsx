import { useEffect, useState } from 'react';
import type { ShowOverlayImagePayload } from '../rpc/contracts';
import { overlayMotionStyle, overlayPositionStyle } from './overlayLayout';

interface ImageOverlaySceneProps {
  image: ShowOverlayImagePayload | null;
  onDismiss?: () => void;
}

export function ImageOverlayScene({ image, onDismiss }: ImageOverlaySceneProps) {
  const [visible, setVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState<ShowOverlayImagePayload | null>(null);

  useEffect(() => {
    if (!image || (!image.imageUrl && !image.imagePath)) {
      setVisible(false);
      const timer = setTimeout(() => setCurrentImage(null), 300);
      return () => clearTimeout(timer);
    }

    setCurrentImage(image);
    setVisible(true);

    const duration = image.durationSeconds && image.durationSeconds > 0 ? image.durationSeconds : 5;
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration * 1000);

    return () => clearTimeout(hideTimer);
  }, [image, onDismiss]);

  if (!currentImage) return null;

  const src = currentImage.imageUrl || currentImage.imagePath || '';
  if (!src) return null;

  const pos = currentImage.position || 'center';
  const anim = currentImage.animation || 'bounce';
  const scale = currentImage.imageScale ?? 1.0;

  const isFullscreen = pos === 'fullscreen';

  return (
    <div style={overlayPositionStyle(pos)}>
      <div style={{ position: 'relative', maxWidth: '100%', overflow: 'hidden', ...overlayMotionStyle(anim, visible) }}>
        <img
          src={src}
          alt="OBS Sequence Display"
          style={{
            display: 'block',
            userSelect: 'none',
            ...(isFullscreen
              ? { width: '100vw', height: '100vh', objectFit: 'cover' }
              : { maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 12, transform: `scale(${scale})` }),
            filter: 'drop-shadow(0 15px 25px rgba(0, 0, 0, 0.65)) drop-shadow(0 0 1px rgba(255, 255, 255, 0.2))',
          }}
          onError={() => {
            setVisible(false);
            onDismiss?.();
          }}
        />
      </div>
    </div>
  );
}
