import React from 'react';
import type { Table } from '@tanstack/react-table';
import VirtualTable from '../../components/table/VirtualTable';
import type { Row } from '@tanstack/react-table';
import { cx } from './utils';

export type DataGridProps<TData> = {
  table: Table<TData>;
  height?: number;
  rowEstimate?: number;
  overscan?: number;
  className?: string;
  emptyMessage?: React.ReactNode;
  isLoading?: boolean;
  virtualizationThreshold?: number;
  tableClassName?: string;
  getRowProps?: (row: Row<TData>) => React.HTMLAttributes<HTMLTableRowElement>;
};

export const DataGrid = <TData,>({
  table,
  height,
  rowEstimate,
  overscan,
  className,
  emptyMessage,
  isLoading,
  virtualizationThreshold,
  tableClassName,
  getRowProps
}: DataGridProps<TData>) => (
  <VirtualTable<TData>
    table={table}
    height={height}
    rowEstimate={rowEstimate}
    overscan={overscan}
    emptyMessage={emptyMessage}
    isLoading={isLoading}
    virtualizationThreshold={virtualizationThreshold}
    className={cx('border border-slate-200 shadow-sm dark:border-slate-800', className)}
    tableClassName={tableClassName}
    getRowProps={getRowProps}
  />
);

export default DataGrid;
