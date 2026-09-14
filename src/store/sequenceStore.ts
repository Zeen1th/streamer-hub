import { create } from 'zustand';
import type {
  ChannelPointsRedemption,
  ChatMessage,
  CommandSequence,
  CounterAction,
  SequenceStep,
  SequenceStepType,
  TwitchRewardInfo,
} from '../rpc/contracts';
import { Channels } from '../rpc/contracts';
import { rpc } from '../rpc';
import {
  executeSequence,
  isSequenceOnCooldown,
  matchesSequenceTrigger,
  type SequenceExecutionContext,
} from '../lib/sequenceRunner';
import { useCounterStore } from './counterStore';
import { useLogStore } from './logStore';

interface SequenceState {
  sequences: CommandSequence[];
  lastTriggeredAt: Record<string, number>;
  availableRewards: TwitchRewardInfo[];
  isLoadingRewards: boolean;
  activeRunningSequenceId: string | null;
  activeRunningStepIndex: number | null;

  hydrate(sequences: CommandSequence[]): void;
  fetchAvailableRewards(): Promise<void>;
  add(): string;
  addSmartModTimeoutPreset(): string;
  update(id: string, patch: Partial<CommandSequence>): void;
  remove(id: string): void;
  addStep(sequenceId: string, type: SequenceStepType): void;
  updateStep(sequenceId: string, stepId: string, patch: Partial<SequenceStep>): void;
  removeStep(sequenceId: string, stepId: string): void;
  moveStep(sequenceId: string, stepIndex: number, direction: 'up' | 'down'): void;
  runSequence(id: string, customContext?: Partial<SequenceExecutionContext>): Promise<boolean>;
  handleChannelPointsRedemption(redemption: ChannelPointsRedemption): Promise<boolean>;
  handleChatMessage(message: ChatMessage): Promise<boolean>;
}

const persist = (sequence: CommandSequence) => {
  rpc.invoke(Channels.SequencesSave, { sequence }).catch(() => undefined);
};

const defaultStepForType = (type: SequenceStepType): SequenceStep => {
  const id = crypto.randomUUID();
  switch (type) {
    case 'wait':
      return { id, type: 'wait', waitDuration: 3, waitUnit: 'seconds' };
    case 'chat':
      return { id, type: 'chat', chatMessage: 'Drinking water! Thanks {username} 🥤' };
    case 'counter':
      return { id, type: 'counter', counterAction: 'increase' };
    case 'command':
      return { id, type: 'command', commandTrigger: '!sound' };
    case 'moderation':
      return {
        id,
        type: 'moderation',
        moderationAction: 'smart_timeout',
        targetUser: '{input}',
        durationSeconds: 60,
        reason: 'Channel Points Timeout',
      };
  }
};

export const useSequenceStore = create<SequenceState>((set, get) => ({
  sequences: [],
  lastTriggeredAt: {},
  availableRewards: [],
  isLoadingRewards: false,
  activeRunningSequenceId: null,
  activeRunningStepIndex: null,

  hydrate: (sequences) => {
    set({
      sequences: sequences.map((seq) => ({
        id: seq.id,
        enabled: seq.enabled ?? true,
        name: seq.name || 'New Sequence',
        triggerType: seq.triggerType || 'channel_points',
        rewardTitle: seq.rewardTitle ?? '',
        rewardId: seq.rewardId ?? '',
        chatTrigger: seq.chatTrigger ?? '',
        cooldownSeconds: seq.cooldownSeconds ?? 0,
        steps: Array.isArray(seq.steps) ? seq.steps : [],
      })),
    });
  },

  fetchAvailableRewards: async () => {
    set({ isLoadingRewards: true });
    try {
      const res = await rpc.invoke(Channels.TwitchChannelPointsGetRewards);
      if (res && res.ok && Array.isArray(res.rewards)) {
        set({ availableRewards: res.rewards });
      }
    } catch {
      // Ignored if not connected
    } finally {
      set({ isLoadingRewards: false });
    }
  },

  add: () => {
    const id = crypto.randomUUID();
    const newSequence: CommandSequence = {
      id,
      enabled: true,
      name: 'Hydrate Stack',
      triggerType: 'channel_points',
      rewardTitle: 'Hydrate',
      rewardId: '',
      chatTrigger: '!hydrate',
      cooldownSeconds: 15,
      steps: [
        {
          id: crypto.randomUUID(),
          type: 'chat',
          chatMessage: '🥤 Hydrate alert! Drink some water, {username}!',
        },
        {
          id: crypto.randomUUID(),
          type: 'wait',
          waitDuration: 2,
          waitUnit: 'seconds',
        },
        {
          id: crypto.randomUUID(),
          type: 'chat',
          chatMessage: '💧 Refreshed and ready to go!',
        },
      ],
    };

    set((state) => ({ sequences: [...state.sequences, newSequence] }));
    persist(newSequence);
    return id;
  },

  addSmartModTimeoutPreset: () => {
    const id = crypto.randomUUID();
    const newSequence: CommandSequence = {
      id,
      enabled: true,
      name: '⚡ Timeout Anyone (Even Mods!)',
      triggerType: 'channel_points',
      rewardTitle: 'Timeout A Mod',
      rewardId: '',
      chatTrigger: '!timeoutmod',
      cooldownSeconds: 30,
      steps: [
        {
          id: crypto.randomUUID(),
          type: 'chat',
          chatMessage: '🚨 Smart Mod Timeout initiated on @{target} by @{username}!',
        },
        {
          id: crypto.randomUUID(),
          type: 'moderation',
          moderationAction: 'smart_timeout',
          targetUser: '{input}',
          durationSeconds: 60,
          reason: 'Channel Points Timeout by {username}',
        },
        {
          id: crypto.randomUUID(),
          type: 'chat',
          chatMessage: '✅ @{target} has been timed out! (Will be safely re-modded if they are a mod).',
        },
      ],
    };

    set((state) => ({ sequences: [...state.sequences, newSequence] }));
    persist(newSequence);
    return id;
  },

  update: (id, patch) => {
    set((state) => {
      const next = state.sequences.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...patch };
        persist(updated);
        return updated;
      });
      return { sequences: next };
    });
  },

  remove: (id) => {
    set((state) => ({
      sequences: state.sequences.filter((s) => s.id !== id),
    }));
    rpc.invoke(Channels.SequencesDelete, { sequenceId: id }).catch(() => undefined);
  },

  addStep: (sequenceId, type) => {
    const step = defaultStepForType(type);
    set((state) => {
      const next = state.sequences.map((s) => {
        if (s.id !== sequenceId) return s;
        const updated = { ...s, steps: [...s.steps, step] };
        persist(updated);
        return updated;
      });
      return { sequences: next };
    });
  },

  updateStep: (sequenceId, stepId, patch) => {
    set((state) => {
      const next = state.sequences.map((s) => {
        if (s.id !== sequenceId) return s;
        const updatedSteps = s.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st));
        const updated = { ...s, steps: updatedSteps };
        persist(updated);
        return updated;
      });
      return { sequences: next };
    });
  },

  removeStep: (sequenceId, stepId) => {
    set((state) => {
      const next = state.sequences.map((s) => {
        if (s.id !== sequenceId) return s;
        const updatedSteps = s.steps.filter((st) => st.id !== stepId);
        const updated = { ...s, steps: updatedSteps };
        persist(updated);
        return updated;
      });
      return { sequences: next };
    });
  },

  moveStep: (sequenceId, stepIndex, direction) => {
    set((state) => {
      const seq = state.sequences.find((s) => s.id === sequenceId);
      if (!seq) return state;

      const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
      if (targetIndex < 0 || targetIndex >= seq.steps.length) return state;

      const nextSteps = [...seq.steps];
      const [moved] = nextSteps.splice(stepIndex, 1);
      nextSteps.splice(targetIndex, 0, moved);

      const updated = { ...seq, steps: nextSteps };
      persist(updated);

      return {
        sequences: state.sequences.map((s) => (s.id === sequenceId ? updated : s)),
      };
    });
  },

  runSequence: async (id, customContext) => {
    const seq = get().sequences.find((s) => s.id === id);
    if (!seq || !seq.enabled) return false;

    const lastRan = get().lastTriggeredAt[id];
    if (isSequenceOnCooldown(seq, lastRan)) {
      useLogStore.getState().add({ kind: 'cooldown-denied', message: `Sequence [${seq.name}] is on cooldown.` });
      return false;
    }

    set((state) => ({
      activeRunningSequenceId: id,
      activeRunningStepIndex: 0,
      lastTriggeredAt: { ...state.lastTriggeredAt, [id]: Date.now() },
    }));

    const context: SequenceExecutionContext = {
      username: customContext?.username || 'Streamer',
      userLogin: customContext?.userLogin || 'streamer',
      source: customContext?.source || 'test',
      userInput: customContext?.userInput ?? '',
    };

    try {
      const result = await executeSequence(seq, context, {
        sendChatMessage: async (msg) => {
          const res = await rpc.invoke(Channels.TwitchSendChatMessage, { message: msg });
          return Boolean(res?.ok);
        },
        executeCounterAction: async (counterId: string, action: CounterAction) => {
          useCounterStore.getState().triggerAction(counterId, action, 'manual');
        },
        executeCommand: async (trigger: string) => {
          // If the command is a counter command, handle it
          useLogStore.getState().add({ kind: 'trigger', message: `Executed sub-command "${trigger}"` });
        },
        executeModerationAction: async (action, target, durationSeconds, reason) => {
          switch (action) {
            case 'smart_timeout': {
              const res = await rpc.invoke(Channels.TwitchModerationSmartTimeout, {
                target,
                durationSeconds,
                reason,
              });
              return { ok: Boolean(res?.ok), wasMod: Boolean(res?.wasMod), error: res?.error };
            }
            case 'timeout': {
              const res = await rpc.invoke(Channels.TwitchModerationTimeout, {
                target,
                durationSeconds,
                reason,
              });
              return { ok: Boolean(res?.ok), error: res?.error };
            }
            case 'ban': {
              const res = await rpc.invoke(Channels.TwitchModerationBan, { target, reason });
              return { ok: Boolean(res?.ok), error: res?.error };
            }
            case 'unban': {
              const res = await rpc.invoke(Channels.TwitchModerationUnban, { target });
              return { ok: Boolean(res?.ok), error: res?.error };
            }
            case 'mod': {
              const res = await rpc.invoke(Channels.TwitchModerationMod, { target });
              return { ok: Boolean(res?.ok), error: res?.error };
            }
            case 'unmod': {
              const res = await rpc.invoke(Channels.TwitchModerationUnmod, { target });
              return { ok: Boolean(res?.ok), error: res?.error };
            }
            case 'vip': {
              const res = await rpc.invoke(Channels.TwitchModerationVip, { target });
              return { ok: Boolean(res?.ok), error: res?.error };
            }
            case 'unvip': {
              const res = await rpc.invoke(Channels.TwitchModerationUnvip, { target });
              return { ok: Boolean(res?.ok), error: res?.error };
            }
            case 'clear_chat': {
              const res = await rpc.invoke(Channels.TwitchModerationClear);
              return { ok: Boolean(res?.ok), error: res?.error };
            }
            case 'shoutout': {
              const res = await rpc.invoke(Channels.TwitchModerationShoutout, { target });
              return { ok: Boolean(res?.ok), error: res?.error };
            }
            default:
              return { ok: false, error: `Unknown moderation action: ${action}` };
          }
        },
        onStepStart: (index) => {
          set({ activeRunningStepIndex: index });
        },
        onStepComplete: () => {
          // step finished
        },
        log: (kind, message) => {
          useLogStore.getState().add({ kind, message });
        },
      });

      return result.ok;
    } finally {
      set({
        activeRunningSequenceId: null,
        activeRunningStepIndex: null,
      });
    }
  },

  handleChannelPointsRedemption: async (redemption) => {
    const sequences = get().sequences;
    let handled = false;

    for (const seq of sequences) {
      if (!seq.enabled) continue;
      const matches = matchesSequenceTrigger(seq, {
        customRewardId: redemption.rewardId,
        rewardTitle: redemption.rewardTitle,
        chatMessage: redemption.userInput,
      });

      if (matches) {
        handled = true;
        await get().runSequence(seq.id, {
          username: redemption.userName || redemption.userLogin,
          userLogin: redemption.userLogin,
          userId: redemption.userId,
          source: 'channel_points',
          userInput: redemption.userInput,
        });
      }
    }

    return handled;
  },

  handleChatMessage: async (message) => {
    const sequences = get().sequences;
    let handled = false;

    for (const seq of sequences) {
      if (!seq.enabled) continue;
      const matches = matchesSequenceTrigger(seq, {
        customRewardId: message.customRewardId,
        chatMessage: message.message,
      });

      if (matches) {
        handled = true;
        await get().runSequence(seq.id, {
          username: message.username,
          userId: message.userId,
          source: message.customRewardId ? 'channel_points' : 'chat',
          userInput: message.message,
        });
      }
    }

    return handled;
  },
}));
