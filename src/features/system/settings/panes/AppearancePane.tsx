import React from 'react';
import { Monitor, Moon, Sun, Loader2 } from 'lucide-react';
import type { Theme } from '../../../../lib/settings/types';
import { useTranslation } from '../../../../lib/i18n';

const THEME_OPTIONS: Array<{
  value: Theme;
  icon: React.ReactNode;
  labelKey: string;
}> = [
  { value: 'light', icon: <Sun className="h-5 w-5" aria-hidden="true" />, labelKey: 'settings.theme.light' },
  { value: 'dark', icon: <Moon className="h-5 w-5" aria-hidden="true" />, labelKey: 'settings.theme.dark' },
  {
    value: 'system',
    icon: <Monitor className="h-5 w-5" aria-hidden="true" />,
    labelKey: 'settings.theme.system'
  }
];

type AppearancePaneProps = {
  value: Theme;
  onChange: (theme: Theme) => void | Promise<void>;
  saving?: boolean;
};

const AppearancePane: React.FC<AppearancePaneProps> = ({ value, onChange, saving = false }) => {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="appearance-heading"
      className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 id="appearance-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t('settings.nav.appearance')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.theme.label')}</p>
        </div>
        {saving ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs text-slate-500 dark:bg-slate-100/10 dark:text-slate-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t('settings.saving')}
          </span>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map(option => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex flex-col items-start gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:focus-visible:outline-slate-400 ${
                isActive
                  ? 'border-slate-900 bg-slate-900 text-white shadow-md dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'
              }`}
            >
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                  isActive
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {option.icon}
              </span>
              <div>
                <p className="text-sm font-semibold capitalize">{t(option.labelKey)}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {option.value === 'system'
                    ? t('settings.theme.system')
                    : option.value === 'dark'
                    ? t('settings.theme.dark')
                    : t('settings.theme.light')}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default AppearancePane;
