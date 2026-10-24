import { rpc } from '../rpc';
import { Channels } from '../rpc/contracts';
import { useConnectionStore } from './connectionStore';
import { useStatsStore } from './statsStore';

const POLL_MS = 60_000;

/** Asks Twitch whether the channel is live, so Stream Pulse only counts while it really is. */
async function poll() {
  if (!useConnectionStore.getState().twitchConnected) return;
  try {
    const res = await rpc.invoke(Channels.TwitchGetStreamStatus, undefined, 20_000);
    // A failed question says nothing about the stream: keep counting as before
    if (!res.ok) return;
    const startedAt = res.startedAt ? Date.parse(res.startedAt) : undefined;
    useStatsStore.getState().setStreamStatus(res.live ? 'live' : 'offline', Number.isFinite(startedAt) ? startedAt : undefined);
  } catch {
    // network trouble: leave the last known state
  }
}

let started = false;

export function startStreamStatusPolling() {
  if (started) return;
  started = true;
  useConnectionStore.subscribe((state, prev) => {
    if (state.twitchConnected && !prev.twitchConnected) void poll();
    if (!state.twitchConnected && prev.twitchConnected) useStatsStore.getState().setStreamStatus('unknown');
  });
  window.setInterval(() => void poll(), POLL_MS);
  void poll();
}
