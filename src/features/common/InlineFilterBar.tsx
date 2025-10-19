import React from 'react';
import { cx } from './utils';

type InlineFilterBarProps = {
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  actionsClassName?: string;
  filtersClassName?: string;
};

export const InlineFilterBar: React.FC<InlineFilterBarProps> = ({
  filters,
  actions,
  children,
  className,
  actionsClassName,
  filtersClassName
}) => (
  <div
    className={cx(
      'flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900',
      className
    )}
  >
    <div className={cx('flex flex-wrap items-center gap-3', filtersClassName)}>
      {filters ?? children}
    </div>
    {actions ? (
      <div className={cx('flex flex-wrap items-center gap-2', actionsClassName)}>{actions}</div>
    ) : null}
  </div>
);

export default InlineFilterBar;
