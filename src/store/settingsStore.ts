import { create } from 'zustand';
import type { Language } from '../i18n/translations';
import { Channels } from '../rpc/contracts';
import { rpc } from '../rpc';

export type { Language };

interface SettingsState {
  clientId: string;
  clientSecret: string;
  language: Language | '';
  loaded: boolean;
  openRouterConfigured: boolean;
  groqConfigured: boolean;
  hydrate(clientId: string, clientSecret: string, language: string): void;
  hydrateOpenRouter(configured: boolean, groqConfigured: boolean): void;
  saveOpenRouterKey(provider: 'openrouter' | 'groq', apiKey: string): Promise<boolean>;
  removeOpenRouterKey(provider: 'openrouter' | 'groq'): Promise<boolean>;
  setClientId(clientId: string): void;
  setClientSecret(clientSecret: string): void;
  setLanguage(language: Language): void;
}

function persist(get: () => SettingsState) {
  const { clientId, clientSecret, language } = get();
  rpc
    .invoke(Channels.SettingsSave, {
      twitch: { clientId: clientId.trim(), clientSecret: clientSecret.trim() },
      language: language || 'en',
    })
    .catch(() => undefined);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  clientId: '',
  clientSecret: '',
  language: '',
  loaded: false,
  openRouterConfigured: false,
  groqConfigured: false,
  hydrate: (clientId, clientSecret, language) =>
    set({
      clientId,
      clientSecret,
      language: language === 'ar' ? 'ar' : language === 'en' ? 'en' : '',
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
}));
