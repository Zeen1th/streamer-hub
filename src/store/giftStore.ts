import { create } from 'zustand';
import { rpc } from '../rpc';
import { Channels, Events, type TwitchGiftEvent } from '../rpc/contracts';
import { mergeGift } from '../lib/giftStrip';

interface GiftState {
  gifts: TwitchGiftEvent[];
  load(): Promise<void>;
  add(gift: TwitchGiftEvent): void;
  clear(): void;
}

export const useGiftStore = create<GiftState>((set) => ({
  gifts: [],
  load: async () => {
    try {
      const recent = await rpc.invoke(Channels.ChatGetGifts, undefined);
      set((state) => ({ gifts: (recent ?? []).reduce(mergeGift, state.gifts) }));
    } catch {
      // gifts just appear live
    }
  },
  add: (gift) => set((state) => ({ gifts: mergeGift(state.gifts, gift) })),
  clear: () => set({ gifts: [] }),
}));

rpc.on(Events.TwitchGift, (gift) => {
  useGiftStore.getState().add(gift);
});
