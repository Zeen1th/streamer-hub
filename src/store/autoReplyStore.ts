import { create } from 'zustand';
import type { AutoReply, AutoReplySettings, ChatMessage, TitleCounter } from '../rpc/contracts';
import { Channels } from '../rpc/contracts';
import { rpc } from '../rpc';
import { cooldownRemainingSeconds, matchesAnyAutoReply, nextTitleCounters, renderAutoReply, renderStreamTitle, titleActionDirection } from '../lib/autoReplyRules';
import { hasPermission } from '../lib/counterRules';
import { useLogStore } from './logStore';
import { useSettingsStore } from './settingsStore';

interface AutoReplyState {
  rules: AutoReply[];
  lastTriggeredAt: Record<string, number>;
  lastUserTriggeredAt: Record<string, number>;
  lastAiTriggeredAt: number | null;
  lastAiUserTriggeredAt: Record<string, number>;
  globalSettings: AutoReplySettings;
  hydrateGlobalSettings(settings: AutoReplySettings): void;
  updateGlobalSettings(patch: Partial<AutoReplySettings>): void;
  hydrate(rules: AutoReply[]): void;
  add(): string;
  update(id: string, patch: Partial<AutoReply>): void;
  remove(id: string): void;
  triggerTitleAction(id: string, action: 'increase' | 'decrease' | 'reset' | 'apply'): boolean;
  handleChatMessage(message: ChatMessage): void;
}

const persist = (rule: AutoReply) => {
  rpc.invoke(Channels.AutoRepliesSave, { rule }).catch(() => undefined);
};

const titleUpdateQueues = new Map<string, Promise<void>>();

export const useAutoReplyStore = create<AutoReplyState>((set, get) => ({
  rules: [],
  lastTriggeredAt: {},
  lastUserTriggeredAt: {},
  lastAiTriggeredAt: null,
  lastAiUserTriggeredAt: {},
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
      aiModel: rule.aiModel ?? (rule.aiProvider === 'groq' ? 'openai/gpt-oss-20b' : 'meta-llama/llama-3.2-3b-instruct:free'),
      aiProvider: rule.aiProvider ?? 'openrouter',
      aiMaxTokens: rule.aiMaxTokens ?? 120,
      aiFallback: rule.aiFallback ?? '',
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
      aiModel: 'meta-llama/llama-3.2-3b-instruct:free',
      aiProvider: 'openrouter',
      aiMaxTokens: 120,
      aiFallback: '',
    };
    set((state) => ({ rules: [...state.rules, rule] }));
    persist(rule);
    return rule.id;
  },
  update: (id, patch) => {
    set((state) => ({ rules: state.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)) }));
    const rule = get().rules.find((item) => item.id === id);
    if (rule) persist(rule);
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
    const rule = get().rules.find((item) => item.id === id && item.titleActionEnabled && item.titleTemplate?.trim());
    if (!rule) return false;
    const now = Date.now();
    if (cooldownRemainingSeconds(now, get().lastTriggeredAt[id] ?? null, rule.cooldownSeconds) !== null) return false;
    set((state) => ({ lastTriggeredAt: { ...state.lastTriggeredAt, [id]: now } }));
    const queued = titleUpdateQueues.get(id) ?? Promise.resolve();
    const nextUpdate = queued.catch(() => undefined).then(async () => {
      const currentRule = get().rules.find((item) => item.id === id);
      if (!currentRule) return;
      const counters = currentRule.titleCounters?.length
        ? currentRule.titleCounters
        : [{ id: 'count1', start: currentRule.titleStart ?? 1, count: currentRule.titleCount ?? currentRule.titleStart ?? 1 }];
      const nextCounters: TitleCounter[] = action === 'reset'
        ? counters.map((counter) => ({ ...counter, count: Math.max(0, Math.trunc(counter.start)) }))
        : action === 'increase' || action === 'decrease'
          ? nextTitleCounters(counters, action)
          : counters;
      const values = Object.fromEntries(nextCounters.map((counter, index) => ['count' + (index + 1), Math.max(0, Math.trunc(counter.count))]));
      const title = renderStreamTitle(currentRule.titleTemplate ?? '', values);
      const result = await rpc.invoke(Channels.TwitchUpdateTitle, { title });
      if (result.ok && action !== 'apply') {
        get().update(currentRule.id, { titleCounters: nextCounters, titleCount: nextCounters[0]?.count ?? 1 });
      }
    }).catch(() => undefined);
    titleUpdateQueues.set(id, nextUpdate);
    void nextUpdate.finally(() => {
      if (titleUpdateQueues.get(id) === nextUpdate) titleUpdateQueues.delete(id);
    });
    return true;
  },
  handleChatMessage: (message) => {
    const now = Date.now();
    const rule = get().rules.find((item) => item.enabled && (((item.responseEnabled !== false || item.themeActionEnabled) && matchesAnyAutoReply(message.message, item.triggers, item.matchMode)) || (item.titleActionEnabled && (matchesAnyAutoReply(message.message, item.triggers, item.matchMode) || titleActionDirection(message.message, item.titleIncreaseCommand ?? '', item.titleDecreaseCommand ?? '', item.matchMode) !== null))) && hasPermission(message, item.minimumRank ?? 'everyone'));
    if (!rule) return;
    const remaining = cooldownRemainingSeconds(now, get().lastTriggeredAt[rule.id] ?? null, rule.cooldownSeconds);
    if (remaining !== null) return;
    const userKey = message.username.trim().toLowerCase();
    if (rule.responseMode === 'ai') {
      const globalRemaining = cooldownRemainingSeconds(now, get().lastAiTriggeredAt, get().globalSettings.globalAiCooldownSeconds);
      if (globalRemaining !== null) return;
      const userCooldown = get().globalSettings.globalAiUserCooldownSeconds;
      const userKeyId = `ai:${userKey}`;
      const userRemaining = cooldownRemainingSeconds(now, get().lastUserTriggeredAt[userKeyId] ?? null, userCooldown);
      if (userRemaining !== null) return;
      set((state) => ({ lastAiTriggeredAt: now, lastAiUserTriggeredAt: { ...state.lastAiUserTriggeredAt, [userKey]: now }, lastUserTriggeredAt: { ...state.lastUserTriggeredAt, [userKeyId]: now } }));
    } else {
      const userRemaining = cooldownRemainingSeconds(now, get().lastUserTriggeredAt[`${rule.id}:${userKey}`] ?? null, rule.userCooldownSeconds ?? 0);
      if (userRemaining !== null) return;
      set((state) => ({ lastUserTriggeredAt: { ...state.lastUserTriggeredAt, [`${rule.id}:${userKey}`]: now } }));
    }
    set((state) => ({ lastTriggeredAt: { ...state.lastTriggeredAt, [rule.id]: now } }));
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
        const queued = titleUpdateQueues.get(rule.id) ?? Promise.resolve();
        const nextUpdate = queued.catch(() => undefined).then(async () => {
          const currentRule = get().rules.find((item) => item.id === rule.id);
          if (!currentRule) return;
          const counters = currentRule.titleCounters?.length ? currentRule.titleCounters : [{ id: 'count1', start: currentRule.titleStart ?? 1, count: currentRule.titleCount ?? currentRule.titleStart ?? 1 }];
          const nextCounters: TitleCounter[] = direction ? nextTitleCounters(counters, direction) : counters;
          const values = Object.fromEntries(nextCounters.map((counter, index) => ['count' + (index + 1), Math.max(0, Math.trunc(counter.count))]));
          const title = renderStreamTitle(currentRule.titleTemplate ?? '', values);
          const result = await rpc.invoke(Channels.TwitchUpdateTitle, { title });
          if (result.ok && direction) {
            get().update(currentRule.id, { titleCounters: nextCounters, titleCount: nextCounters[0]?.count ?? 1 });
          }
        }).catch(() => undefined);
        titleUpdateQueues.set(rule.id, nextUpdate);
        void nextUpdate.finally(() => {
          if (titleUpdateQueues.get(rule.id) === nextUpdate) titleUpdateQueues.delete(rule.id);
        });
      }
    }

    if (rule.responseEnabled === false) return;
    if (rule.responseMode === 'ai') {
      rpc.invoke(Channels.AutoRepliesGenerate, { ruleId: rule.id, message, send: true }).then((result) => {
        if (result.ok && result.message) useLogStore.getState().add({ kind: 'trigger', message: `AI AUTO REPLY · ${rule.triggers[0] ?? ''}`, username: message.username });
      }).catch(() => undefined);
      return;
    }
    const response = renderAutoReply(rule.response.trim(), message);
    if (!response) return;
    rpc.invoke(Channels.TwitchSendChatMessage, { message: response }).then((result) => {
      if (result.ok) {
        useLogStore.getState().add({ kind: 'trigger', message: `AUTO REPLY · ${rule.triggers[0] ?? ''}`, username: message.username });
      }
    }).catch(() => undefined);
  },
}));
