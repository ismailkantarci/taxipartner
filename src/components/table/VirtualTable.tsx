import React, { useMemo, useRef } from 'react';
import type { Row, Table } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

type VirtualTableProps<TData> = {
  table: Table<TData>;
  height?: number;
  rowEstimate?: number;
  overscan?: number;
  className?: string;
  tableClassName?: string;
  headClassName?: string;
  headerCellClassName?: string;
  bodyClassName?: string;
  rowClassName?: string;
  cellClassName?: string;
  emptyMessage?: React.ReactNode;
  isLoading?: boolean;
  virtualizationThreshold?: number;
  getRowProps?: (row: Row<TData>) => React.HTMLAttributes<HTMLTableRowElement>;
};

const join = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const VirtualTable = <TData,>({
  table,
  height = 420,
  rowEstimate = 56,
  overscan = 8,
  className,
  tableClassName = 'min-w-full table-fixed divide-y divide-slate-200 dark:divide-slate-800',
  headClassName = 'bg-slate-50 text-left font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-300',
  headerCellClassName = 'px-4 py-3',
  bodyClassName = 'divide-y divide-slate-200 dark:divide-slate-800',
  rowClassName = 'hover:bg-slate-50 dark:hover:bg-slate-900/60',
  cellClassName = 'px-4 py-3 text-slate-600 dark:text-slate-200',
  emptyMessage,
  isLoading = false,
  virtualizationThreshold = 250,
  getRowProps
}: VirtualTableProps<TData>) => {
  const rows = table.getRowModel().rows;
  const headers = table.getHeaderGroups();
  const visibleColumns = table.getVisibleLeafColumns().length || 1;
  const parentRef = useRef<HTMLDivElement | null>(null);

  const useVirtual = rows.length >= virtualizationThreshold;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowEstimate,
    overscan
  });

  const virtualItems = useMemo(() => virtualizer.getVirtualItems(), [virtualizer]);
  const totalHeight = virtualizer.getTotalSize();

  if (rows.length === 0 && !isLoading) {
    return (
      <div
        className={join(
          'flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-12 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
          className
        )}
      >
        {emptyMessage ?? 'No records found.'}
      </div>
    );
  }

  const renderTable = (body: React.ReactNode) => (
    <table className={tableClassName}>
      <thead className={headClassName}>
        {headers.map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th key={header.id} scope="col" className={headerCellClassName}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      {body}
    </table>
  );

  if (!useVirtual) {
    return (
      <div
        ref={parentRef}
        className={join(
          'overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
          className
        )}
        style={{ maxHeight: height }}
      >
        {renderTable(
          <tbody className={bodyClassName}>
            {rows.map(row => {
              const extra = getRowProps?.(row) ?? {};
              const mergedClassName = join(rowClassName, extra.className);
              const { className: _ignoredClassName, style: extraStyle, ...rest } = extra;
              return (
                <tr key={row.id} className={mergedClassName} style={extraStyle} {...rest}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={cellClassName}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        )}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={join(
        'overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className
      )}
      style={{ maxHeight: height }}
    >
      {renderTable(
        <tbody
          className={join('relative block', bodyClassName)}
          style={{ minHeight: `${totalHeight}px` }}
        >
          {virtualItems.map(virtualRow => {
            const row = rows[virtualRow.index];
            const extra = getRowProps?.(row) ?? {};
            const { className: extraClassName, style: extraStyle, ...rest } = extra;
            const mergedClassName = join(
              'absolute left-0 right-0 w-full',
              rowClassName,
              extraClassName
            );
            return (
              <tr
                key={row.id}
                data-index={virtualRow.index}
                className={mergedClassName}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  ...(extraStyle ?? {})
                }}
                {...rest}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className={cellClassName}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {rows.length === 0 && isLoading ? (
            <tr>
              <td colSpan={visibleColumns} className={cellClassName}>
                Loading…
              </td>
            </tr>
          ) : null}
        </tbody>
      )}
    </div>
  );
};

export default VirtualTable;
