import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEffectiveSettings,
  loadSettings,
  registerSettingsAdapter,
  resetSettingsState,
  saveUserSettings
} from '../store';
import type { SettingsAdapter } from '../../repo/settings';
import type { TenantSettings, UserSettings } from '../types';

const noop = vi.fn();

const createAdapter = (options: {
  user?: UserSettings | null;
  tenant?: TenantSettings | null;
}) => {
  const user = options.user ?? null;
  const tenant = options.tenant ?? null;
  return {
    getUserSettings: vi.fn().mockResolvedValue(user),
    updateUserSettings: vi.fn().mockImplementation(async (_id: string, changes: Partial<UserSettings>) => ({
      theme: changes.theme ?? user?.theme ?? 'system',
      locale: {
        locale: changes.locale?.locale ?? user?.locale.locale ?? 'de-AT',
        dateStyle: changes.locale?.dateStyle ?? user?.locale.dateStyle ?? 'medium',
        numberGrouping: changes.locale?.numberGrouping ?? user?.locale.numberGrouping ?? 'auto'
      },
      preferences: {
        density: changes.preferences?.density ?? user?.preferences?.density ?? 'comfortable',
        enableAnimations:
          changes.preferences?.enableAnimations ??
          user?.preferences?.enableAnimations ??
          true
      }
    })),
    getTenantSettings: vi.fn().mockResolvedValue(tenant),
    updateTenantSettings: vi.fn().mockResolvedValue(tenant ?? null)
  } satisfies SettingsAdapter;
};

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: noop,
      removeEventListener: noop
    })
  });
});

describe('settings store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSettingsState();
  });

  it('falls back to system defaults when no data is returned', async () => {
    registerSettingsAdapter(createAdapter({}));
    await loadSettings({ userId: 'user-default', tenantId: null });
    const effective = getEffectiveSettings();
    expect(effective.theme).toBe('system');
    expect(effective.locale.locale).toBe('de-AT');
    expect(effective.preferences?.density).toBe('comfortable');
  });

  it('merges settings with precedence user > tenant > system', async () => {
    const tenant: TenantSettings = {
      defaultLocale: {
        locale: 'en-GB',
        dateStyle: 'long',
        numberGrouping: 'space'
      },
      defaults: {
        theme: 'light',
        locale: {
          locale: 'en-GB',
          dateStyle: 'short',
          numberGrouping: 'dot'
        },
        preferences: {
          enableAnimations: false
        }
      }
    };

    const user: UserSettings = {
      theme: 'dark',
      locale: {
        locale: 'tr-TR',
        dateStyle: 'short',
        numberGrouping: 'dot'
      },
      preferences: {
        density: 'compact'
      }
    };

    registerSettingsAdapter(createAdapter({ user, tenant }));
    await loadSettings({ userId: 'user-tenant', tenantId: 'tenant-1' });

    const effective = getEffectiveSettings();
    expect(effective.theme).toBe('dark');
    expect(effective.locale.locale).toBe('tr-TR');
    expect(effective.locale.numberGrouping).toBe('dot');
    expect(effective.preferences?.density).toBe('compact');
    expect(effective.preferences?.enableAnimations).toBe(false);
  });

  it('optimistically applies locale changes before the adapter resolves', async () => {
    const adapter = createAdapter({
      user: {
        theme: 'system',
        locale: {
          locale: 'de-AT',
          dateStyle: 'medium',
          numberGrouping: 'auto'
        },
        preferences: {
          density: 'comfortable',
          enableAnimations: true
        }
      }
    });
    registerSettingsAdapter(adapter);
    await loadSettings({ userId: 'user-change', tenantId: null });

    const pending = saveUserSettings({
      locale: {
        locale: 'en-GB',
        dateStyle: 'long',
        numberGrouping: 'space'
      }
    });

    const immediate = getEffectiveSettings();
    expect(immediate.locale.locale).toBe('en-GB');

    await pending;
    const final = getEffectiveSettings();
    expect(final.locale.locale).toBe('en-GB');
    expect(adapter.updateUserSettings).toHaveBeenCalledWith(
      'user-change',
      expect.objectContaining({
        locale: expect.objectContaining({ locale: 'en-GB' })
      })
    );
  });
});
