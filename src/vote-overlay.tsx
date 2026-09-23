import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PollState } from './rpc/contracts';
import { createInitialPoll } from './lib/voteRules';
import { VoteScene } from './overlay/VoteScene';

interface OverlayEnvelope {
  v: number;
  id: string;
  kind: string;
  payload: unknown;
}

const pageStyles = `
  html, body, #vote-overlay-root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 16px;
    box-sizing: border-box;
    overflow: hidden;
    background: transparent !important;
  }
  * { box-sizing: border-box; }
  :root { color-scheme: dark; }
`;

function VoteOverlayApp() {
  const [poll, setPoll] = useState<PollState>(createInitialPoll());

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;
    let retryTimer: number | undefined;

    const connect = () => {
      if (disposed) return;
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${window.location.host}/ws?target=vote-overlay`);

      socket.addEventListener('message', (event) => {
        try {
          if (typeof event.data !== 'string') return;
          const envelope = JSON.parse(event.data) as Partial<OverlayEnvelope>;
          if (envelope.kind === 'vote-state' && envelope.payload) {
            setPoll(envelope.payload as PollState);
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

  return <VoteScene poll={poll} fadeWhenInactive={true} />;
}

const root = document.getElementById('vote-overlay-root');
if (!root) throw new Error('Vote overlay root was not found.');

const style = document.createElement('style');
style.textContent = pageStyles;
document.head.appendChild(style);

createRoot(root).render(<VoteOverlayApp />);
