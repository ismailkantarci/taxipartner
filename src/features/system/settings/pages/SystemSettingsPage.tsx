import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useGuardContext, useCan } from '../../../../lib/rbac/guard';
import {
  loadSettings,
  saveTenantSettings,
  saveUserSettings,
  useEffectiveSettings,
  useSettingsState
} from '../../../../lib/settings/store';
import type { LocalePrefs, Theme, UserSettings } from '../../../../lib/settings/types';
import AppearancePane from '../panes/AppearancePane';
import LanguageRegionPane from '../panes/LanguageRegionPane';
import PreferencesPane from '../panes/PreferencesPane';
import { useToast } from '../../../../components/feedback/ToastProvider';
import { useTranslation } from '../../../../lib/i18n';
import { SYSTEM_DEFAULT_USER_SETTINGS } from '../../../../lib/settings/types';

type ActiveTab = 'appearance' | 'language' | 'preferences';

const tabs: Array<{ id: ActiveTab; labelKey: string }> = [
  { id: 'appearance', labelKey: 'settings.nav.appearance' },
  { id: 'language', labelKey: 'settings.nav.language' },
  { id: 'preferences', labelKey: 'settings.nav.preferences' }
];

const SystemSettingsPage: React.FC = () => {
  const { user: currentUser, currentTenantId } = useGuardContext();
  const { user, tenant, loaded } = useSettingsState();
  const effective = useEffectiveSettings();
  const [activeTab, setActiveTab] = useState<ActiveTab>('appearance');
  const [saving, setSaving] = useState({
    appearance: false,
    languageUser: false,
    languageTenant: false,
    preferences: false
  });
  const { showToast } = useToast();
  const { t } = useTranslation();
  const canManageTenantDefaults = useCan('system.settings.write');

  useEffect(() => {
    if (!currentUser?.id) return;
    loadSettings({
      userId: currentUser.id,
      tenantId: currentTenantId ?? null
    }).catch(error => {
      console.warn('[settings] load failed', error);
    });
  }, [currentUser?.id, currentTenantId]);

  const handleThemeChange = async (theme: Theme) => {
    if (theme === effective.theme || saving.appearance) return;
    setSaving(prev => ({ ...prev, appearance: true }));
    try {
      await saveUserSettings({ theme });
      showToast({
        title: t('settings.saved'),
        tone: 'success'
      });
    } catch (error) {
      console.error('[settings] theme update failed', error);
      showToast({
        title: t('settings.error', { defaultValue: 'Unable to update settings.' }),
        tone: 'error'
      });
    } finally {
      setSaving(prev => ({ ...prev, appearance: false }));
    }
  };

  const mergeLocale = (base: LocalePrefs, changes: Partial<LocalePrefs>): LocalePrefs => ({
    ...base,
    ...changes
  });

  const handleUserLocaleChange = async (changes: Partial<LocalePrefs>) => {
    if (saving.languageUser) return;
    const nextLocale = mergeLocale(effective.locale, changes);
    setSaving(prev => ({ ...prev, languageUser: true }));
    try {
      await saveUserSettings({
        locale: nextLocale
      });
      showToast({
        title: t('settings.saved'),
        tone: 'success'
      });
    } catch (error) {
      console.error('[settings] locale update failed', error);
      showToast({
        title: t('settings.error', { defaultValue: 'Unable to update settings.' }),
        tone: 'error'
      });
    } finally {
      setSaving(prev => ({ ...prev, languageUser: false }));
    }
  };

  const handleTenantLocaleChange = async (changes: Partial<LocalePrefs>) => {
    if (!tenant || !canManageTenantDefaults || saving.languageTenant) return;
    const nextLocale = mergeLocale(tenant.defaultLocale, changes);
    setSaving(prev => ({ ...prev, languageTenant: true }));
    try {
      await saveTenantSettings({
        defaultLocale: nextLocale,
        defaults: {
          ...tenant.defaults,
          locale: nextLocale
        }
      });
      showToast({
        title: t('settings.saved'),
        tone: 'success'
      });
    } catch (error) {
      console.error('[settings] tenant locale update failed', error);
      showToast({
        title: t('settings.error', { defaultValue: 'Unable to update settings.' }),
        tone: 'error'
      });
    } finally {
      setSaving(prev => ({ ...prev, languageTenant: false }));
    }
  };

  const handlePreferencesChange = async (prefs: UserSettings['preferences']) => {
    if (saving.preferences) return;
    setSaving(prev => ({ ...prev, preferences: true }));
    try {
      await saveUserSettings({
        preferences: {
          ...SYSTEM_DEFAULT_USER_SETTINGS.preferences,
          ...(user?.preferences ?? {}),
          ...(prefs ?? {})
        }
      });
      showToast({
        title: t('settings.saved'),
        tone: 'success'
      });
    } catch (error) {
      console.error('[settings] preferences update failed', error);
      showToast({
        title: t('settings.error', { defaultValue: 'Unable to update settings.' }),
        tone: 'error'
      });
    } finally {
      setSaving(prev => ({ ...prev, preferences: false }));
    }
  };

  const tenantLocale = useMemo<LocalePrefs | null>(() => {
    if (!tenant) return null;
    return {
      ...tenant.defaultLocale
    };
  }, [tenant]);

  if (!loaded) {
    return (
      <section className="flex flex-1 items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="ml-2">{t('settings.loading', { defaultValue: 'Loading settings…' })}</span>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t('settings.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.description')}</p>
      </header>

      <nav aria-label={t('settings.title')} className="flex flex-wrap gap-2">
        {tabs.map(tab => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:focus-visible:outline-slate-400 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                  : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </nav>

      {activeTab === 'appearance' ? (
        <AppearancePane
          value={effective.theme}
          onChange={handleThemeChange}
          saving={saving.appearance}
        />
      ) : null}

      {activeTab === 'language' ? (
        <LanguageRegionPane
          userLocale={effective.locale}
          tenantLocale={tenantLocale}
          onUserLocaleChange={handleUserLocaleChange}
          onTenantLocaleChange={handleTenantLocaleChange}
          savingUser={saving.languageUser}
          savingTenant={saving.languageTenant}
          canManageTenant={canManageTenantDefaults}
        />
      ) : null}

      {activeTab === 'preferences' ? (
        <PreferencesPane
          preferences={effective.preferences ?? SYSTEM_DEFAULT_USER_SETTINGS.preferences}
          onChange={handlePreferencesChange}
          saving={saving.preferences}
        />
      ) : null}
    </section>
  );
};

export default SystemSettingsPage;
