import React from 'react';
import { useTranslation } from '../../../lib/i18n';
import { cx } from '../../common/utils';

type Props = {
  status?: string | null;
};

const palette: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  suspended: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  ruhend: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  deleted: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
};

const TenantStatusBadge: React.FC<Props> = ({ status }) => {
  const { t } = useTranslation();

  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        {t('tenants.status.unknown', { defaultValue: 'Unknown' })}
      </span>
    );
  }

  const normalized = status.toLowerCase();
  const className =
    palette[normalized] ??
    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200';

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        className
      )}
    >
      {status}
    </span>
  );
};

export default TenantStatusBadge;
