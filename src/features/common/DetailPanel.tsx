import React from 'react';
import { cx } from './utils';

type DetailPanelProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  stickyHeader?: boolean;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
};

export const DetailPanel: React.FC<DetailPanelProps> = ({
  title,
  subtitle,
  actions,
  footer,
  stickyHeader = false,
  children,
  className,
  bodyClassName
}) => (
  <section
    className={cx(
      'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
      className
    )}
  >
    {(title || subtitle || actions) && (
      <header
        className={cx(
          'flex flex-col gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between',
          stickyHeader ? 'lg:sticky lg:top-0 lg:z-10 lg:bg-white lg:dark:bg-slate-900' : null
        )}
      >
        <div className="space-y-1">
          {title ? (
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
    )}
    <div className={cx('px-5 py-4 text-sm text-slate-600 dark:text-slate-200', bodyClassName)}>
      {children}
    </div>
    {footer ? (
      <footer className="border-t border-slate-200 px-5 py-3 text-sm dark:border-slate-800">
        {footer}
      </footer>
    ) : null}
  </section>
);

export default DetailPanel;
