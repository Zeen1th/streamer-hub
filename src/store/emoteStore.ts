import { create } from 'zustand';
import { rpc } from '../rpc';
import { Channels, Events } from '../rpc/contracts';
import type { ThirdPartyEmoteMap } from '../lib/chatEmotes';

interface EmoteState {
  /** Provider key (bttv / ffz / sevenTv) -> emote name -> image url, straight from the host. */
  providers: Record<string, ThirdPartyEmoteMap>;
  load(): Promise<void>;
}

export const useEmoteStore = create<EmoteState>((set) => ({
  providers: {},
  load: async () => {
    try {
      const providers = await rpc.invoke(Channels.ChatGetEmotes, undefined);
      set({ providers: providers ?? {} });
    } catch {
      // emotes just render as text until they arrive
    }
  },
}));

rpc.on(Events.TwitchEmotes, (providers) => {
  useEmoteStore.setState({ providers: providers ?? {} });
});
