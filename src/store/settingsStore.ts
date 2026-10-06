import { create } from 'zustand';
import type { Language } from '../i18n/translations';
import { Channels } from '../rpc/contracts';
import { rpc } from '../rpc';
import type { ChatSenderRole } from '../rpc/contracts';
import type { DarkThemeVariant, ThemePreference } from '../lib/theme';
import { isDarkTheme } from '../lib/theme';

export type { Language };
export type UiScaleMode = 'auto' | 'custom';

export function calculateAutoScale(): number {
  if (typeof window === 'undefined') return 1.0;
  const w = window.screen?.width ?? window.innerWidth ?? 1920;
  const h = window.screen?.height ?? window.innerHeight ?? 1080;
  if (w >= 3400 || h >= 2000) return 1.35;
  if (w >= 2400 || h >= 1350) return 1.15;
  if (w < 1600 || h < 900) return 0.90;
  return 1.0;
}

interface SettingsState {
  clientId: string;
  clientSecret: string;
  language: Language | '';
  theme: ThemePreference;
  lastDarkTheme: DarkThemeVariant;
  botAccountEnabled: boolean;
  preferredChatSender: ChatSenderRole;
  startupEnabled: boolean;
  closeToTray: boolean;
  loaded: boolean;
  openRouterConfigured: boolean;
  groqConfigured: boolean;
  uiScaleMode: UiScaleMode;
  uiCustomScale: number;
  effectiveScale: number;
  hydrate(clientId: string, clientSecret: string, language: string, botAccountEnabled?: boolean, preferredChatSender?: ChatSenderRole, startupEnabled?: boolean, closeToTray?: boolean): void;
  hydrateOpenRouter(configured: boolean, groqConfigured: boolean): void;
  saveOpenRouterKey(provider: 'openrouter' | 'groq', apiKey: string): Promise<boolean>;
  removeOpenRouterKey(provider: 'openrouter' | 'groq'): Promise<boolean>;
  setClientId(clientId: string): void;
  setClientSecret(clientSecret: string): void;
  setLanguage(language: Language): void;
  setTheme(theme: ThemePreference): void;
  setBotAccountEnabled(enabled: boolean): void;
  setPreferredChatSender(sender: ChatSenderRole): void;
  setStartupEnabled(enabled: boolean): void;
  setCloseToTray(enabled: boolean): void;
  setUiScale(mode: UiScaleMode, customScale?: number): void;
  adjustScale(delta: number): void;
  resetScale(): void;
  refreshAutoScale(): void;
}

function persist(get: () => SettingsState) {
  const { clientId, clientSecret, language, botAccountEnabled, preferredChatSender, startupEnabled, closeToTray } = get();
  rpc
    .invoke(Channels.SettingsSave, {
      twitch: { clientId: clientId.trim(), clientSecret: clientSecret.trim() },
      language: language || 'en',
      botAccountEnabled,
      preferredChatSender,
      startupEnabled,
      closeToTray,
    })
    .catch(() => undefined);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  clientId: '',
  clientSecret: '',
  language: '',
  theme: ((localStorage.getItem('streamer-hub-theme') as ThemePreference | null) ?? 'dark'),
  lastDarkTheme: (() => {
    const stored = localStorage.getItem('streamer-hub-last-dark-theme');
    return stored && isDarkTheme(stored) ? (stored as DarkThemeVariant) : 'dark';
  })(),
  botAccountEnabled: false,
  preferredChatSender: 'bot',
  startupEnabled: true,
  closeToTray: true,
  loaded: false,
  openRouterConfigured: false,
  groqConfigured: false,
  uiScaleMode: ((localStorage.getItem('streamer-hub-ui-scale-mode') as UiScaleMode | null) ?? 'auto'),
  uiCustomScale: (() => {
    const raw = localStorage.getItem('streamer-hub-ui-scale-custom');
    const val = raw ? parseFloat(raw) : 1.0;
    return isNaN(val) ? 1.0 : Math.max(0.75, Math.min(1.75, val));
  })(),
  effectiveScale: (() => {
    const mode = (localStorage.getItem('streamer-hub-ui-scale-mode') as UiScaleMode | null) ?? 'auto';
    if (mode === 'auto') return calculateAutoScale();
    const raw = localStorage.getItem('streamer-hub-ui-scale-custom');
    const val = raw ? parseFloat(raw) : 1.0;
    return isNaN(val) ? 1.0 : Math.max(0.75, Math.min(1.75, val));
  })(),
  hydrate: (clientId, clientSecret, language, botAccountEnabled, preferredChatSender, startupEnabled, closeToTray) =>
    set({
      clientId,
      clientSecret,
      language: language === 'ar' ? 'ar' : language === 'en' ? 'en' : '',
      botAccountEnabled: botAccountEnabled ?? false,
      preferredChatSender: preferredChatSender ?? 'bot',
      startupEnabled: startupEnabled ?? true,
      closeToTray: closeToTray ?? true,
      loaded: true,
    }),
  hydrateOpenRouter: (configured, groqConfigured) => set({ openRouterConfigured: configured, groqConfigured }),
  saveOpenRouterKey: async (provider, apiKey) => {
    try {
      const result = await rpc.invoke(Channels.OpenRouterSave, { provider, apiKey: apiKey.trim() || null });
      if (result.ok) set(provider === 'groq' ? { groqConfigured: result.configured } : { openRouterConfigured: result.configured });
      return result.ok;
    } catch {
      return false;
    }
  },
  removeOpenRouterKey: async (provider) => {
    try {
      const result = await rpc.invoke(Channels.OpenRouterSave, { provider, apiKey: null });
      if (result.ok) set(provider === 'groq' ? { groqConfigured: false } : { openRouterConfigured: false });
      return result.ok;
    } catch {
      return false;
    }
  },
  setClientId: (clientId) => {
    set({ clientId });
    persist(get);
  },
  setClientSecret: (clientSecret) => {
    set({ clientSecret });
    persist(get);
  },
  setLanguage: (language) => {
    set({ language });
    persist(get);
  },
  setStartupEnabled: (enabled) => {
    set({ startupEnabled: enabled });
    persist(get);
  },
  setCloseToTray: (enabled) => {
    set({ closeToTray: enabled });
    persist(get);
  },
  setBotAccountEnabled: (enabled) => {
    set({ botAccountEnabled: enabled });
    persist(get);
  },
  setPreferredChatSender: (sender) => {
    set({ preferredChatSender: sender });
    persist(get);
  },
  setTheme: (theme) => {
    const nextLastDark = isDarkTheme(theme) ? theme : get().lastDarkTheme;
    set({ theme, lastDarkTheme: nextLastDark });
    localStorage.setItem('streamer-hub-theme', theme);
    if (isDarkTheme(theme)) {
      localStorage.setItem('streamer-hub-last-dark-theme', theme);
    }
  },
  setUiScale: (mode, customScale) => {
    const currentCustom = get().uiCustomScale;
    const nextCustom = customScale !== undefined ? Math.max(0.75, Math.min(1.75, customScale)) : currentCustom;
    const effective = mode === 'auto' ? calculateAutoScale() : nextCustom;
    localStorage.setItem('streamer-hub-ui-scale-mode', mode);
    localStorage.setItem('streamer-hub-ui-scale-custom', String(nextCustom));
    set({ uiScaleMode: mode, uiCustomScale: nextCustom, effectiveScale: effective });
  },
  adjustScale: (delta) => {
    const current = get().effectiveScale;
    const next = Math.max(0.75, Math.min(1.75, Math.round((current + delta) * 100) / 100));
    localStorage.setItem('streamer-hub-ui-scale-mode', 'custom');
    localStorage.setItem('streamer-hub-ui-scale-custom', String(next));
    set({ uiScaleMode: 'custom', uiCustomScale: next, effectiveScale: next });
  },
  resetScale: () => {
    localStorage.setItem('streamer-hub-ui-scale-mode', 'auto');
    const effective = calculateAutoScale();
    set({ uiScaleMode: 'auto', effectiveScale: effective });
  },
  refreshAutoScale: () => {
    if (get().uiScaleMode === 'auto') {
      const effective = calculateAutoScale();
      set({ effectiveScale: effective });
    }
  },
}));

