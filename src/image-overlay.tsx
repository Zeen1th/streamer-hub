import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ShowOverlayClipPayload, ShowOverlayImagePayload, ShowOverlayVideoPayload, VideoEndReason } from './rpc/contracts';
import { ClipOverlayScene } from './overlay/ClipOverlayScene';
import { ImageOverlayScene } from './overlay/ImageOverlayScene';
import { VideoOverlayScene } from './overlay/VideoOverlayScene';
import { reloadIfStale } from './lib/overlayVersion';
import { pageShowsImage } from './lib/imageSlots';

interface OverlayEnvelope {
  v: number;
  id: string;
  kind: string;
  payload: unknown;
}

const pageStyles = `
  html, body, #image-overlay-root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    overflow: hidden;
    background: transparent !important;
  }
  * { box-sizing: border-box; }
  :root { color-scheme: dark; }
`;

/** This page's own slot (image-overlay.html?slot=2), or null for the main source. */
const PAGE_SLOT = new URLSearchParams(window.location.search).get('slot')?.trim() || null;

function DedicatedImageOverlayApp() {
  const [image, setImage] = useState<ShowOverlayImagePayload | null>(null);
  const [clip, setClip] = useState<ShowOverlayClipPayload | null>(null);
  /** A viewer's requested YouTube video. It has its own layer: pictures and clips can still pop up over it. */
  const [video, setVideo] = useState<ShowOverlayVideoPayload | null>(null);
  const socketRef = useRef<WebSocket | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;
    let retryTimer: number | undefined;

    const connect = () => {
      if (disposed) return;
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      // A numbered source tells the app its slot, so the app knows it is open
      const slotQuery = PAGE_SLOT ? `&id=${encodeURIComponent(PAGE_SLOT)}` : '';
      socket = new WebSocket(`${scheme}://${window.location.host}/ws?target=image-overlay${slotQuery}`);
      socketRef.current = socket;

      socket.addEventListener('message', (event) => {
        try {
          if (typeof event.data !== 'string') return;
          const envelope = JSON.parse(event.data) as Partial<OverlayEnvelope>;
          // One thing on screen at a time: a new picture or clip replaces the last.
          if (envelope.kind === 'show-image' && envelope.payload) {
            // Numbered sources (?slot=2) show only their own pictures; the main source shows the rest
            const payload = envelope.payload as ShowOverlayImagePayload;
            if (!pageShowsImage(PAGE_SLOT, payload.slot)) return;
            setClip(null);
            setImage(payload);
          } else if (envelope.kind === 'show-clip' && envelope.payload) {
            if (PAGE_SLOT) return; // clips and video requests use the main source
            setImage(null);
            setClip({ ...(envelope.payload as ShowOverlayClipPayload) });
          } else if (envelope.kind === 'show-video' && envelope.payload) {
            if (PAGE_SLOT) return;
            setVideo({ ...(envelope.payload as ShowOverlayVideoPayload) });
          } else if (envelope.kind === 'stop-video') {
            const requestId = (envelope.payload as { requestId?: string | null } | undefined)?.requestId;
            setVideo((playing) => (!requestId || playing?.requestId === requestId ? null : playing));
          } else if (envelope.kind === 'app-version') {
            reloadIfStale((envelope.payload as { version?: string } | undefined)?.version);
          } else if (envelope.kind === 'hide-image') {
            setImage(null);
            setClip(null);
          }
        } catch {
          // ignore
        }
      });

      socket.addEventListener('close', () => {
        if (disposed) return;
        retryTimer = window.setTimeout(connect, 1500);
      });

      socket.addEventListener('error', () => {
        try {
          socket?.close();
        } catch {
          // ignore
        }
      });
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      try {
        socket?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  // Tells the app the video is over, so the next request can play.
  const handleVideoEnded = useCallback((requestId: string, reason: VideoEndReason) => {
    setVideo((playing) => (playing?.requestId === requestId ? null : playing));
    try {
      socketRef.current?.send(JSON.stringify({ kind: 'video-ended', requestId, reason }));
    } catch {
      // the app's safety timer moves on by itself
    }
  }, []);

  return (
    <>
      <VideoOverlayScene video={video} onEnded={handleVideoEnded} />
      <ImageOverlayScene image={image} onDismiss={() => setImage(null)} />
      <ClipOverlayScene clip={clip} onDismiss={() => setClip(null)} />
    </>
  );
}

const root = document.getElementById('image-overlay-root');
if (!root) throw new Error('Image overlay root was not found.');

const style = document.createElement('style');
style.textContent = pageStyles;
document.head.appendChild(style);

createRoot(root).render(<DedicatedImageOverlayApp />);
