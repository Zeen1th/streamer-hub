import { useEffect, useState } from 'react';
import type { ShowOverlayImagePayload } from '../rpc/contracts';

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

  const positionClasses = (() => {
    switch (pos) {
      case 'top-left':
        return 'top-8 left-8 items-start justify-start';
      case 'top-right':
        return 'top-8 right-8 items-start justify-end';
      case 'bottom-left':
        return 'bottom-8 left-8 items-end justify-start';
      case 'bottom-right':
        return 'bottom-8 right-8 items-end justify-end';
      case 'top-center':
        return 'top-8 inset-x-0 items-start justify-center';
      case 'bottom-center':
        return 'bottom-8 inset-x-0 items-end justify-center';
      case 'fullscreen':
        return 'inset-0 items-center justify-center p-0';
      case 'center':
      default:
        return 'inset-0 items-center justify-center';
    }
  })();

  const animationStyle = (() => {
    if (!visible) {
      return {
        opacity: 0,
        transform: 'scale(0.85) translateY(10px)',
        transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }

    switch (anim) {
      case 'fade':
        return {
          opacity: 1,
          transform: 'scale(1)',
          transition: 'opacity 400ms ease-out',
        };
      case 'zoom':
        return {
          opacity: 1,
          transform: 'scale(1)',
          transition: 'all 350ms cubic-bezier(0.16, 1, 0.3, 1)',
        };
      case 'slide-up':
        return {
          opacity: 1,
          transform: 'translateY(0)',
          transition: 'all 350ms cubic-bezier(0.16, 1, 0.3, 1)',
        };
      case 'slide-down':
        return {
          opacity: 1,
          transform: 'translateY(0)',
          transition: 'all 350ms cubic-bezier(0.16, 1, 0.3, 1)',
        };
      case 'none':
        return {
          opacity: 1,
          transform: 'none',
        };
      case 'bounce':
      default:
        return {
          opacity: 1,
          transform: 'scale(1)',
          transition: 'all 450ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        };
    }
  })();

  const initialHiddenClass = (() => {
    if (visible) return '';
    switch (anim) {
      case 'slide-up':
        return 'translate-y-16 opacity-0';
      case 'slide-down':
        return '-translate-y-16 opacity-0';
      case 'zoom':
        return 'scale-50 opacity-0';
      case 'fade':
        return 'opacity-0';
      case 'bounce':
      default:
        return 'scale-75 opacity-0';
    }
  })();

  const isFullscreen = pos === 'fullscreen';

  return (
    <div
      className={`pointer-events-none fixed z-50 flex ${positionClasses}`}
      style={{
        zIndex: 9999,
      }}
    >
      <div
        className={`relative max-w-full overflow-hidden transition-all duration-300 ${initialHiddenClass}`}
        style={animationStyle}
      >
        <img
          src={src}
          alt="OBS Sequence Display"
          className={`object-contain select-none drop-shadow-2xl ${
            isFullscreen
              ? 'h-screen w-screen object-cover'
              : 'max-h-[85vh] max-w-[85vw] rounded-xl'
          }`}
          style={{
            transform: isFullscreen ? undefined : `scale(${scale})`,
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
