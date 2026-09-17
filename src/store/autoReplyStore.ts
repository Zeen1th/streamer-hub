import { create } from 'zustand';
import type { AutoReply, AutoReplySettings, ChatMessage, TitleCounter } from '../rpc/contracts';
import { Channels } from '../rpc/contracts';
import { rpc } from '../rpc';
import {
  checkUserRestriction,
  cooldownRemainingSeconds,
  evaluateRuleExecution,
  isSenderIgnoredForAutoReply,
  matchesAnyAutoReply,
  MessageDeduplicator,
  nextTitleCounters,
  renderAutoReply,
  renderStreamTitle,
  selectBestMatchingAutoReply,
  stripAutoReplyFromTitle,
  titleActionDirection,
} from '../lib/autoReplyRules';
import { hasPermission } from '../lib/counterRules';
import { titleUpdateQueue } from '../lib/titleUpdateQueue';
import { useLogStore } from './logStore';
import { useSettingsStore } from './settingsStore';
import { useConnectionStore } from './connectionStore';

interface AutoReplyState {
  rules: AutoReply[];
  lastTriggeredAt: Record<string, number>;
  lastUserTriggeredAt: Record<string, number>;
  lastAiTriggeredAt: number | null;
  lastAiUserTriggeredAt: Record<string, number>;
  isAiGenerating: boolean;
  globalSettings: AutoReplySettings;
  hydrateGlobalSettings(settings: AutoReplySettings): void;
  updateGlobalSettings(patch: Partial<AutoReplySettings>): void;
  hydrate(rules: AutoReply[]): void;
  add(): string;
  update(id: string, patch: Partial<AutoReply>): void;
  remove(id: string): void;
  triggerTitleAction(id: string, action: 'increase' | 'decrease' | 'reset' | 'apply'): boolean;
  detachTitleAction(id: string): Promise<boolean>;
  handleChatMessage(message: ChatMessage): void;
}

const persist = (rule: AutoReply) => {
  rpc.invoke(Channels.AutoRepliesSave, { rule }).catch(() => undefined);
};

const messageDeduplicator = new MessageDeduplicator(500);

export const useAutoReplyStore = create<AutoReplyState>((set, get) => ({
  rules: [],
  lastTriggeredAt: {},
  lastUserTriggeredAt: {},
  lastAiTriggeredAt: null,
  lastAiUserTriggeredAt: {},
  isAiGenerating: false,
  globalSettings: { globalAiCooldownSeconds: 0, globalAiUserCooldownSeconds: 60 },
  hydrateGlobalSettings: (settings) => set({ globalSettings: { globalAiCooldownSeconds: settings.globalAiCooldownSeconds ?? 0, globalAiUserCooldownSeconds: settings.globalAiUserCooldownSeconds ?? 60 } }),
  updateGlobalSettings: (patch) => {
    const globalSettings = { ...get().globalSettings, ...patch };
    set({ globalSettings });
    rpc.invoke(Channels.AutoRepliesSettingsSave, globalSettings).catch(() => undefined);
  },
  hydrate: (rules) => set({ rules: rules.map((rule) => {
    const legacy = rule as AutoReply & { trigger?: string };
    return {
      ...rule,
      triggers: rule.triggers?.length ? rule.triggers : legacy.trigger ? [legacy.trigger] : [''],
      responseEnabled: rule.responseEnabled ?? true,
      matchMode: rule.matchMode ?? 'exact',
      userCooldownSeconds: rule.userCooldownSeconds ?? 0,
      titleActionEnabled: rule.titleActionEnabled ?? false,
      titleTemplate: rule.titleTemplate ?? '',
      titleStart: Math.max(0, Math.trunc(rule.titleStart ?? 1)),
      titleCount: Math.max(0, Math.trunc(rule.titleCount ?? rule.titleStart ?? 1)),
      titleIncreaseCommand: rule.titleIncreaseCommand ?? '',
      titleDecreaseCommand: rule.titleDecreaseCommand ?? '',
      themeActionEnabled: rule.themeActionEnabled ?? false,
      themeActionMode: rule.themeActionMode === 'light' ? 'light' : 'dark',
      titleCounters: rule.titleCounters?.length ? rule.titleCounters.map((counter) => ({ ...counter, start: Math.max(0, Math.trunc(counter.start)), count: Math.max(0, Math.trunc(counter.count)) })) : [{ id: 'count1', start: Math.max(0, Math.trunc(rule.titleStart ?? 1)), count: Math.max(0, Math.trunc(rule.titleCount ?? rule.titleStart ?? 1)) }],
      responseMode: rule.responseMode ?? 'static',
      minimumRank: rule.minimumRank ?? 'everyone',
      aiUserCooldownSeconds: rule.aiUserCooldownSeconds ?? 60,
      aiInstructions: rule.aiInstructions ?? '',
      aiModel: rule.aiModel ?? (rule.aiProvider === 'openrouter' ? 'meta-llama/llama-3.2-3b-instruct:free' : 'llama-3.1-8b-instant'),
      aiProvider: rule.aiProvider ?? 'groq',
      aiMaxTokens: rule.aiMaxTokens ?? 120,
      aiFallback: rule.aiFallback ?? '',
      aiUserRestriction: rule.aiUserRestriction ?? 'none',
      aiTargetUsers: rule.aiTargetUsers ?? [],
    };
  }) }),
  add: () => {
    const rule: AutoReply = {
      id: crypto.randomUUID(),
      triggers: [''],
      response: '',
      enabled: true,
      responseEnabled: false,
      cooldownSeconds: 30,
      userCooldownSeconds: 0,
      titleActionEnabled: false,
      titleTemplate: '',
      titleStart: 1,
      titleCount: 1,
      titleIncreaseCommand: '',
      titleDecreaseCommand: '',
      themeActionEnabled: false,
      themeActionMode: 'dark',
      titleCounters: [{ id: 'count1', start: 1, count: 1 }],
      minimumRank: 'everyone',
      aiUserCooldownSeconds: 60,
      matchMode: 'exact',
      responseMode: 'static',
      aiInstructions: '',
      aiModel: 'llama-3.1-8b-instant',
      aiProvider: 'groq',
      aiMaxTokens: 120,
      aiFallback: '',
      aiUserRestriction: 'none',
      aiTargetUsers: [],
    };
    set((state) => ({ rules: [...state.rules, rule] }));
    persist(rule);
    return rule.id;
  },
  update: (id, patch) => {
    const prev = get().rules.find((item) => item.id === id);
    set((state) => ({ rules: state.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)) }));
    const rule = get().rules.find((item) => item.id === id);
    if (rule) {
      persist(rule);
      if (patch.titleActionEnabled === false && prev?.titleActionEnabled) {
        void titleUpdateQueue.enqueue(async () => {
          try {
            const titleRes = await rpc.invoke(Channels.TwitchGetTitle, undefined);
            if (titleRes.ok && titleRes.title) {
              const cleanTitle = stripAutoReplyFromTitle(titleRes.title, rule.titleTemplate);
              if (cleanTitle && cleanTitle !== titleRes.title) {
                await rpc.invoke(Channels.TwitchUpdateTitle, { title: cleanTitle });
                useLogStore.getState().add({
                  kind: 'system',
                  message: `Auto title · Restored clean stream title: "${cleanTitle}"`,
                });
              }
            }
          } catch {}
        });
      }
    }
  },
  remove: (id) => {
    set((state) => ({
      rules: state.rules.filter((rule) => rule.id !== id),
      lastTriggeredAt: Object.fromEntries(Object.entries(state.lastTriggeredAt).filter(([key]) => key !== id)),
      lastUserTriggeredAt: state.lastUserTriggeredAt,
      lastAiUserTriggeredAt: state.lastAiUserTriggeredAt,
    }));
    rpc.invoke(Channels.AutoRepliesDelete, { ruleId: id }).catch(() => undefined);
  },
  triggerTitleAction: (id, action) => {
    const rule = get().rules.find((item) => item.id === id && (item.titleActionEnabled || action === 'apply') && item.titleTemplate?.trim());
    if (!rule) return false;
    const now = Date.now();
    if (cooldownRemainingSeconds(now, get().lastTriggeredAt[id] ?? null, rule.cooldownSeconds) !== null) return false;
    set((state) => ({ lastTriggeredAt: { ...state.lastTriggeredAt, [id]: now } }));
    const nextUpdate = titleUpdateQueue.enqueue(async () => {
      const currentRule = get().rules.find((item) => item.id === id);
      if (!currentRule) return;

      let currentTitle: string | null = null;
      try {
        const titleRes = await rpc.invoke(Channels.TwitchGetTitle, undefined);
        if (titleRes.ok && titleRes.title) currentTitle = titleRes.title;
      } catch {}

      const counters = currentRule.titleCounters?.length
        ? currentRule.titleCounters
        : [{ id: 'count1', start: currentRule.titleStart ?? 1, count: currentRule.titleCount ?? currentRule.titleStart ?? 1 }];
      const nextCounters: TitleCounter[] = action === 'reset'
        ? counters.map((counter) => ({ ...counter, count: Math.max(0, Math.trunc(counter.start)) }))
        : action === 'increase' || action === 'decrease'
          ? nextTitleCounters(counters, action)
          : counters;
      const values = Object.fromEntries(nextCounters.map((counter, index) => ['count' + (index + 1), Math.max(0, Math.trunc(counter.count))]));
      const title = renderStreamTitle(currentRule.titleTemplate ?? '', values, currentTitle).trim();
      if (!title) return;
      const result = await rpc.invoke(Channels.TwitchUpdateTitle, { title });
      if (result.ok && action !== 'apply') {
        get().update(currentRule.id, { titleCounters: nextCounters, titleCount: nextCounters[0]?.count ?? 1 });
      }
    });
    void nextUpdate.catch(() => undefined);
    return true;
  },
  detachTitleAction: async (id) => {
    const rule = get().rules.find((item) => item.id === id);
    if (!rule) return false;
    try {
      get().update(id, { titleActionEnabled: false });
      await titleUpdateQueue.enqueue(async () => {
        const titleRes = await rpc.invoke(Channels.TwitchGetTitle, undefined);
        if (titleRes.ok && titleRes.title) {
          const cleanTitle = stripAutoReplyFromTitle(titleRes.title, rule.titleTemplate);
          if (cleanTitle && cleanTitle !== titleRes.title) {
            await rpc.invoke(Channels.TwitchUpdateTitle, { title: cleanTitle });
            useLogStore.getState().add({
              kind: 'system',
              message: `Auto title · Detached from title: "${cleanTitle}"`,
            });
          }
        }
      });
      return true;
    } catch {
      return false;
    }
  },
  handleChatMessage: (message) => {
    const connection = useConnectionStore.getState();
    if (isSenderIgnoredForAutoReply(message, connection.twitchChannel, connection.botLogin)) {
      return;
    }

    // Reject message if already processed (duplicate delivery/IRC replay)
    if (message.id && messageDeduplicator.isDuplicate(message.id)) {
      return;
    }

    const now = Date.now();
    const candidates = get().rules.filter((item) => {
      if (!item.enabled) return false;
      if (!hasPermission(message, item.minimumRank ?? 'everyone')) return false;

      if (item.responseMode === 'ai' && !checkUserRestriction(item.aiUserRestriction, item.aiTargetUsers, message)) {
        return false;
      }

      const triggerMatches = (item.responseEnabled !== false || item.themeActionEnabled) && matchesAnyAutoReply(message.message, item.triggers, item.matchMode);
      const titleMatches = item.titleActionEnabled && (matchesAnyAutoReply(message.message, item.triggers, item.matchMode) || titleActionDirection(message.message, item.titleIncreaseCommand ?? '', item.titleDecreaseCommand ?? '', item.matchMode) !== null);

      return triggerMatches || titleMatches;
    });

    const rule = selectBestMatchingAutoReply(candidates, message.username, message);
    if (!rule) return;
    const remaining = cooldownRemainingSeconds(now, get().lastTriggeredAt[rule.id] ?? null, rule.cooldownSeconds);
    if (remaining !== null) return;
    const userKey = message.username.trim().toLowerCase();
    if (rule.themeActionEnabled && matchesAnyAutoReply(message.message, rule.triggers, rule.matchMode)) {
      useSettingsStore.getState().setTheme(rule.themeActionMode === 'light' ? 'light' : 'dark');
    }
    if (rule.titleActionEnabled && rule.titleTemplate?.trim()) {
      const direction = titleActionDirection(
        message.message,
        rule.titleIncreaseCommand ?? '',
        rule.titleDecreaseCommand ?? '',
        rule.matchMode,
      );
      const baseTriggerMatched = matchesAnyAutoReply(message.message, rule.triggers, rule.matchMode);
      if (direction || baseTriggerMatched) {
        const nextUpdate = titleUpdateQueue.enqueue(async () => {
          const currentRule = get().rules.find((item) => item.id === rule.id);
          if (!currentRule || !currentRule.titleActionEnabled) return;

          let currentTitle: string | null = null;
          try {
            const titleRes = await rpc.invoke(Channels.TwitchGetTitle, undefined);
            if (titleRes.ok && titleRes.title) currentTitle = titleRes.title;
          } catch {}

          const counters = currentRule.titleCounters?.length ? currentRule.titleCounters : [{ id: 'count1', start: currentRule.titleStart ?? 1, count: currentRule.titleCount ?? currentRule.titleStart ?? 1 }];
          const nextCounters: TitleCounter[] = direction ? nextTitleCounters(counters, direction) : counters;
          const values = Object.fromEntries(nextCounters.map((counter, index) => ['count' + (index + 1), Math.max(0, Math.trunc(counter.count))]));
          const title = renderStreamTitle(currentRule.titleTemplate ?? '', values, currentTitle).trim();
          if (!title) return;
          const result = await rpc.invoke(Channels.TwitchUpdateTitle, { title });
          if (result.ok && direction) {
            get().update(currentRule.id, { titleCounters: nextCounters, titleCount: nextCounters[0]?.count ?? 1 });
          }
        });
        void nextUpdate.catch(() => undefined);
      }
    }

    if (rule.responseEnabled === false) return;

    const plan = evaluateRuleExecution(rule, message);
    if (plan.type === 'ignore') return;

    if (plan.type === 'ai') {
      // 1. In-flight guard: prevent concurrent AI requests from firing at the same time
      if (get().isAiGenerating) {
        return;
      }

      // 2. Global AI cooldown check (enforce minimum 3s safety interval to prevent rapid double-bursts)
      const configuredGlobalCooldown = get().globalSettings.globalAiCooldownSeconds ?? 0;
      const effectiveGlobalCooldown = Math.max(configuredGlobalCooldown, 3);
      const globalRemaining = cooldownRemainingSeconds(now, get().lastAiTriggeredAt, effectiveGlobalCooldown);
      if (globalRemaining !== null) return;

      // 3. User AI cooldown check (enforce minimum 5s safety interval per chatter)
      const configuredUserCooldown = get().globalSettings.globalAiUserCooldownSeconds ?? 60;
      const effectiveUserCooldown = Math.max(configuredUserCooldown, 5);
      const userKeyId = `ai:${userKey}`;
      const userRemaining = cooldownRemainingSeconds(now, get().lastUserTriggeredAt[userKeyId] ?? null, effectiveUserCooldown);
      if (userRemaining !== null) return;

      // 4. Mark generating in-flight and set timestamps immediately before async dispatch
      set((state) => ({
        isAiGenerating: true,
        lastAiTriggeredAt: now,
        lastAiUserTriggeredAt: { ...state.lastAiUserTriggeredAt, [userKey]: now },
        lastUserTriggeredAt: { ...state.lastUserTriggeredAt, [userKeyId]: now },
        lastTriggeredAt: { ...state.lastTriggeredAt, [rule.id]: now },
      }));

      rpc.invoke(Channels.AutoRepliesGenerate, {
        ruleId: rule.id,
        message,
        send: true,
        overrideInstructions: plan.isOverride ? plan.instructions : undefined,
      }).then((result) => {
        if (result.ok && result.message) {
          const via = result.senderLogin ? ` (via @${result.senderLogin})` : '';
          const tag = plan.isOverride ? 'AI OVERRIDE' : 'AI AUTO REPLY';
          useLogStore.getState().add({
            kind: 'trigger',
            message: `${tag} · ${rule.triggers[0] ?? ''}${via}`,
            username: message.username,
          });
        }
      }).catch(() => undefined).finally(() => {
        set({
          isAiGenerating: false,
          lastAiTriggeredAt: Date.now(),
        });
      });
      return;
    }

    const userRemaining = cooldownRemainingSeconds(now, get().lastUserTriggeredAt[`${rule.id}:${userKey}`] ?? null, rule.userCooldownSeconds ?? 0);
    if (userRemaining !== null) return;

    set((state) => ({
      lastUserTriggeredAt: { ...state.lastUserTriggeredAt, [`${rule.id}:${userKey}`]: now },
      lastTriggeredAt: { ...state.lastTriggeredAt, [rule.id]: now },
    }));

    const response = renderAutoReply(plan.text.trim(), message);
    if (!response) return;
    rpc.invoke(Channels.TwitchSendChatMessage, { message: response }).then((result) => {
      if (result.ok) {
        const via = result.senderLogin ? ` (via @${result.senderLogin})` : '';
        const tag = plan.isOverride ? 'USER OVERRIDE' : 'AUTO REPLY';
        useLogStore.getState().add({
          kind: 'trigger',
          message: `${tag} · ${rule.triggers[0] ?? ''}${via}`,
          username: message.username,
        });
      }
    }).catch(() => undefined);
  },
}));
