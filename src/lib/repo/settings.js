import { getTenantId } from '../tenant/store';
import { SYSTEM_DEFAULT_LOCALE, SYSTEM_DEFAULT_USER_SETTINGS } from '../settings/types';
class SettingsAdapterError extends Error {
    statusCode;
    constructor(message, statusCode, cause) {
        super(message);
        this.name = 'SettingsAdapterError';
        this.statusCode = statusCode;
        if (cause) {
            this.cause = cause;
        }
    }
}
const cloneDeep = (value) => typeof globalThis.structuredClone === 'function'
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
const cloneUser = (value) => (value ? cloneDeep(value) : null);
const cloneTenant = (value) => (value ? cloneDeep(value) : null);
const applyUserMerge = (current, changes) => {
    const next = {
        theme: changes.theme ?? current?.theme ?? SYSTEM_DEFAULT_USER_SETTINGS.theme,
        locale: {
            ...SYSTEM_DEFAULT_LOCALE,
            ...(current?.locale ?? {}),
            ...(changes.locale ?? {})
        },
        preferences: {
            ...SYSTEM_DEFAULT_USER_SETTINGS.preferences,
            ...(current?.preferences ?? {}),
            ...(changes.preferences ?? {})
        }
    };
    return next;
};
const applyTenantMerge = (current, changes) => {
    const next = {
        defaultLocale: {
            ...SYSTEM_DEFAULT_LOCALE,
            ...(current?.defaultLocale ?? {}),
            ...(changes.defaultLocale ?? {})
        },
        defaults: {
            theme: changes.defaults?.theme ?? current?.defaults?.theme ?? SYSTEM_DEFAULT_USER_SETTINGS.theme,
            locale: {
                ...SYSTEM_DEFAULT_LOCALE,
                ...(current?.defaults?.locale ?? {}),
                ...(changes.defaults?.locale ?? {})
            },
            preferences: {
                ...SYSTEM_DEFAULT_USER_SETTINGS.preferences,
                ...(current?.defaults?.preferences ?? {}),
                ...(changes.defaults?.preferences ?? {})
            }
        }
    };
    if (!next.defaults.preferences?.density) {
        next.defaults.preferences = {
            ...next.defaults.preferences,
            density: SYSTEM_DEFAULT_USER_SETTINGS.preferences?.density
        };
    }
    return next;
};
export const createMemorySettingsAdapter = () => {
    const userStore = new Map();
    const tenantStore = new Map();
    return {
        async getUserSettings(userId) {
            const value = userStore.get(userId) ?? null;
            return cloneUser(value);
        },
        async updateUserSettings(userId, changes) {
            const existing = userStore.get(userId) ?? null;
            const next = applyUserMerge(existing, changes);
            userStore.set(userId, next);
            return cloneUser(next);
        },
        async getTenantSettings(tenantId) {
            const value = tenantStore.get(tenantId) ?? null;
            return cloneTenant(value);
        },
        async updateTenantSettings(tenantId, changes) {
            const existing = tenantStore.get(tenantId) ?? null;
            const next = applyTenantMerge(existing, changes);
            tenantStore.set(tenantId, next);
            return cloneTenant(next);
        }
    };
};
const SETTINGS_API_BASE = import.meta.env.VITE_SETTINGS_API_BASE ?? '/api/settings';
const ENABLE_HTTP_SETTINGS = import.meta.env.VITE_ENABLE_HTTP_SETTINGS !== 'false';
const request = async (path, options) => {
    if (!ENABLE_HTTP_SETTINGS) {
        if (options.fallback)
            return options.fallback();
        throw new SettingsAdapterError('HTTP settings adapter disabled');
    }
    const tenantId = getTenantId();
    const headers = {
        Accept: 'application/json'
    };
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    if (tenantId) {
        headers['x-tenant-id'] = tenantId;
    }
    const url = `${SETTINGS_API_BASE}${path}`;
    try {
        const controller = new AbortController();
        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
        });
        if (!response.ok) {
            const message = response.statusText || 'Settings request failed';
            throw new SettingsAdapterError(message, response.status);
        }
        if (response.status === 204) {
            return undefined;
        }
        const text = await response.text();
        if (!text)
            return undefined;
        return JSON.parse(text);
    }
    catch (error) {
        if (options.fallback) {
            return options.fallback();
        }
        const message = error instanceof Error ? error.message : 'Settings request failed';
        throw new SettingsAdapterError(message, undefined, error);
    }
};
export const createHttpSettingsAdapter = () => {
    const memory = createMemorySettingsAdapter();
    return {
        async getUserSettings(userId) {
            return request(`/users/${encodeURIComponent(userId)}`, {
                method: 'GET',
                fallback: () => memory.getUserSettings(userId)
            });
        },
        async updateUserSettings(userId, changes) {
            return request(`/users/${encodeURIComponent(userId)}`, {
                method: 'PUT',
                body: JSON.stringify(changes),
                fallback: () => memory.updateUserSettings(userId, changes)
            });
        },
        async getTenantSettings(tenantId) {
            return request(`/tenants/${encodeURIComponent(tenantId)}`, {
                method: 'GET',
                fallback: () => memory.getTenantSettings(tenantId)
            });
        },
        async updateTenantSettings(tenantId, changes) {
            return request(`/tenants/${encodeURIComponent(tenantId)}`, {
                method: 'PUT',
                body: JSON.stringify(changes),
                fallback: () => memory.updateTenantSettings(tenantId, changes)
            });
        }
    };
};
