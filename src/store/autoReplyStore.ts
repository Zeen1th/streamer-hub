import { create } from 'zustand';
import type { AutoReply, AutoReplySettings, ChatMessage, TitleCounter } from '../rpc/contracts';
import { Channels } from '../rpc/contracts';
import { rpc } from '../rpc';
import { cooldownRemainingSeconds, matchesAnyAutoReply, renderAutoReply, renderStreamTitle } from '../lib/autoReplyRules';
import { hasPermission } from '../lib/counterRules';
import { useLogStore } from './logStore';

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
  add(): void;
  update(id: string, patch: Partial<AutoReply>): void;
  remove(id: string): void;
  handleChatMessage(message: ChatMessage): void;
}

const persist = (rule: AutoReply) => {
  rpc.invoke(Channels.AutoRepliesSave, { rule }).catch(() => undefined);
};

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
      matchMode: rule.matchMode ?? 'exact',
      userCooldownSeconds: rule.userCooldownSeconds ?? 0,
      titleActionEnabled: rule.titleActionEnabled ?? false,
      titleTemplate: rule.titleTemplate ?? '',
      titleStart: Math.max(0, Math.trunc(rule.titleStart ?? 1)),
      titleCount: Math.max(0, Math.trunc(rule.titleCount ?? rule.titleStart ?? 1)),
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
      cooldownSeconds: 30,
      userCooldownSeconds: 0,
      titleActionEnabled: false,
      titleTemplate: '',
      titleStart: 1,
      titleCount: 1,
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
  handleChatMessage: (message) => {
    const now = Date.now();
    const rule = get().rules.find((item) => item.enabled && matchesAnyAutoReply(message.message, item.triggers, item.matchMode) && hasPermission(message, item.minimumRank ?? 'everyone'));
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
    if (rule.titleActionEnabled && rule.titleTemplate?.trim()) {
      const counters = rule.titleCounters?.length ? rule.titleCounters : [{ id: 'count1', start: rule.titleStart ?? 1, count: rule.titleCount ?? rule.titleStart ?? 1 }];
      const values = Object.fromEntries(counters.map((counter, index) => [`count${index + 1}`, Math.max(0, Math.trunc(counter.count))]));
      const title = renderStreamTitle(rule.titleTemplate, values);
      rpc.invoke(Channels.TwitchUpdateTitle, { title }).then((result) => {
        if (result.ok) {
          const nextCounters: TitleCounter[] = counters.map((counter) => ({ ...counter, count: Math.max(0, Math.trunc(counter.count)) + 1 }));
          get().update(rule.id, { titleCounters: nextCounters, titleCount: nextCounters[0]?.count ?? 1 });
        }
      }).catch(() => undefined);
    }
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
