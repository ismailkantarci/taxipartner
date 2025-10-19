import React from 'react';
import { cx } from './utils';

type CrudLayoutProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  filterBar?: React.ReactNode;
  children: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  listClassName?: string;
  detailClassName?: string;
  stickyDetail?: boolean;
};

export const CrudLayout: React.FC<CrudLayoutProps> = ({
  title,
  subtitle,
  description,
  actions,
  filterBar,
  children,
  detail,
  className,
  contentClassName,
  listClassName,
  detailClassName,
  stickyDetail = true
}) => {
  return (
    <div className={cx('flex flex-col gap-6 lg:gap-8', className)}>
      {title || subtitle || actions ? (
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            {title ? (
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
            ) : null}
            {subtitle ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
            {description ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">{actions}</div>
          ) : null}
        </header>
      ) : null}

      {filterBar ? (
        <div className="lg:sticky lg:top-20 lg:z-10">{filterBar}</div>
      ) : null}

      <div
        className={cx(
          'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]',
          contentClassName
        )}
      >
        <section className={cx('space-y-4 lg:space-y-6', listClassName)}>{children}</section>
        {detail ? (
          <aside
            className={cx(
              'space-y-4 lg:space-y-6',
              stickyDetail ? 'lg:sticky lg:top-24' : null,
              detailClassName
            )}
          >
            {detail}
          </aside>
        ) : null}
      </div>
    </div>
  );
};

export default CrudLayout;
