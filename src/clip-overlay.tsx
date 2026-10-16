import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ShowOverlayClipPayload } from './rpc/contracts';
import { ClipOverlayScene } from './overlay/ClipOverlayScene';
import { reloadIfStale } from './lib/overlayVersion';

/*
 * The browser source for clips (raider / shoutout clips). It is separate from the picture and GIF source so the
 * two can be placed and layered independently in OBS.
 */

interface OverlayEnvelope {
  v: number;
  id: string;
  kind: string;
  payload: unknown;
}

const pageStyles = `
  html, body, #clip-overlay-root {
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

function DedicatedClipOverlayApp() {
  const [clip, setClip] = useState<ShowOverlayClipPayload | null>(null);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;
    let retryTimer: number | undefined;

    const connect = () => {
      if (disposed) return;
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${window.location.host}/ws?target=clip-overlay`);

      socket.addEventListener('message', (event) => {
        try {
          if (typeof event.data !== 'string') return;
          const envelope = JSON.parse(event.data) as Partial<OverlayEnvelope>;
          if (envelope.kind === 'show-clip' && envelope.payload) {
            // A new clip replaces the one playing.
            setClip({ ...(envelope.payload as ShowOverlayClipPayload) });
          } else if (envelope.kind === 'app-version') {
            reloadIfStale((envelope.payload as { version?: string } | undefined)?.version);
          } else if (envelope.kind === 'hide-image') {
            setClip(null);
          }
        } catch {
          // ignore malformed payloads
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

  return <ClipOverlayScene clip={clip} onDismiss={() => setClip(null)} />;
}

const root = document.getElementById('clip-overlay-root');
if (!root) throw new Error('Clip overlay root was not found.');

const style = document.createElement('style');
style.textContent = pageStyles;
document.head.appendChild(style);

createRoot(root).render(<DedicatedClipOverlayApp />);
