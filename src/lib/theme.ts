export type DarkThemeVariant = 'dark' | 'fluent';

/** 'system' and 'light' are older values; they are no longer offered and normalize to 'dark'. */
export type ThemePreference = 'system' | 'light' | 'dark' | 'fluent';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeOption {
  id: ThemePreference;
  labelKey: string;
  hintKey?: string;
  surfaceColor: string;
  accentColor: string;
  borderColor?: string;
  isDark: boolean;
}

/** The themes the streamer can pick: the original Dark and the Windows 11 style Fluent. */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: 'dark',
    labelKey: 'settings.themeDark',
    hintKey: 'settings.themeDarkHint',
    surfaceColor: '#23282e',
    accentColor: '#6366f1',
    isDark: true,
  },
  {
    id: 'fluent',
    labelKey: 'settings.themeFluent',
    hintKey: 'settings.themeFluentHint',
    surfaceColor: '#1b1d27',
    accentColor: '#6366f1',
    isDark: true,
  },
];

export function isDarkTheme(theme: string): theme is DarkThemeVariant {
  return theme === 'dark' || theme === 'fluent';
}

/** Any saved or requested theme mapped onto one that still exists (Fluent, or Dark for everything else). */
export function normalizeTheme(theme: string | null | undefined): DarkThemeVariant {
  return theme === 'fluent' || theme === 'ember' ? 'fluent' : 'dark';
}

/** Extra look layered on top of the resolved light/dark base. 'default' is the original Streamer.bot-like look. */
export type ThemeSkin = 'default' | 'fluent';

export function skinFor(preference: ThemePreference): ThemeSkin {
  return preference === 'fluent' ? 'fluent' : 'default';
}

export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): ResolvedTheme {
  if (preference === 'system') {
    return systemIsDark ? 'dark' : 'light';
  }
  return preference === 'light' ? 'light' : 'dark'; // 'fluent' is a dark skin
}
