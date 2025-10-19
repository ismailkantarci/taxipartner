import { getTenantId } from '../tenant/store';
import type { TenantSettings, UserSettings } from '../settings/types';
import {
  SYSTEM_DEFAULT_LOCALE,
  SYSTEM_DEFAULT_USER_SETTINGS
} from '../settings/types';

class SettingsAdapterError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number, cause?: unknown) {
    super(message);
    this.name = 'SettingsAdapterError';
    this.statusCode = statusCode;
    if (cause) {
      this.cause = cause;
    }
  }
}

const cloneDeep = <T>(value: T): T =>
  typeof globalThis.structuredClone === 'function'
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const cloneUser = (value: UserSettings | null) => (value ? cloneDeep(value) : null);
const cloneTenant = (value: TenantSettings | null) => (value ? cloneDeep(value) : null);

export type SettingsAdapter = {
  getUserSettings(userId: string): Promise<UserSettings | null>;
  updateUserSettings(userId: string, changes: Partial<UserSettings>): Promise<UserSettings>;
  getTenantSettings(tenantId: string): Promise<TenantSettings | null>;
  updateTenantSettings(tenantId: string, changes: Partial<TenantSettings>): Promise<TenantSettings>;
};

const applyUserMerge = (
  current: UserSettings | null,
  changes: Partial<UserSettings>
): UserSettings => {
  const next: UserSettings = {
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

const applyTenantMerge = (
  current: TenantSettings | null,
  changes: Partial<TenantSettings>
): TenantSettings => {
  const next: TenantSettings = {
    defaultLocale: {
      ...SYSTEM_DEFAULT_LOCALE,
      ...(current?.defaultLocale ?? {}),
      ...(changes.defaultLocale ?? {})
    },
    defaults: {
      theme:
        changes.defaults?.theme ?? current?.defaults?.theme ?? SYSTEM_DEFAULT_USER_SETTINGS.theme,
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

export const createMemorySettingsAdapter = (): SettingsAdapter => {
  const userStore = new Map<string, UserSettings>();
  const tenantStore = new Map<string, TenantSettings>();

  return {
    async getUserSettings(userId: string) {
      const value = userStore.get(userId) ?? null;
      return cloneUser(value);
    },
    async updateUserSettings(userId: string, changes: Partial<UserSettings>) {
      const existing = userStore.get(userId) ?? null;
      const next = applyUserMerge(existing, changes);
      userStore.set(userId, next);
      return cloneUser(next)!;
    },
    async getTenantSettings(tenantId: string) {
      const value = tenantStore.get(tenantId) ?? null;
      return cloneTenant(value);
    },
    async updateTenantSettings(tenantId: string, changes: Partial<TenantSettings>) {
      const existing = tenantStore.get(tenantId) ?? null;
      const next = applyTenantMerge(existing, changes);
      tenantStore.set(tenantId, next);
      return cloneTenant(next)!;
    }
  };
};

const SETTINGS_API_BASE = import.meta.env.VITE_SETTINGS_API_BASE ?? '/api/settings';
const ENABLE_HTTP_SETTINGS = import.meta.env.VITE_ENABLE_HTTP_SETTINGS !== 'false';

const request = async <T>(
  path: string,
  options: RequestInit & { fallback?: () => Promise<T> }
): Promise<T> => {
  if (!ENABLE_HTTP_SETTINGS) {
    if (options.fallback) return options.fallback();
    throw new SettingsAdapterError('HTTP settings adapter disabled');
  }

  const tenantId = getTenantId();
  const headers: HeadersInit = {
    Accept: 'application/json'
  };

  if (options.body && !(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  if (tenantId) {
    (headers as Record<string, string>)['x-tenant-id'] = tenantId;
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
      return undefined as T;
    }
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (error) {
    if (options.fallback) {
      return options.fallback();
    }
    const message = error instanceof Error ? error.message : 'Settings request failed';
    throw new SettingsAdapterError(message, undefined, error);
  }
};

export const createHttpSettingsAdapter = (): SettingsAdapter => {
  const memory = createMemorySettingsAdapter();

  return {
    async getUserSettings(userId) {
      return request<UserSettings | null>(`/users/${encodeURIComponent(userId)}`, {
        method: 'GET',
        fallback: () => memory.getUserSettings(userId)
      });
    },
    async updateUserSettings(userId, changes) {
      return request<UserSettings>(`/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        body: JSON.stringify(changes),
        fallback: () => memory.updateUserSettings(userId, changes)
      });
    },
    async getTenantSettings(tenantId) {
      return request<TenantSettings | null>(`/tenants/${encodeURIComponent(tenantId)}`, {
        method: 'GET',
        fallback: () => memory.getTenantSettings(tenantId)
      });
    },
    async updateTenantSettings(tenantId, changes) {
      return request<TenantSettings>(`/tenants/${encodeURIComponent(tenantId)}`, {
        method: 'PUT',
        body: JSON.stringify(changes),
        fallback: () => memory.updateTenantSettings(tenantId, changes)
      });
    }
  };
};
