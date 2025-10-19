type Lang = 'de' | 'en' | 'tr';
type AppLang = 'de-AT' | 'en' | 'tr';

const APP_LANG_MAP: Record<Lang, AppLang> = {
  de: 'de-AT',
  en: 'en',
  tr: 'tr',
};

const DISPLAY_OPTIONS: Array<{ value: Lang; label: string }> = [
  { value: 'de', label: 'DE' },
  { value: 'en', label: 'EN' },
  { value: 'tr', label: 'TR' },
];

const SUPPORTED: Lang[] = ['de', 'en', 'tr'];

export function mountLangSwitch(host: HTMLElement | null) {
  if (!host) return;
  host.innerHTML = '';
  const select = document.createElement('select');
  select.className = 'input';
  select.style.minWidth = '90px';
  select.setAttribute('aria-label', 'Language');

  const appState = (globalThis as any)?.AppState;
  const currentAppLang = (appState?.language as AppLang | undefined) || undefined;
  const currentStored = (localStorage.getItem('lang') as Lang | null) || undefined;
  const currentLang =
    (currentAppLang && normalizeAppLang(currentAppLang)) ||
    currentStored ||
    'de';

  DISPLAY_OPTIONS.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === currentLang) opt.selected = true;
    select.append(opt);
  });

  select.addEventListener('change', () => {
    const value = select.value as Lang;
    try {
      localStorage.setItem('lang', value);
    } catch (_) {
      // ignore storage quota issues silently
    }
    const targetAppLang = APP_LANG_MAP[value] ?? value;
    if (appState?.setLanguage) {
      appState.setLanguage(targetAppLang);
      if (typeof appState.loadTranslations === 'function') {
        void appState.loadTranslations();
      }
    }
    const root = document.documentElement;
    if (root) {
      root.setAttribute('lang', targetAppLang);
    }
    window.location.reload();
  });

  host.append(select);
}

export function currentLang() {
  const appState = (globalThis as any)?.AppState;
  const appLang = appState?.language as AppLang | undefined;
  if (appLang) return normalizeAppLang(appLang);
  return (localStorage.getItem('lang') as Lang | null) || 'de';
}

function normalizeAppLang(value: AppLang | string): Lang {
  const lower = value.toLowerCase();
  if (lower === 'de-at') return 'de';
  if (lower === 'en') return 'en';
  if (lower === 'tr') return 'tr';
  return 'de';
}
