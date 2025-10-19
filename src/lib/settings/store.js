import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import storage from '../../utils/storage';
import { SYSTEM_DEFAULT_LOCALE, SYSTEM_DEFAULT_USER_SETTINGS } from './types';
import { createMemorySettingsAdapter } from '../repo/settings';
import { RepositoryError } from '../repo';
import { setActiveLocale } from '../i18n';
const USER_STORAGE_KEY = 'tp-admin@settings:user';
const TENANT_STORAGE_KEY = 'tp-admin@settings:tenant';
let adapter = createMemorySettingsAdapter();
let state = {
    userId: null,
    tenantId: null,
    user: null,
    tenant: null,
    loaded: false
};
let storedUsers = storage.get(USER_STORAGE_KEY, {}) ??
    {};
let storedTenants = storage.get(TENANT_STORAGE_KEY, {}) ??
    {};
const subscribers = new Set();
let mediaQuery = null;
let lastAppliedTheme = null;
let lastAppliedLocale = null;
const notify = () => {
    subscribers.forEach(listener => {
        try {
            listener();
        }
        catch (error) {
            console.error('[settings] listener error', error);
        }
    });
};
const ensureMediaQuery = () => {
    if (typeof window === 'undefined' || mediaQuery)
        return;
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
        if (getEffectiveSettings().theme === 'system') {
            applyTheme('system');
        }
    });
};
const resolveTheme = (theme) => {
    if (theme === 'system') {
        if (typeof window === 'undefined')
            return 'light';
        ensureMediaQuery();
        return mediaQuery?.matches ? 'dark' : 'light';
    }
    return theme;
};
const applyTheme = (theme) => {
    if (typeof document === 'undefined')
        return;
    ensureMediaQuery();
    const resolved = resolveTheme(theme);
    if (lastAppliedTheme === theme && document.documentElement.dataset.theme === resolved) {
        return;
    }
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    lastAppliedTheme = theme;
};
const LEGACY_LANG_MAP = {
    'de-AT': { legacy: 'de', appState: 'de-AT' },
    'en-GB': { legacy: 'en', appState: 'en' },
    'tr-TR': { legacy: 'tr', appState: 'tr' },
    'uk-UA': { legacy: 'en', appState: 'uk-UA' }
};
const mapToLegacyLanguage = (locale) => LEGACY_LANG_MAP[locale] ?? { legacy: 'en', appState: locale };
const applyLocale = (locale) => {
    if (typeof document !== 'undefined') {
        if (lastAppliedLocale !== locale.locale) {
            document.documentElement.lang = locale.locale;
            lastAppliedLocale = locale.locale;
        }
    }
    const { legacy, appState: appLang } = mapToLegacyLanguage(locale.locale);
    try {
        localStorage.setItem('lang', legacy);
    }
    catch (error) {
        console.warn('[settings] failed to persist legacy language', error);
    }
    const globalAppState = globalThis?.AppState;
    if (globalAppState?.setLanguage) {
        try {
            globalAppState.setLanguage(appLang);
        }
        catch (error) {
            console.warn('[settings] failed to sync language with legacy AppState', error);
        }
        if (typeof globalAppState.loadTranslations === 'function') {
            try {
                void globalAppState.loadTranslations();
            }
            catch (error) {
                console.warn('[settings] failed to reload legacy translations', error);
            }
        }
    }
    setActiveLocale(locale);
};
const persistUsers = () => {
    storage.set(USER_STORAGE_KEY, storedUsers);
};
const persistTenants = () => {
    storage.set(TENANT_STORAGE_KEY, storedTenants);
};
const updateState = (updater) => {
    state = updater(state);
    const effective = getEffectiveSettings();
    applyTheme(effective.theme);
    applyLocale(effective.locale);
    notify();
};
const mergePreferences = (tenantPrefs, userPrefs) => ({
    ...SYSTEM_DEFAULT_USER_SETTINGS.preferences,
    ...(tenantPrefs ?? {}),
    ...(userPrefs ?? {})
});
const mergeLocale = (tenant, user) => ({
    ...SYSTEM_DEFAULT_LOCALE,
    ...(tenant?.defaultLocale ?? {}),
    ...(tenant?.defaults?.locale ?? {}),
    ...(user?.locale ?? {})
});
const mergeTheme = (tenant, user) => user?.theme ?? tenant?.defaults?.theme ?? SYSTEM_DEFAULT_USER_SETTINGS.theme;
const mergeUserSettings = (current, updates) => ({
    theme: updates.theme ?? current?.theme ?? SYSTEM_DEFAULT_USER_SETTINGS.theme,
    locale: {
        ...SYSTEM_DEFAULT_LOCALE,
        ...(current?.locale ?? {}),
        ...(updates.locale ?? {})
    },
    preferences: {
        ...SYSTEM_DEFAULT_USER_SETTINGS.preferences,
        ...(current?.preferences ?? {}),
        ...(updates.preferences ?? {})
    }
});
export const getEffectiveSettings = (snapshot = state) => ({
    theme: mergeTheme(snapshot.tenant, snapshot.user),
    locale: mergeLocale(snapshot.tenant, snapshot.user),
    preferences: mergePreferences(snapshot.tenant?.defaults?.preferences, snapshot.user?.preferences)
});
export const getSettingsSnapshot = () => state;
export const subscribeSettings = (listener) => {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
};
export const registerSettingsAdapter = (nextAdapter) => {
    adapter = nextAdapter;
};
export const resetSettingsState = () => {
    updateState(() => ({
        ...state,
        user: null,
        tenant: null,
        loaded: false
    }));
};
export const loadSettings = async (options) => {
    const { userId, tenantId = null } = options;
    const storedUser = storedUsers[userId] ?? null;
    const storedTenant = tenantId ? storedTenants[tenantId] ?? null : null;
    updateState(prev => ({
        ...prev,
        userId,
        tenantId,
        user: storedUser ?? prev.user,
        tenant: storedTenant ?? prev.tenant
    }));
    try {
        const [userSettings, tenantSettings] = await Promise.all([
            adapter.getUserSettings(userId),
            tenantId ? adapter.getTenantSettings(tenantId) : Promise.resolve(null)
        ]);
        if (userSettings) {
            storedUsers[userId] = userSettings;
            persistUsers();
        }
        if (tenantId && tenantSettings) {
            storedTenants[tenantId] = tenantSettings;
            persistTenants();
        }
        updateState(prev => ({
            ...prev,
            userId,
            tenantId,
            user: userSettings ?? storedUser ?? prev.user,
            tenant: tenantId ? tenantSettings ?? storedTenant ?? prev.tenant : null,
            loaded: true
        }));
    }
    catch (error) {
        console.warn('[settings] failed to load settings', error);
        updateState(prev => ({
            ...prev,
            userId,
            tenantId,
            loaded: true
        }));
        throw error;
    }
};
const ensureInitialized = () => {
    if (!state.userId) {
        throw new RepositoryError('Settings store not initialised with a user ID.');
    }
};
export const saveUserSettings = async (changes) => {
    ensureInitialized();
    const userId = state.userId;
    const previous = state.user;
    const optimistic = mergeUserSettings(previous, changes);
    storedUsers[userId] = optimistic;
    persistUsers();
    updateState(prev => ({
        ...prev,
        user: optimistic,
        loaded: true
    }));
    try {
        const result = await adapter.updateUserSettings(userId, changes);
        storedUsers[userId] = result;
        persistUsers();
        updateState(prev => ({
            ...prev,
            user: result,
            loaded: true
        }));
        return result;
    }
    catch (error) {
        if (previous) {
            storedUsers[userId] = previous;
        }
        else {
            delete storedUsers[userId];
        }
        persistUsers();
        updateState(prev => ({
            ...prev,
            user: previous,
            loaded: true
        }));
        throw error;
    }
};
export const saveTenantSettings = async (changes) => {
    ensureInitialized();
    const tenantId = state.tenantId;
    if (!tenantId) {
        throw new RepositoryError('Cannot save tenant settings without an active tenant.');
    }
    const result = await adapter.updateTenantSettings(tenantId, changes);
    storedTenants[tenantId] = result;
    persistTenants();
    updateState(prev => ({
        ...prev,
        tenant: result,
        loaded: true
    }));
    return result;
};
export const useSettingsState = () => useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getSettingsSnapshot);
export const useEffectiveSettings = () => {
    const snapshot = useSettingsState();
    return useMemo(() => getEffectiveSettings(snapshot), [snapshot.user, snapshot.tenant]);
};
