export type Theme = 'light' | 'dark' | 'system';

export type DateStyle = 'short' | 'medium' | 'long';
export type NumberGrouping = 'auto' | 'space' | 'dot';

export interface LocalePrefs {
  locale: 'de-AT' | 'tr-TR' | 'en-GB' | 'uk-UA';
  dateStyle: DateStyle;
  numberGrouping: NumberGrouping;
}

export interface UserSettings {
  theme: Theme;
  locale: LocalePrefs;
  preferences?: {
    density?: 'comfortable' | 'compact';
    enableAnimations?: boolean;
  };
}

export interface TenantSettings {
  defaultLocale: LocalePrefs;
  defaults: Partial<UserSettings>;
}

export const SYSTEM_DEFAULT_LOCALE: LocalePrefs = {
  locale: 'de-AT',
  dateStyle: 'medium',
  numberGrouping: 'auto'
};

export const SYSTEM_DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'system',
  locale: SYSTEM_DEFAULT_LOCALE,
  preferences: {
    density: 'comfortable',
    enableAnimations: true
  }
};

