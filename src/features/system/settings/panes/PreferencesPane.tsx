import React from 'react';
import type { UserSettings } from '../../../../lib/settings/types';
import { useTranslation } from '../../../../lib/i18n';
import { Loader2 } from 'lucide-react';

type PreferencesPaneProps = {
  preferences: UserSettings['preferences'];
  onChange: (changes: UserSettings['preferences']) => void | Promise<void>;
  saving?: boolean;
};

const PreferencesPane: React.FC<PreferencesPaneProps> = ({ preferences, onChange, saving = false }) => {
  const { t } = useTranslation();
  const density = preferences?.density ?? 'comfortable';
  const enableAnimations = preferences?.enableAnimations ?? true;

  return (
    <section
      aria-labelledby="preferences-heading"
      className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 id="preferences-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t('settings.nav.preferences')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('settings.preferences.description', { defaultValue: 'Adjust list density and motion.' })}
          </p>
        </div>
        {saving ? (
          <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t('settings.saving')}
          </span>
        ) : null}
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('settings.preferences.density')}
          </p>
          <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            <label className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600">
              <input
                type="radio"
                name="table-density"
                value="comfortable"
                checked={density === 'comfortable'}
                onChange={() =>
                  onChange({
                    ...preferences,
                    density: 'comfortable'
                  })
                }
                className="h-4 w-4 border-slate-300 text-slate-700 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900"
              />
              <span>{t('settings.preferences.density.comfortable')}</span>
            </label>
            <label className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600">
              <input
                type="radio"
                name="table-density"
                value="compact"
                checked={density === 'compact'}
                onChange={() =>
                  onChange({
                    ...preferences,
                    density: 'compact'
                  })
                }
                className="h-4 w-4 border-slate-300 text-slate-700 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900"
              />
              <span>{t('settings.preferences.density.compact')}</span>
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('settings.preferences.animations')}
          </p>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <span>{enableAnimations ? t('settings.preferences.animations.on', { defaultValue: 'Enabled' }) : t('settings.preferences.animations.off', { defaultValue: 'Disabled' })}</span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...preferences,
                  enableAnimations: !enableAnimations
                })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition ${
                enableAnimations
                  ? 'border-slate-900 bg-slate-900 dark:border-slate-100 dark:bg-slate-100'
                  : 'border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-slate-800'
              }`}
              role="switch"
              aria-checked={enableAnimations}
            >
              <span
                className={`absolute left-1 h-4 w-4 rounded-full bg-white shadow transition ${
                  enableAnimations ? 'translate-x-5 bg-white dark:bg-slate-900' : 'translate-x-0'
                }`}
              />
              <span className="sr-only">{t('settings.preferences.animations')}</span>
            </button>
          </label>
        </div>
      </div>
    </section>
  );
};

export default PreferencesPane;
