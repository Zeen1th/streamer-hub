import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ShowOverlayImagePayload } from './rpc/contracts';
import { ImageOverlayScene } from './overlay/ImageOverlayScene';

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

function DedicatedImageOverlayApp() {
  const [image, setImage] = useState<ShowOverlayImagePayload | null>(null);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;
    let retryTimer: number | undefined;

    const connect = () => {
      if (disposed) return;
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${window.location.host}/ws?target=image-overlay`);

      socket.addEventListener('message', (event) => {
        try {
          if (typeof event.data !== 'string') return;
          const envelope = JSON.parse(event.data) as Partial<OverlayEnvelope>;
          if (envelope.kind === 'show-image' && envelope.payload) {
            setImage(envelope.payload as ShowOverlayImagePayload);
          } else if (envelope.kind === 'hide-image') {
            setImage(null);
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

  return <ImageOverlayScene image={image} onDismiss={() => setImage(null)} />;
}

const root = document.getElementById('image-overlay-root');
if (!root) throw new Error('Image overlay root was not found.');

const style = document.createElement('style');
style.textContent = pageStyles;
document.head.appendChild(style);

createRoot(root).render(<DedicatedImageOverlayApp />);
