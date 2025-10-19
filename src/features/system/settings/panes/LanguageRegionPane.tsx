import React from 'react';
import type { LocalePrefs } from '../../../../lib/settings/types';
import { AVAILABLE_LANGUAGES, useTranslation } from '../../../../lib/i18n';
import { Loader2 } from 'lucide-react';

const SAMPLE_DATE = new Date('2025-03-14T10:30:00Z');
const SAMPLE_NUMBER = 1234567.89;

type LanguageRegionPaneProps = {
  userLocale: LocalePrefs;
  tenantLocale: LocalePrefs | null;
  onUserLocaleChange: (changes: Partial<LocalePrefs>) => void | Promise<void>;
  onTenantLocaleChange?: (changes: Partial<LocalePrefs>) => void | Promise<void>;
  savingUser?: boolean;
  savingTenant?: boolean;
  canManageTenant?: boolean;
};

const formatPreviewNumber = (prefs: LocalePrefs) => {
  const formatter = new Intl.NumberFormat(prefs.locale, {
    maximumFractionDigits: 2
  });
  const parts = formatter.formatToParts(SAMPLE_NUMBER);
  return parts
    .map(part => {
      if (part.type !== 'group') return part.value;
      if (prefs.numberGrouping === 'space') return ' ';
      if (prefs.numberGrouping === 'dot') return '.';
      return part.value;
    })
    .join('');
};

const formatPreviewDate = (prefs: LocalePrefs) =>
  new Intl.DateTimeFormat(prefs.locale, { dateStyle: prefs.dateStyle }).format(SAMPLE_DATE);

const LocaleSection: React.FC<{
  title: string;
  locale: LocalePrefs;
  onChange: (changes: Partial<LocalePrefs>) => void | Promise<void>;
  saving?: boolean;
  disabled?: boolean;
}> = ({ title, locale, onChange, saving = false, disabled = false }) => {
  const { t } = useTranslation();
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
        {saving ? (
          <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t('settings.saving')}
          </span>
        ) : null}
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('settings.locale.language')}
          <select
            value={locale.locale}
            onChange={event => onChange({ locale: event.target.value as LocalePrefs['locale'] })}
            disabled={disabled}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/40 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-slate-400"
          >
            {AVAILABLE_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {t(lang.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('settings.locale.dateStyle')}
          <select
            value={locale.dateStyle}
            onChange={event => onChange({ dateStyle: event.target.value as LocalePrefs['dateStyle'] })}
            disabled={disabled}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/40 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-slate-400"
          >
            <option value="short">{t('settings.locale.dateStyle.short')}</option>
            <option value="medium">{t('settings.locale.dateStyle.medium')}</option>
            <option value="long">{t('settings.locale.dateStyle.long')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('settings.locale.numberGrouping')}
          <select
            value={locale.numberGrouping}
            onChange={event =>
              onChange({ numberGrouping: event.target.value as LocalePrefs['numberGrouping'] })
            }
            disabled={disabled}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/40 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-slate-400"
          >
            <option value="auto">{t('settings.locale.grouping.auto')}</option>
            <option value="space">{t('settings.locale.grouping.space')}</option>
            <option value="dot">{t('settings.locale.grouping.dot')}</option>
          </select>
        </label>
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p className="font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {t('settings.locale.preview')}
        </p>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{formatPreviewDate(locale)}</p>
        <p className="text-sm text-slate-700 dark:text-slate-200">{formatPreviewNumber(locale)}</p>
      </div>
    </section>
  );
};

const LanguageRegionPane: React.FC<LanguageRegionPaneProps> = ({
  userLocale,
  tenantLocale,
  onUserLocaleChange,
  onTenantLocaleChange,
  savingUser = false,
  savingTenant = false,
  canManageTenant = false
}) => {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="language-heading"
      className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="space-y-1">
        <h2 id="language-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t('settings.nav.language')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('settings.description')}
        </p>
      </header>
      <LocaleSection
        title={t('settings.locale.section.user')}
        locale={userLocale}
        onChange={onUserLocaleChange}
        saving={savingUser}
      />
      {canManageTenant && tenantLocale && onTenantLocaleChange ? (
        <LocaleSection
          title={t('settings.locale.section.tenant')}
          locale={tenantLocale}
          onChange={onTenantLocaleChange}
          saving={savingTenant}
        />
      ) : null}
    </section>
  );
};

export default LanguageRegionPane;
