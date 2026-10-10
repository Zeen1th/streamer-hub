export type DarkThemeVariant = 'dark' | 'fluent';

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
  {
    id: 'light',
    labelKey: 'settings.themeLight',
    hintKey: 'settings.themeLightHint',
    surfaceColor: '#f3f2f2',
    accentColor: '#ec3013',
    borderColor: '#dedcd9',
    isDark: false,
  },
];

export function isDarkTheme(theme: string): theme is DarkThemeVariant {
  return theme === 'dark' || theme === 'fluent';
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
