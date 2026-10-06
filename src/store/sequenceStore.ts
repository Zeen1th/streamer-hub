import { create } from 'zustand';
import type {
  ActionTrigger,
  ActionTriggerType,
  ChannelPointsRedemption,
  ChatMessage,
  CommandSequence,
  CounterAction,
  ObsAudioSourceInfo,
  ObsAutoDetectResult,
  ObsWebsocketStatus,
  SequenceStep,
  SequenceStepType,
  TwitchFollowEvent,
  TwitchRaidEvent,
  TwitchRewardInfo,
  TwitchWatchStreakEvent,
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
import { useConnectionStore } from './connectionStore';
import { useLogStore } from './logStore';
import { useVoteStore } from './voteStore';
import { useSettingsStore } from './settingsStore';
import { duelGameManager } from '../lib/duelGameManager';
import { DEFAULT_OPTION_COLORS } from '../lib/voteRules';
import { MessageDeduplicator } from '../lib/autoReplyRules';

interface SequenceState {
  sequences: CommandSequence[];
  lastTriggeredAt: Record<string, number>;
  availableRewards: TwitchRewardInfo[];
  isLoadingRewards: boolean;
  availableObsAudioSources: ObsAudioSourceInfo[];
  obsConnected: boolean;
  obsStatus: ObsWebsocketStatus | null;
  isLoadingObsSources: boolean;
  activeRunningSequenceId: string | null;
  activeRunningStepIndex: number | null;

  hydrate(sequences: CommandSequence[]): void;
  fetchAvailableRewards(): Promise<void>;
  fetchObsAudioSources(): Promise<void>;
  fetchObsStatus(): Promise<void>;
  connectObs(options?: { host?: string; port?: number; password?: string }): Promise<{ ok: boolean; error?: string }>;
  disconnectObs(): Promise<void>;
  autoDetectObs(): Promise<ObsAutoDetectResult>;
  setObsConnected(connected: boolean): void;
  add(name?: string, options?: Partial<CommandSequence>): string;
  addSmartModTimeoutPreset(): string;
  addRaidShoutoutPreset(): string;
  addTimeoutDuelPreset(): string;
  update(id: string, patch: Partial<CommandSequence>): void;
  remove(id: string): void;
  addTrigger(sequenceId: string, type: ActionTriggerType, options?: Partial<ActionTrigger>): ActionTrigger;
  updateTrigger(sequenceId: string, triggerId: string, patch: Partial<ActionTrigger>): void;
  removeTrigger(sequenceId: string, triggerId: string): void;
  addStep(sequenceId: string, type: SequenceStepType, options?: Partial<SequenceStep>): SequenceStep;
  updateStep(sequenceId: string, stepId: string, patch: Partial<SequenceStep>): void;
  removeStep(sequenceId: string, stepId: string): void;
  moveStep(sequenceId: string, stepIndex: number, direction: 'up' | 'down'): void;
  reorderSteps(sequenceId: string, fromIndex: number, toIndex: number): void;
  runSequence(id: string, customContext?: Partial<SequenceExecutionContext>): Promise<boolean>;
  handleChannelPointsRedemption(redemption: ChannelPointsRedemption): Promise<boolean>;
  handleChatMessage(message: ChatMessage): Promise<boolean>;
  handleRaid(raid: TwitchRaidEvent): Promise<boolean>;
  handleFollow(follow: TwitchFollowEvent): Promise<boolean>;
  handleWatchStreak(streak: TwitchWatchStreakEvent): Promise<boolean>;
}

const persist = (sequence: CommandSequence) => {
  rpc.invoke(Channels.SequencesSave, { sequence }).catch(() => undefined);
};

export const defaultTriggerForType = (type: ActionTriggerType, options?: Partial<ActionTrigger>): ActionTrigger => {
  const id = crypto.randomUUID();
  switch (type) {
    case 'twitch_follow':
      return {
        id,
        type: 'twitch_follow',
        enabled: true,
        ...options,
      };
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
    case 'twitch_watch_streak':
      return {
        id,
        type: 'twitch_watch_streak',
        enabled: true,
        minStreak: options?.minStreak ?? 1,
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
    case 'sound':
      return {
        id,
        type: 'sound',
        soundPath: options?.soundPath ?? '',
        soundVolume: options?.soundVolume ?? 1.0,
        ...options,
      };
    case 'tts':
      return {
        id,
        type: 'tts',
        ttsText: options?.ttsText ?? 'Welcome to the stream {username}!',
        ttsRate: options?.ttsRate ?? 1.0,
        ttsPitch: options?.ttsPitch ?? 1.0,
        ttsVolume: options?.ttsVolume ?? 1.0,
        ...options,
      };
    case 'obs_text':
      return {
        id,
        type: 'obs_text',
        filePath: options?.filePath ?? 'C:\\stream\\latest_follower.txt',
        fileContent: options?.fileContent ?? 'Latest Follower: {username}',
        ...options,
      };
    case 'obs_image':
      return {
        id,
        type: 'obs_image',
        imagePath: options?.imagePath ?? '',
        imageDurationSeconds: options?.imageDurationSeconds ?? 5,
        imagePosition: options?.imagePosition ?? 'center',
        imageAnimation: options?.imageAnimation ?? 'bounce',
        imageScale: options?.imageScale ?? 1.0,
        obsImageDestinationPath: options?.obsImageDestinationPath ?? '',
        ...options,
      };
    case 'duel':
      return {
        id,
        type: 'duel',
        duelMode: options?.duelMode ?? 'ai_trivia',
        duelOpponent: options?.duelOpponent ?? '{input}',
        duelTimeoutDuration: options?.duelTimeoutDuration ?? 60,
        duelTimerSeconds: options?.duelTimerSeconds ?? 30,
        duelChallengerWinChance: options?.duelChallengerWinChance ?? 50,
        duelAllowBroadcaster: options?.duelAllowBroadcaster ?? true,
        duelBroadcasterMuteSource: options?.duelBroadcasterMuteSource ?? '',
        ...options,
      };
    case 'duel_streamer':
      return {
        id,
        type: 'duel_streamer',
        duelMode: options?.duelMode ?? 'ai_trivia',
        duelOpponent: options?.duelOpponent ?? '{broadcaster}',
        duelTimeoutDuration: options?.duelTimeoutDuration ?? 60,
        duelTimerSeconds: options?.duelTimerSeconds ?? 30,
        duelChallengerWinChance: options?.duelChallengerWinChance ?? 50,
        duelAllowBroadcaster: true,
        duelBroadcasterMuteSource: options?.duelBroadcasterMuteSource ?? '',
        duelLanguage: options?.duelLanguage ?? 'auto',
        duelCategory: options?.duelCategory ?? 'general',
        duelInstructions: options?.duelInstructions ?? 'Keep questions simple and focused on popular games like Souls games, Zelda, and Monster Hunter. The answer must be clear, well-known, and 1 to 3 words.',
        duelMessageStart: options?.duelMessageStart ?? '👑 [Streamer Challenge] @{challenger} has challenged Streamer @{streamer}! 🎮 Question: {question} | ⏱️ {timer}s to answer! First to answer wins!',
        duelStreamerWinMessage: options?.duelStreamerWinMessage ?? '👑 Streamer @{streamer} won against @{challenger}! @{challenger} gets timed out for {duration}s! 💀',
        duelStreamerLoseMessage: options?.duelStreamerLoseMessage ?? '💀 Streamer @{streamer} lost against @{challenger}! Streamer is muted in OBS [{source}] for {duration}s! 🔇',
        duelMessageTimeout: options?.duelMessageTimeout ?? "⏰ Time's up! Neither answered! (Answer: {answer}). Streamer is muted for {duration}s and @{challenger} is timed out for {duration}s! 💀",
        ...options,
      };
    case 'poll':
      return {
        id,
        type: 'poll',
        pollAction: options?.pollAction ?? 'start',
        pollQuestion: options?.pollQuestion ?? 'What game should we play next?',
        pollOptions: options?.pollOptions ?? ['Option A', 'Option B'],
        pollDurationSeconds: options?.pollDurationSeconds ?? 60,
        ...options,
      };
    case 'mic_mute':
      return {
        id,
        type: 'mic_mute',
        micMuteDurationSeconds: options?.micMuteDurationSeconds ?? 5,
        micMuteSourceName: options?.micMuteSourceName ?? '',
        ...options,
      };
  }
};

class TimedDeduplicator {
  private readonly entries = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(ttlMs = 2500) {
    this.ttlMs = ttlMs;
  }

  isDuplicate(id: string | undefined): boolean {
    if (!id) return false;
    const now = Date.now();
    const prev = this.entries.get(id);
    if (prev && now - prev < this.ttlMs) {
      return true;
    }
    this.entries.set(id, now);
    if (this.entries.size > 200) {
      for (const [k, time] of this.entries.entries()) {
        if (now - time > this.ttlMs) this.entries.delete(k);
      }
    }
    return false;
  }

  clear(): void {
    this.entries.clear();
  }
}

const messageDeduplicator = new MessageDeduplicator(500);
const redemptionDeduplicator = new TimedDeduplicator(2500);

export const useSequenceStore = create<SequenceState>((set, get) => ({
  sequences: [],
  lastTriggeredAt: {},
  availableRewards: [],
  isLoadingRewards: false,
  availableObsAudioSources: [],
  obsConnected: false,
  obsStatus: null,
  isLoadingObsSources: false,
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

  fetchObsAudioSources: async () => {
    set({ isLoadingObsSources: true });
    try {
      const res = await rpc.invoke(Channels.ObsGetAudioSources);
      if (res && res.ok && Array.isArray(res.sources)) {
        set({
          availableObsAudioSources: res.sources,
          obsConnected: Boolean(res.connected),
        });
      } else if (res) {
        set({ obsConnected: Boolean(res.connected) });
      }
    } catch {
      // Ignored if not connected
    } finally {
      set({ isLoadingObsSources: false });
    }
  },

  fetchObsStatus: async () => {
    try {
      const status = await rpc.invoke(Channels.ObsWebsocketGetStatus);
      if (status) {
        set({
          obsStatus: status,
          obsConnected: Boolean(status.connected),
        });
      }
    } catch {
      // Ignored
    }
  },

  connectObs: async (options) => {
    set({ isLoadingObsSources: true });
    try {
      const res = await rpc.invoke(Channels.ObsWebsocketConnect, options || {});
      await get().fetchObsStatus();
      if (res.ok) {
        await get().fetchObsAudioSources();
      }
      return res;
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Connection failed' };
    } finally {
      set({ isLoadingObsSources: false });
    }
  },

  disconnectObs: async () => {
    try {
      await rpc.invoke(Channels.ObsWebsocketDisconnect);
      set({ obsConnected: false, availableObsAudioSources: [] });
      await get().fetchObsStatus();
    } catch {
      // Ignored
    }
  },

  autoDetectObs: async () => {
    try {
      return await rpc.invoke(Channels.ObsWebsocketAutoDetect);
    } catch {
      return { found: false, host: '127.0.0.1', port: 4455, authRequired: false };
    }
  },

  setObsConnected: (connected: boolean) => {
    set({ obsConnected: connected });
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

  addTimeoutDuelPreset: () => {
    const id = crypto.randomUUID();
    const newSequence: CommandSequence = {
      id,
      enabled: true,
      name: '⚔️ Timeout Duel (Random or AI Trivia)',
      triggerType: 'chat',
      cooldownSeconds: 15,
      triggers: [
        {
          id: crypto.randomUUID(),
          type: 'twitch_chat',
          enabled: true,
          chatCommand: '!duel',
          matchMode: 'startsWith',
        },
        {
          id: crypto.randomUUID(),
          type: 'twitch_channel_points',
          enabled: true,
          rewardId: '',
          rewardTitle: 'Timeout Duel',
        },
      ],
      steps: [
        {
          id: crypto.randomUUID(),
          type: 'duel',
          duelMode: 'ai_trivia',
          duelOpponent: '{input}',
          duelTimeoutDuration: 60,
          duelTimerSeconds: 30,
          duelLanguage: 'auto',
          duelCategory: 'general',
          duelInstructions: 'Keep questions simple and focused on popular games like Souls games, Zelda, and Monster Hunter. The answer must be clear, well-known, and 1 to 3 words.',
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

  reorderSteps: (sequenceId, fromIndex, toIndex) => {
    set((state) => {
      const seq = state.sequences.find((s) => s.id === sequenceId);
      if (!seq) return state;
      if (fromIndex < 0 || fromIndex >= seq.steps.length || toIndex < 0 || toIndex >= seq.steps.length) return state;
      if (fromIndex === toIndex) return state;

      const nextSteps = [...seq.steps];
      const [moved] = nextSteps.splice(fromIndex, 1);
      nextSteps.splice(toIndex, 0, moved);

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

    // Prevent re-entrant double execution if this sequence is already running
    if (get().activeRunningSequenceId === id) {
      useLogStore.getState().add({ kind: 'trigger', message: `Sequence [${seq.name}] is already running, skipping duplicate trigger.` });
      return false;
    }

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
        playSound: async (soundPath, volume) => {
          const res = await rpc.invoke(Channels.AudioPlaySound, { soundPath, volume });
          return Boolean(res?.ok);
        },
        speakTts: async (text, voiceName, rate, pitch, volume) => {
          try {
            const res = await rpc.invoke(Channels.AudioSpeakTts, {
              text,
              voiceName: voiceName || undefined,
              rate,
              pitch,
              volume,
            });
            if (res?.ok) {
              // If not played directly by host desktop player, play via WebView2 HTML5 Audio
              if (!res.playedOnHost && res.audioBase64) {
                const audio = new Audio(`data:audio/mp3;base64,${res.audioBase64}`);
                audio.volume = Math.max(0, Math.min(volume ?? 1.0, 1.0));
                await new Promise<void>((resolve) => {
                  audio.onended = () => resolve();
                  audio.onerror = () => resolve();
                  audio.play().catch(() => resolve());
                });
              }
              return true;
            }
          } catch { }

          return false;
        },
        writeObsText: async (filePath, content) => {
          const res = await rpc.invoke(Channels.ObsWrite, { filePath, content });
          return Boolean(res?.ok);
        },
        showObsImage: async (step) => {
          try {
            const res = await rpc.invoke(Channels.ChatOverlayShowImage, {
              imagePath: step.imagePath,
              durationSeconds: step.imageDurationSeconds ?? 5,
              position: step.imagePosition ?? 'center',
              animation: step.imageAnimation ?? 'bounce',
              imageScale: step.imageScale ?? 1.0,
              obsImageDestinationPath: step.obsImageDestinationPath,
            });
            return Boolean(res?.ok);
          } catch {
            return false;
          }
        },
        executeDuel: async (step, ctx) => {
          const broadcaster = useConnectionStore.getState().twitchChannel?.replace(/^#+/, '');
          const appLang = useSettingsStore.getState().language;
          const resolvedLang =
            step.duelLanguage === 'auto' || !step.duelLanguage
              ? (appLang === 'ar' ? 'ar' : 'en')
              : step.duelLanguage;

          const isStreamerDuel = step.type === 'duel_streamer';
          const defaultOpponent = isStreamerDuel ? (broadcaster || 'Streamer') : (ctx.userInput || '');

          const res = await duelGameManager.startDuel({
            challenger: ctx.username,
            opponentRaw: step.duelOpponent || defaultOpponent,
            mode: step.duelMode || 'random',
            challengerWinChance: step.duelChallengerWinChance ?? 50,
            allowBroadcaster: isStreamerDuel || (step.duelAllowBroadcaster ?? true),
            broadcasterMuteSource: step.duelBroadcasterMuteSource || '',
            timeoutDuration: step.duelTimeoutDuration ?? 60,
            timerSeconds: step.duelTimerSeconds ?? 30,
            broadcasterName: broadcaster,
            isStreamerDuel,
            streamerWinMessage: step.duelStreamerWinMessage,
            streamerLoseMessage: step.duelStreamerLoseMessage,
            language: resolvedLang,
            category: step.duelCategory,
            customInstructions: step.duelInstructions,
            messageStart: step.duelMessageStart,
            messageWin: step.duelMessageWin,
            messageTimeout: step.duelMessageTimeout,
            sinks: {
              sendChatMessage: async (msg) => {
                await rpc.invoke(Channels.TwitchSendChatMessage, { message: msg });
                return true;
              },
              smartModTimeout: async (target, duration, reason) => {
                return await rpc.invoke(Channels.TwitchModerationSmartTimeout, {
                  target,
                  durationSeconds: duration,
                  reason,
                });
              },
              muteStreamerSource: async (sourceName, duration) => {
                const res = await rpc.invoke(Channels.ObsMuteSource, {
                  sourceName: sourceName || step.duelBroadcasterMuteSource || undefined,
                  durationSeconds: duration,
                });
                return Boolean(res?.ok);
              },
              generateTrivia: async (payload) => {
                return await rpc.invoke(Channels.AiGenerateTrivia, payload);
              },
              log: (kind, msg) => {
                useLogStore.getState().addLocal({ kind: kind as any, message: msg });
              },
            },
          });
          return res.ok;
        },
        executePollAction: async (action, question, options, durationSeconds) => {
          const voteStore = useVoteStore.getState();
          if (action === 'start') {
            if (question) voteStore.setTitle(question);
            if (options && options.length > 0) {
              const newPoll = {
                ...voteStore.poll,
                title: question || voteStore.poll.title,
                options: options.map((opt, idx) => ({
                  id: `opt-${idx + 1}`,
                  key: String(idx + 1),
                  label: opt,
                  votes: 0,
                  color: DEFAULT_OPTION_COLORS[idx % DEFAULT_OPTION_COLORS.length],
                })),
              };
              await voteStore.savePoll(newPoll);
            }
            return await voteStore.startPoll(durationSeconds);
          } else if (action === 'end') {
            return await voteStore.endPoll();
          } else if (action === 'reset') {
            return await voteStore.resetVotes();
          }
          return false;
        },
        muteMic: async (durationSeconds, sourceName) => {
          const res = await rpc.invoke(Channels.ObsMuteSource, {
            sourceName: sourceName || undefined,
            durationSeconds,
          });
          return Boolean(res?.ok);
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
    if (redemption.id && redemptionDeduplicator.isDuplicate(redemption.id)) {
      return false;
    }
    const semanticKey = `cp:${redemption.rewardId}::${redemption.userId}::${redemption.userInput?.trim() ?? ''}`;
    if (redemptionDeduplicator.isDuplicate(semanticKey)) {
      return false;
    }

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
    // Check if chatter (including broadcaster testing or participating) is answering an active timeout trivia duel
    const duelHandled = await duelGameManager.handleChatMessage(message);
    if (duelHandled) return true;

    if (message.isSelf || message.id?.startsWith('self-')) return false;

    if (message.id && messageDeduplicator.isDuplicate(message.id)) {
      return false;
    }

    // If message was generated by a channel points redemption, ignore for sequence triggering (already handled by handleChannelPointsRedemption)
    if (message.customRewardId) {
      return false;
    }

    const sequences = get().sequences;
    let handled = false;

    for (const seq of sequences) {
      if (!seq.enabled) continue;
      const matches = matchesSequenceTrigger(seq, {
        chatMessage: message.message,
      });

      if (matches) {
        handled = true;
        const userInput = extractCommandArguments(message.message, seq.chatTrigger || '');

        await get().runSequence(seq.id, {
          username: message.username,
          userId: message.userId,
          source: 'chat',
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

  handleFollow: async (follow) => {
    const sequences = get().sequences;
    let handled = false;

    for (const seq of sequences) {
      if (!seq.enabled) continue;
      const matches = matchesSequenceTrigger(seq, { follow });

      if (matches) {
        handled = true;
        await get().runSequence(seq.id, {
          username: follow.userName || follow.userLogin,
          userLogin: follow.userLogin,
          userId: follow.userId,
          source: 'follow',
          userInput: `@${follow.userName || follow.userLogin}`,
        });
      }
    }

    return handled;
  },

  handleWatchStreak: async (event) => {
    const sequences = get().sequences;
    let handled = false;

    for (const seq of sequences) {
      if (!seq.enabled) continue;
      const matches = matchesSequenceTrigger(seq, {
        watchStreak: {
          userId: event.userId,
          userName: event.userName,
          userLogin: event.userLogin,
          streak: event.streak,
          message: event.message,
        },
      });

      if (matches) {
        handled = true;
        await get().runSequence(seq.id, {
          username: event.userName || event.userLogin,
          userLogin: event.userLogin,
          userId: event.userId,
          source: 'watch_streak',
          streak: event.streak,
          userInput: event.message || '',
        });
      }
    }

    return handled;
  },
}));
