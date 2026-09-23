import { create } from 'zustand';
import type { ChatMessage, PollState, VoteOption } from '../rpc/contracts';
import { Channels } from '../rpc/contracts';
import { rpc } from '../rpc';
import {
  createInitialPoll,
  DEFAULT_OPTION_COLORS,
  decrementManualVote,
  incrementManualVote,
  parseVoteInput,
  recordVote,
} from '../lib/voteRules';

interface VoterActivity {
  username: string;
  optionId: string;
  optionLabel: string;
  timestamp: number;
}

interface VoteStoreState {
  poll: PollState;
  overlayUrl: string;
  isLoading: boolean;
  isSaving: boolean;
  recentActivity: VoterActivity[];
  
  loadState: () => Promise<void>;
  savePoll: (pollState?: PollState) => Promise<boolean>;
  resetVotes: () => Promise<boolean>;
  startPoll: (durationSeconds?: number) => Promise<boolean>;
  endPoll: () => Promise<boolean>;
  
  setTitle: (title: string) => void;
  addOption: (label?: string, imageUrl?: string) => void;
  removeOption: (id: string) => void;
  updateOption: (id: string, updates: Partial<VoteOption>) => void;
  setAllowChatVotes: (allow: boolean) => void;
  setAllowChangeVote: (allow: boolean) => void;
  setDurationSeconds: (duration: number) => void;
  setPollFromAi: (title: string, options: Array<{ label: string; imageUrl?: string; color?: string }>) => void;
  
  incrementManual: (optionId: string) => void;
  decrementManual: (optionId: string) => void;
  handleChatMessage: (message: ChatMessage) => void;
  applyRemotePoll: (poll: PollState) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let endPollTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoSave(get: () => VoteStoreState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void get().savePoll();
  }, 250);
}

export const useVoteStore = create<VoteStoreState>((set, get) => ({
  poll: createInitialPoll(),
  overlayUrl: 'http://127.0.0.1:49178/vote-overlay.html',
  isLoading: false,
  isSaving: false,
  recentActivity: [],

  loadState: async () => {
    set({ isLoading: true });
    try {
      const response = await rpc.invoke(Channels.VotesGetState, undefined);
      if (response && response.poll) {
        const loadedPoll = response.poll;
        // Ensure options and voters are always arrays/objects
        const normalizedPoll: PollState = {
          ...createInitialPoll(),
          ...loadedPoll,
          options: loadedPoll.options && loadedPoll.options.length > 0
            ? loadedPoll.options
            : createInitialPoll().options,
          voters: loadedPoll.voters ?? {},
        };
        set({
          poll: normalizedPoll,
          overlayUrl: response.url || 'http://127.0.0.1:49178/vote-overlay.html',
          isLoading: false,
        });

        // If poll was running with remaining duration, resume timer
        if (normalizedPoll.isActive && !normalizedPoll.isEnded && normalizedPoll.durationSeconds > 0 && normalizedPoll.startedAt) {
          const elapsed = Math.floor((Date.now() - normalizedPoll.startedAt) / 1000);
          const remaining = normalizedPoll.durationSeconds - elapsed;
          if (remaining > 0) {
            if (endPollTimer) clearTimeout(endPollTimer);
            endPollTimer = setTimeout(() => {
              void get().endPoll();
            }, remaining * 1000);
          } else {
            void get().endPoll();
          }
        }
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  savePoll: async (customPoll?: PollState) => {
    const targetPoll = customPoll ?? get().poll;
    set({ isSaving: true });
    try {
      const res = await rpc.invoke(Channels.VotesSave, { poll: targetPoll });
      set({ isSaving: false });
      return Boolean(res?.ok);
    } catch {
      set({ isSaving: false });
      return false;
    }
  },

  resetVotes: async () => {
    if (saveTimer) clearTimeout(saveTimer);
    try {
      const res = await rpc.invoke(Channels.VotesReset, undefined);
      if (res?.ok && res.poll) {
        set({ poll: res.poll, recentActivity: [] });
        return true;
      }
      return false;
    } catch {
      const current = get().poll;
      const reset = {
        ...current,
        options: current.options.map((o) => ({ ...o, votes: 0 })),
        totalVotes: 0,
        voters: {},
      };
      set({ poll: reset, recentActivity: [] });
      await get().savePoll(reset);
      return true;
    }
  },

  startPoll: async (durationOverride?: number) => {
    const current = get().poll;
    const duration = durationOverride ?? current.durationSeconds;
    const nextPoll: PollState = {
      ...current,
      isActive: true,
      isEnded: false,
      startedAt: Date.now(),
      endedAt: undefined,
      durationSeconds: duration,
    };

    if (endPollTimer) clearTimeout(endPollTimer);
    if (duration > 0) {
      endPollTimer = setTimeout(() => {
        void get().endPoll();
      }, duration * 1000);
    }

    set({ poll: nextPoll });
    return await get().savePoll(nextPoll);
  },

  endPoll: async () => {
    if (endPollTimer) clearTimeout(endPollTimer);
    const current = get().poll;
    const nextPoll: PollState = {
      ...current,
      isActive: false,
      isEnded: true,
      endedAt: Date.now(),
    };
    set({ poll: nextPoll });
    return await get().savePoll(nextPoll);
  },

  setTitle: (title: string) => {
    set((state) => ({
      poll: { ...state.poll, title },
    }));
    scheduleAutoSave(get);
  },

  addOption: (label?: string, imageUrl?: string) => {
    set((state) => {
      const currentOpts = state.poll.options;
      const nextIndex = currentOpts.length + 1;
      const newColor = DEFAULT_OPTION_COLORS[(nextIndex - 1) % DEFAULT_OPTION_COLORS.length];
      const newOption: VoteOption = {
        id: 'opt-' + Date.now() + '-' + nextIndex,
        key: String(nextIndex),
        label: label?.trim() || `Option ${nextIndex}`,
        votes: 0,
        color: newColor,
        imageUrl: imageUrl?.trim() || undefined,
      };
      return {
        poll: {
          ...state.poll,
          options: [...currentOpts, newOption],
        },
      };
    });
    scheduleAutoSave(get);
  },

  removeOption: (id: string) => {
    set((state) => {
      const remaining = state.poll.options.filter((o) => o.id !== id);
      if (remaining.length === 0) return state;
      // Re-key remaining options if needed: 1, 2, 3...
      const rekeyed = remaining.map((opt, idx) => ({
        ...opt,
        key: String(idx + 1),
      }));
      const totalVotes = rekeyed.reduce((sum, opt) => sum + opt.votes, 0);
      return {
        poll: {
          ...state.poll,
          options: rekeyed,
          totalVotes,
        },
      };
    });
    scheduleAutoSave(get);
  },

  updateOption: (id: string, updates: Partial<VoteOption>) => {
    set((state) => ({
      poll: {
        ...state.poll,
        options: state.poll.options.map((opt) =>
          opt.id === id ? { ...opt, ...updates } : opt,
        ),
      },
    }));
    scheduleAutoSave(get);
  },

  setAllowChatVotes: (allow: boolean) => {
    set((state) => ({
      poll: { ...state.poll, allowChatVotes: allow },
    }));
    scheduleAutoSave(get);
  },

  setAllowChangeVote: (allow: boolean) => {
    set((state) => ({
      poll: { ...state.poll, allowChangeVote: allow },
    }));
    scheduleAutoSave(get);
  },

  setDurationSeconds: (duration: number) => {
    set((state) => ({
      poll: { ...state.poll, durationSeconds: Math.max(0, duration) },
    }));
    scheduleAutoSave(get);
  },

  setPollFromAi: (title: string, options: Array<{ label: string; imageUrl?: string; color?: string }>) => {
    set((state) => {
      const newOptions: VoteOption[] = options.map((opt, idx) => ({
        id: 'opt-' + Date.now() + '-' + (idx + 1),
        key: String(idx + 1),
        label: opt.label.trim(),
        votes: 0,
        color: opt.color || DEFAULT_OPTION_COLORS[idx % DEFAULT_OPTION_COLORS.length],
        imageUrl: opt.imageUrl?.trim() || undefined,
      }));
      return {
        poll: {
          ...state.poll,
          title: title.trim(),
          options: newOptions,
          totalVotes: 0,
          voters: {},
          isEnded: false,
          isActive: false,
        },
        recentActivity: [],
      };
    });
    scheduleAutoSave(get);
  },

  incrementManual: (optionId: string) => {
    const updated = incrementManualVote(get().poll, optionId);
    set({ poll: updated });
    scheduleAutoSave(get);
  },

  decrementManual: (optionId: string) => {
    const updated = decrementManualVote(get().poll, optionId);
    set({ poll: updated });
    scheduleAutoSave(get);
  },

  handleChatMessage: (message: ChatMessage) => {
    const state = get();
    const poll = state.poll;
    if (!poll.isActive || poll.isEnded || !poll.allowChatVotes) return;

    const matchedOptionId = parseVoteInput(message.message, poll.options);
    if (!matchedOptionId) return;

    const voterId = message.userId || message.username;
    if (!voterId) return;

    const updatedPoll = recordVote(poll, voterId, matchedOptionId);
    if (!updatedPoll) return; // Disallowed or duplicate

    const targetOption = updatedPoll.options.find((o) => o.id === matchedOptionId);

    const activityEntry: VoterActivity = {
      username: message.username,
      optionId: matchedOptionId,
      optionLabel: targetOption?.label || matchedOptionId,
      timestamp: Date.now(),
    };

    set((current) => ({
      poll: updatedPoll,
      recentActivity: [activityEntry, ...current.recentActivity.slice(0, 19)],
    }));

    scheduleAutoSave(get);
  },

  applyRemotePoll: (poll: PollState) => {
    set({ poll });
  },
}));
