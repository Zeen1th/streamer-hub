import { create } from 'zustand';
import type {
  ChatMessage,
  Counter,
  CounterAction,
  CounterCommandConfig,
  LogKind,
  ObsOutputConfig,
} from '../rpc/contracts';
import { Channels } from '../rpc/contracts';
import { rpc } from '../rpc';
import { cooldownRemainingSeconds, hasPermission, parseCommand, renderTemplate } from '../lib/counterRules';
import { RANK_KEYS, t } from '../i18n/translations';
import type { Language } from '../i18n/translations';
import { useLogStore } from './logStore';
import { useSettingsStore } from './settingsStore';

export type ObsWriteStatus = 'idle' | 'writing' | 'ok' | 'error';

interface ObsStatus {
  state: ObsWriteStatus;
  message: string | null;
  at: string | null;
}

interface CounterStoreState {
  counters: Counter[];
  selectedId: string | null;
  lastTriggerAt: Record<string, Partial<Record<CounterAction, number>>>;
  lastTriggerUser: Record<string, string | null>;
  obsStatus: Record<string, ObsStatus>;
  configSync: { state: 'idle' | 'syncing' | 'saved' | 'error'; at: string | null };
  hydrate(counters: Counter[]): void;
  select(id: string | null): void;
  addCounter(): void;
  removeCounter(id: string): void;
  updateName(id: string, name: string): void;
  updateCommand(id: string, action: CounterAction, patch: Partial<CounterCommandConfig>): void;
  updateObs(id: string, patch: Partial<ObsOutputConfig>): void;
  updateTitle(id: string, patch: { titleEnabled?: boolean; titleTemplate?: string }): void;
  incrementManual(id: string): void;
  decrementManual(id: string): void;
  resetManual(id: string): void;
  triggerAction(id: string, action: CounterAction, source: 'manual' | 'keybind'): boolean;
  handleChatMessage(message: ChatMessage): void;
  testWrite(id: string): void;
}

const COMMAND_LABELS: Record<CounterAction, string> = {
  increase: '+1',
  decrease: '−1',
  reset: '0',
};

const tr = (key: string, params?: Record<string, string | number>): string => {
  const lang: Language = useSettingsStore.getState().language === 'ar' ? 'ar' : 'en';
  return t(lang, key, params);
};

export const useCounterStore = create<CounterStoreState>((set, get) => {
  const log = (kind: LogKind, message: string, username?: string, count?: number) => {
    useLogStore.getState().add({ kind, message, username, count });
  };

  const persistCounter = (counter: Counter) => {
    set({ configSync: { state: 'syncing', at: null } });
    rpc
      .invoke(Channels.CountersSave, { counter })
      .then(() => set({ configSync: { state: 'saved', at: new Date().toISOString() } }))
      .catch(() => set({ configSync: { state: 'error', at: new Date().toISOString() } }));
  };

  const failWrite = (id: string, message: string) => {
    set((s) => ({ obsStatus: { ...s.obsStatus, [id]: { state: 'error', message, at: new Date().toISOString() } } }));
    log('obs-error', tr('log.obsFailed', { msg: message }));
  };

  const counterTitleQueues = new Map<string, Promise<void>>();

  const updateTitle = (id: string) => {
    const queued = counterTitleQueues.get(id) ?? Promise.resolve();
    const next = queued
      .catch(() => undefined)
      .then(async () => {
        const current = get().counters.find((c) => c.id === id);
        if (!current?.titleEnabled || !current.titleTemplate?.trim()) return;

        let currentTitle: string | null = null;
        if (current.titleTemplate.includes('{title}') || current.titleTemplate.includes('{current_title}')) {
          try {
            const titleRes = await rpc.invoke(Channels.TwitchGetTitle, undefined);
            if (titleRes.ok && titleRes.title) currentTitle = titleRes.title;
          } catch {
          }
        }

        const title = renderTemplate(current.titleTemplate, current.count, null, currentTitle).trim();
        if (!title) return;
        const result = await rpc.invoke(Channels.TwitchUpdateTitle, { title });
        if (!result.ok) log('system', current.name + ' · ' + (result.error ?? 'TITLE UPDATE FAILED'));
      })
      .catch(() => undefined);
    counterTitleQueues.set(id, next);
    void next.finally(() => {
      if (counterTitleQueues.get(id) === next) counterTitleQueues.delete(id);
    });
  };

  const writeObs = (id: string, force = false, logSuccess = false) => {
    const counter = get().counters.find((c) => c.id === id);
    if (!counter) return;
    if (!force && !counter.obs.enabled) return;
    if (!counter.obs.filePath.trim()) {
      set((s) => ({
        obsStatus: { ...s.obsStatus, [id]: { state: 'error', message: tr('log.noTargetFile'), at: new Date().toISOString() } },
      }));
      return;
    }
    set((s) => ({ obsStatus: { ...s.obsStatus, [id]: { state: 'writing', message: null, at: null } } }));
    const content = renderTemplate(counter.obs.template, counter.count, get().lastTriggerUser[id] ?? null);
    rpc
      .invoke(Channels.ObsWrite, { filePath: counter.obs.filePath, content })
      .then((result) => {
        if (result.ok) {
          set((s) => ({
            obsStatus: { ...s.obsStatus, [id]: { state: 'ok', message: null, at: new Date().toISOString() } },
          }));
          if (logSuccess) log('obs-ok', `${counter.name} · ${tr('log.testOk')}`);
        } else {
          failWrite(id, result.error ?? 'WRITE FAILED');
        }
      })
      .catch((error: unknown) => {
        failWrite(id, error instanceof Error ? error.message : 'WRITE FAILED');
      });
  };

  const syncCount = (id: string, source: 'manual' | 'chat' | 'keybind') => {
    const counter = get().counters.find((c) => c.id === id);
    if (!counter) return;
    rpc.invoke(Channels.CountersSetCount, { counterId: id, count: counter.count, source }).catch(() => undefined);
    writeObs(id);
  };

  const applyAction = (
    id: string,
    action: CounterAction,
    source: 'manual' | 'chat' | 'keybind',
    username: string | null,
    argument = '',
  ) => {
    const counter = get().counters.find((c) => c.id === id);
    if (!counter) return false;
    const command = counter.commands[action];
    const now = Date.now();
    const lastAt = get().lastTriggerAt[counter.id]?.[action] ?? null;
    const remaining = cooldownRemainingSeconds(now, lastAt, command.cooldownSeconds);
    if (remaining !== null) {
      log('cooldown-denied', counter.name + ' · ' + tr('log.cooldown', { user: username ?? 'STREAMER', s: remaining }), username ?? undefined);
      return false;
    }
    let next = counter.count;
    let kind: LogKind = 'manual';
    let message: string;
    if (action === 'increase') {
      next = counter.count + 1;
      message = source === 'chat'
        ? tr('log.triggered', {
            user: username ?? '',
            cmd: `${command.commandName}${argument ? ` ${argument}` : ''}`,
            effect: COMMAND_LABELS.increase,
          })
        : tr('log.adjustedUp');
      kind = source === 'chat' ? 'trigger' : 'manual';
    } else if (action === 'decrease') {
      next = Math.max(0, counter.count - 1);
      message = source === 'chat'
        ? tr('log.triggered', {
            user: username ?? '',
            cmd: `${command.commandName}${argument ? ` ${argument}` : ''}`,
            effect: COMMAND_LABELS.decrease,
          })
        : tr('log.adjustedDown');
      kind = source === 'chat' ? 'trigger' : 'manual';
    } else {
      next = 0;
      message = source === 'chat'
        ? tr('log.triggeredReset', { user: username ?? '', cmd: command.commandName })
        : tr('log.counterReset');
      kind = source === 'chat' ? 'trigger' : 'reset';
    }
    set((s) => ({
      counters: s.counters.map((c) => (c.id === id ? { ...c, count: next } : c)),
      lastTriggerUser: { ...s.lastTriggerUser, [id]: username },
      lastTriggerAt: { ...s.lastTriggerAt, [id]: { ...s.lastTriggerAt[id], [action]: now } },
    }));
    log(kind, `${counter.name} · ${message}`.slice(0, 80), username ?? undefined, next);
    syncCount(id, source);
    updateTitle(id);
    return true;
  };

  return {
    counters: [],
    selectedId: null,
    lastTriggerAt: {},
    lastTriggerUser: {},
    obsStatus: {},
    configSync: { state: 'idle', at: null },

    hydrate: (counters) => {
      set((s) => ({
        counters,
        selectedId: s.selectedId && counters.some((c) => c.id === s.selectedId) ? s.selectedId : (counters[0]?.id ?? null),
      }));
      const entries = useLogStore.getState().entries;
      if (entries.length === 0) {
        log('system', tr('log.sessionStarted'));
      } else {
        const total = counters.reduce((sum, c) => sum + c.count, 0);
        if (total > 0) log('system', tr('log.countersRestored', { n: counters.length, total }));
      }
    },

    select: (id) => set({ selectedId: id }),

    addCounter: () => {
      const { counters } = get();
      let seq = counters.length + 1;
      let name = `Counter ${seq}`;
      while (counters.some((c) => c.name === name)) {
        seq += 1;
        name = `Counter ${seq}`;
      }
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'counter';
      const counter: Counter = {
        id: crypto.randomUUID(),
        name,
        count: 0,
        commands: {
          increase: { commandName: slug, permission: 'everyone', cooldownSeconds: 10 },
          decrease: { commandName: `${slug}down`, permission: 'everyone', cooldownSeconds: 10 },
          reset: { commandName: `${slug}reset`, permission: 'everyone', cooldownSeconds: 0 },
        },
        obs: { enabled: false, filePath: '', template: `${name}: {count}` },
      };
      set((s) => ({ counters: [...s.counters, counter], selectedId: counter.id }));
      persistCounter(counter);
      log('system', tr('log.counterCreated', { name }));
    },

    removeCounter: (id) => {
      const { counters, selectedId } = get();
      const remaining = counters.filter((c) => c.id !== id);
      const removed = counters.find((c) => c.id === id);
      set((s) => ({
        counters: remaining,
        selectedId: selectedId === id ? (remaining[0]?.id ?? null) : selectedId,
        obsStatus: Object.fromEntries(Object.entries(s.obsStatus).filter(([key]) => key !== id)),
        lastTriggerAt: Object.fromEntries(Object.entries(s.lastTriggerAt).filter(([key]) => key !== id)),
        lastTriggerUser: Object.fromEntries(Object.entries(s.lastTriggerUser).filter(([key]) => key !== id)),
      }));
      rpc.invoke(Channels.CountersDelete, { counterId: id }).catch(() => undefined);
      if (removed) log('system', tr('log.counterDeleted', { name: removed.name }));
    },

    updateName: (id, name) => {
      set((s) => ({ counters: s.counters.map((c) => (c.id === id ? { ...c, name } : c)) }));
      const counter = get().counters.find((c) => c.id === id);
      if (counter) persistCounter(counter);
    },

    updateCommand: (id, action, patch) => {
      set((s) => ({
        counters: s.counters.map((c) =>
          c.id === id ? { ...c, commands: { ...c.commands, [action]: { ...c.commands[action], ...patch } } } : c,
        ),
      }));
      const counter = get().counters.find((c) => c.id === id);
      if (counter) persistCounter(counter);
    },

    updateTitle: (id, patch) => {
      set((s) => ({
        counters: s.counters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
      const counter = get().counters.find((c) => c.id === id);
      if (counter) persistCounter(counter);
    },

    updateObs: (id, patch) => {

      set((s) => ({
        counters: s.counters.map((c) => (c.id === id ? { ...c, obs: { ...c.obs, ...patch } } : c)),
      }));
      const counter = get().counters.find((c) => c.id === id);
      if (!counter) return;
      persistCounter(counter);
      if (!counter.obs.enabled) {
        set((s) => ({ obsStatus: { ...s.obsStatus, [id]: { state: 'idle', message: null, at: null } } }));
        return;
      }
      writeObs(id);
    },

    incrementManual: (id) => { applyAction(id, 'increase', 'manual', null); },
    decrementManual: (id) => { applyAction(id, 'decrease', 'manual', null); },
    resetManual: (id) => { applyAction(id, 'reset', 'manual', null); },
    triggerAction: (id, action, source) => applyAction(id, action, source, null),

    handleChatMessage: (message) => {
      const { counters } = get();
      for (const counter of counters) {
        for (const action of ['increase', 'decrease', 'reset'] as CounterAction[]) {
          const command = counter.commands[action];
          const parsed = parseCommand(message.message, command.commandName);
          if (!parsed) continue;
          if (!hasPermission(message, command.permission)) {
            log(
              'permission-denied',
              `${counter.name} · ${tr('log.below', { user: message.username, rank: tr(RANK_KEYS[command.permission]) })}`,
              message.username,
            );
            return;
          }
          applyAction(counter.id, action, 'chat', message.username, parsed.argument);
          return;
        }
      }
    },

    testWrite: (id) => writeObs(id, true, true),
  };
});
