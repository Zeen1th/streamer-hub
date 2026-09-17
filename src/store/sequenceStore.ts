import { create } from 'zustand';
import type {
  ActionTrigger,
  ActionTriggerType,
  ChannelPointsRedemption,
  ChatMessage,
  CommandSequence,
  CounterAction,
  SequenceStep,
  SequenceStepType,
  TwitchRaidEvent,
  TwitchRewardInfo,
} from '../rpc/contracts';
import { Channels } from '../rpc/contracts';
import { rpc } from '../rpc';
import {
  executeSequence,
  extractCommandArguments,
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
  add(name?: string, options?: Partial<CommandSequence>): string;
  addSmartModTimeoutPreset(): string;
  addRaidShoutoutPreset(): string;
  update(id: string, patch: Partial<CommandSequence>): void;
  remove(id: string): void;
  addTrigger(sequenceId: string, type: ActionTriggerType, options?: Partial<ActionTrigger>): ActionTrigger;
  updateTrigger(sequenceId: string, triggerId: string, patch: Partial<ActionTrigger>): void;
  removeTrigger(sequenceId: string, triggerId: string): void;
  addStep(sequenceId: string, type: SequenceStepType, options?: Partial<SequenceStep>): SequenceStep;
  updateStep(sequenceId: string, stepId: string, patch: Partial<SequenceStep>): void;
  removeStep(sequenceId: string, stepId: string): void;
  moveStep(sequenceId: string, stepIndex: number, direction: 'up' | 'down'): void;
  runSequence(id: string, customContext?: Partial<SequenceExecutionContext>): Promise<boolean>;
  handleChannelPointsRedemption(redemption: ChannelPointsRedemption): Promise<boolean>;
  handleChatMessage(message: ChatMessage): Promise<boolean>;
  handleRaid(raid: TwitchRaidEvent): Promise<boolean>;
}

const persist = (sequence: CommandSequence) => {
  rpc.invoke(Channels.SequencesSave, { sequence }).catch(() => undefined);
};

export const defaultTriggerForType = (type: ActionTriggerType, options?: Partial<ActionTrigger>): ActionTrigger => {
  const id = crypto.randomUUID();
  switch (type) {
    case 'twitch_raid':
      return {
        id,
        type: 'twitch_raid',
        enabled: true,
        minViewers: options?.minViewers ?? 1,
        ...options,
      };
    case 'twitch_chat':
      return {
        id,
        type: 'twitch_chat',
        enabled: true,
        chatCommand: options?.chatCommand ?? '!command',
        matchMode: options?.matchMode ?? 'startsWith',
        ...options,
      };
    case 'twitch_channel_points':
      return {
        id,
        type: 'twitch_channel_points',
        enabled: true,
        rewardId: options?.rewardId ?? '',
        rewardTitle: options?.rewardTitle ?? 'Custom Reward',
        ...options,
      };
  }
};

export const normalizeTriggers = (seq: CommandSequence): ActionTrigger[] => {
  if (Array.isArray(seq.triggers)) {
    return seq.triggers;
  }
  const result: ActionTrigger[] = [];
  const triggerType = seq.triggerType;

  if (triggerType === 'channel_points' || triggerType === 'both') {
    if (seq.rewardTitle || seq.rewardId) {
      result.push({
        id: crypto.randomUUID(),
        type: 'twitch_channel_points',
        enabled: true,
        rewardId: seq.rewardId || '',
        rewardTitle: seq.rewardTitle || 'Reward',
      });
    }
  }

  if (triggerType === 'chat' || triggerType === 'both') {
    if (seq.chatTrigger) {
      result.push({
        id: crypto.randomUUID(),
        type: 'twitch_chat',
        enabled: true,
        chatCommand: seq.chatTrigger,
        matchMode: 'startsWith',
      });
    }
  }

  return result;
};

const defaultStepForType = (type: SequenceStepType, options?: Partial<SequenceStep>): SequenceStep => {
  const id = crypto.randomUUID();
  switch (type) {
    case 'comment':
      return { id, type: 'comment', commentText: options?.commentText ?? '** This is a comment! **', ...options };
    case 'wait':
      return { id, type: 'wait', waitDuration: 3, waitUnit: 'seconds', ...options };
    case 'chat':
      return { id, type: 'chat', chatMessage: 'Drinking water! Thanks {username} 🥤', ...options };
    case 'counter':
      return { id, type: 'counter', counterAction: 'increase', ...options };
    case 'command':
      return { id, type: 'command', commandTrigger: '!sound', ...options };
    case 'moderation':
      return {
        id,
        type: 'moderation',
        moderationAction: 'smart_timeout',
        targetUser: '{input}',
        durationSeconds: 60,
        reason: 'Channel Points Timeout',
        ...options,
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
        triggers: normalizeTriggers(seq),
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

  add: (name?: string, options?: Partial<CommandSequence>) => {
    const id = crypto.randomUUID();
    const newSequence: CommandSequence = {
      id,
      enabled: true,
      name: name || 'New Action',
      triggerType: 'chat',
      rewardTitle: '',
      rewardId: '',
      chatTrigger: '',
      cooldownSeconds: 0,
      triggers: options?.triggers ?? [],
      steps: options?.steps ?? [],
      ...options,
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
      triggers: [
        {
          id: crypto.randomUUID(),
          type: 'twitch_chat',
          enabled: true,
          chatCommand: '!timeoutmod',
          matchMode: 'startsWith',
        },
        {
          id: crypto.randomUUID(),
          type: 'twitch_channel_points',
          enabled: true,
          rewardId: '',
          rewardTitle: 'Timeout A Mod',
        },
      ],
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

  addRaidShoutoutPreset: () => {
    const id = crypto.randomUUID();
    const newSequence: CommandSequence = {
      id,
      enabled: true,
      name: '🎉 Twitch Raid Shoutout & Welcome',
      triggerType: 'chat',
      cooldownSeconds: 10,
      triggers: [
        {
          id: crypto.randomUUID(),
          type: 'twitch_raid',
          enabled: true,
          minViewers: 1,
        },
      ],
      steps: [
        {
          id: crypto.randomUUID(),
          type: 'moderation',
          moderationAction: 'shoutout',
          targetUser: '{raider}',
        },
        {
          id: crypto.randomUUID(),
          type: 'wait',
          waitDuration: 1,
          waitUnit: 'seconds',
        },
        {
          id: crypto.randomUUID(),
          type: 'chat',
          chatMessage: '🎉 Welcome raiders from @{raider}! Thank you for the raid with {viewers} viewers! Check them out at twitch.tv/{raider} 💜',
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

  addTrigger: (sequenceId, type, options) => {
    const trigger = defaultTriggerForType(type, options);
    set((state) => {
      const next = state.sequences.map((s) => {
        if (s.id !== sequenceId) return s;
        const currentTriggers = s.triggers ?? [];
        const updated = { ...s, triggers: [...currentTriggers, trigger] };
        persist(updated);
        return updated;
      });
      return { sequences: next };
    });
    return trigger;
  },

  updateTrigger: (sequenceId, triggerId, patch) => {
    set((state) => {
      const next = state.sequences.map((s) => {
        if (s.id !== sequenceId) return s;
        const currentTriggers = s.triggers ?? [];
        const updatedTriggers = currentTriggers.map((t) => (t.id === triggerId ? { ...t, ...patch } : t));
        const updated = { ...s, triggers: updatedTriggers };
        persist(updated);
        return updated;
      });
      return { sequences: next };
    });
  },

  removeTrigger: (sequenceId, triggerId) => {
    set((state) => {
      const next = state.sequences.map((s) => {
        if (s.id !== sequenceId) return s;
        const currentTriggers = s.triggers ?? [];
        const updatedTriggers = currentTriggers.filter((t) => t.id !== triggerId);
        const updated = { ...s, triggers: updatedTriggers };
        persist(updated);
        return updated;
      });
      return { sequences: next };
    });
  },

  addStep: (sequenceId, type, options) => {
    const step = defaultStepForType(type, options);
    set((state) => {
      const next = state.sequences.map((s) => {
        if (s.id !== sequenceId) return s;
        const updated = { ...s, steps: [...s.steps, step] };
        persist(updated);
        return updated;
      });
      return { sequences: next };
    });
    return step;
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
      userId: customContext?.userId,
      source: customContext?.source || 'test',
      userInput: customContext?.userInput ?? '',
      raider: customContext?.raider,
      viewers: customContext?.viewers,
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
    if (message.isSelf || message.id?.startsWith('self-')) return false;
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
        const userInput = message.customRewardId
          ? message.message
          : extractCommandArguments(message.message, seq.chatTrigger || '');

        await get().runSequence(seq.id, {
          username: message.username,
          userId: message.userId,
          source: message.customRewardId ? 'channel_points' : 'chat',
          userInput,
        });
      }
    }

    return handled;
  },

  handleRaid: async (raid) => {
    const sequences = get().sequences;
    let handled = false;

    for (const seq of sequences) {
      if (!seq.enabled) continue;
      const matches = matchesSequenceTrigger(seq, { raid });

      if (matches) {
        handled = true;
        await get().runSequence(seq.id, {
          username: raid.fromUserName || raid.fromUserLogin,
          userLogin: raid.fromUserLogin,
          userId: raid.fromUserId,
          source: 'raid',
          raider: raid.fromUserName || raid.fromUserLogin,
          viewers: raid.viewers,
          userInput: `@${raid.fromUserName || raid.fromUserLogin}`,
        });
      }
    }

    return handled;
  },
}));
