import React, { useEffect, useMemo, useState } from 'react';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { ColumnDef, SortingState, VisibilityState } from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Loader2,
  PlusCircle,
  Search
} from 'lucide-react';
import {
  useComplianceList,
  useCreateCompliance,
  useDeleteCompliance,
  useUpdateCompliance
} from '../../features/compliance/api';
import type {
  ComplianceCategory,
  ComplianceRecord,
  ComplianceStatus
} from '../../lib/repo/compliance/types';
import ViewsMenu from '../../components/views/ViewsMenu';
import QueryErrorBoundary from '../../components/errors/QueryErrorBoundary';
import VirtualTable from '../../components/table/VirtualTable';
import { Guard } from '../../lib/rbac/guard';
import GoalForm from '../../features/program/goals/GoalForm';
import Modal from '../../components/overlay/Modal';
import ConfirmDialog from '../../components/overlay/ConfirmDialog';
import { useToast } from '../../components/feedback/ToastProvider';
import type { GoalFormValues } from '../../lib/forms/validation';
import useQuerySync from '../../hooks/useQuerySync';
import { startCsvExport } from '../../lib/export/exportCsv';

const STATUS_OPTIONS: ComplianceStatus[] = ['ok', 'attention', 'blocked'];

const statusBadgeStyles: Record<ComplianceStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  attention: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  blocked: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
};

const toGoalFormValues = (record: ComplianceRecord): GoalFormValues => ({
  name: record.name,
  owner: record.owner,
  audits: record.items ?? 0,
  dynamicStatus: record.status as any
});

const ALL_COLUMN_IDS = ['status', 'name', 'owner', 'items', 'updatedAt', 'actions'] as const;
type ComplianceColumnId = (typeof ALL_COLUMN_IDS)[number];
type ComplianceSortKey = Exclude<ComplianceColumnId, 'actions'>;

const COLUMN_HEADERS: Record<(typeof ALL_COLUMN_IDS)[number], string> = {
  status: 'Status',
  name: 'Name',
  owner: 'Owner',
  items: 'Items',
  updatedAt: 'Updated',
  actions: 'Actions'
};

const COLUMN_ACCESSORS: Record<
  Exclude<(typeof ALL_COLUMN_IDS)[number], 'actions'>,
  (record: ComplianceRecord) => unknown
> = {
  status: record => record.status,
  name: record => record.name,
  owner: record => record.owner,
  items: record => record.items ?? '',
  updatedAt: record => record.updatedAt
};

const mapVisibleToState = (visible: readonly string[]): VisibilityState => {
  const hidden = ALL_COLUMN_IDS.filter(id => !visible.includes(id));
  return hidden.reduce<VisibilityState>((acc, columnId) => {
    acc[columnId] = false;
    return acc;
  }, {});
};

const extractVisible = (visibility: VisibilityState) =>
  ALL_COLUMN_IDS.filter(id => visibility[id] !== false);

const mapSortingFromQuery = (sort: string, order: 'asc' | 'desc'): SortingState =>
  sort ? [{ id: sort, desc: order === 'desc' }] : [];

const DEFAULT_SORT = { sort: 'updatedAt', order: 'desc' as const };

type QueryState = {
  q: string;
  status: string[];
  sort: string;
  order: string;
  page: number;
  pageSize: number;
  cols: string[];
};

const QueryDefaults: QueryState = {
  q: '',
  status: [],
  sort: DEFAULT_SORT.sort,
  order: DEFAULT_SORT.order,
  page: 0,
  pageSize: 20,
  cols: [...ALL_COLUMN_IDS]
};

const allowedColumns = new Set<string>(ALL_COLUMN_IDS);
const isComplianceSort = (value: string): value is ComplianceSortKey =>
  value !== 'actions' && allowedColumns.has(value);

const ComplianceCategoryContent: React.FC<{
  category: ComplianceCategory;
  title: string;
  description: string;
}> = ({ category, title, description }) => {
  const { showToast } = useToast();
  const [query, setQuery] = useQuerySync<QueryState>({
    defaults: QueryDefaults,
    schema: {
      q: 'string',
      status: 'string[]',
      sort: 'string',
      order: 'string',
      page: 'number',
      pageSize: 'number',
      cols: 'string[]'
    }
  });
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit' | null; record?: ComplianceRecord }>({
    mode: null
  });
  const [deleteTarget, setDeleteTarget] = useState<ComplianceRecord | null>(null);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const sortKey = isComplianceSort(query.sort) ? query.sort : DEFAULT_SORT.sort;
  const sortOrder: 'asc' | 'desc' = query.order === 'asc' ? 'asc' : 'desc';

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    mapVisibleToState(query.cols.length ? query.cols : ALL_COLUMN_IDS)
  );
  const [sorting, setSorting] = useState<SortingState>(() =>
    mapSortingFromQuery(sortKey, sortOrder)
  );
  const [pagination, setPagination] = useState({
    pageIndex: query.page,
    pageSize: query.pageSize
  });

  useEffect(() => {
    setColumnVisibility(prev => {
      const next = mapVisibleToState(query.cols.length ? query.cols : ALL_COLUMN_IDS);
      const prevVisible = extractVisible(prev).join(',');
      const nextVisible = extractVisible(next).join(',');
      return prevVisible === nextVisible ? prev : next;
    });
  }, [query.cols]);

  useEffect(() => {
    const nextSortKey = isComplianceSort(query.sort) ? query.sort : DEFAULT_SORT.sort;
    const nextOrder: 'asc' | 'desc' = query.order === 'asc' ? 'asc' : 'desc';
    setSorting(mapSortingFromQuery(nextSortKey, nextOrder));
  }, [query.sort, query.order]);

  useEffect(() => {
    setPagination(prev => {
      if (prev.pageIndex === query.page && prev.pageSize === query.pageSize) {
        return prev;
      }
      return {
        pageIndex: query.page,
        pageSize: query.pageSize
      };
    });
  }, [query.page, query.pageSize]);

  useEffect(() => {
    if (!columnMenuOpen) return undefined;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-column-menu]')) {
        setColumnMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [columnMenuOpen]);

  const selectedStatuses = useMemo(
    () =>
      query.status.filter((value): value is ComplianceStatus =>
        STATUS_OPTIONS.includes(value as ComplianceStatus)
      ),
    [query.status]
  );

  const visibleColumns = useMemo(() => extractVisible(columnVisibility), [columnVisibility]);

  const listQuery = useMemo(
    () => ({
      category,
      q: query.q,
      status: selectedStatuses,
      sort: sortKey,
      order: sortOrder,
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      cols: visibleColumns
    }),
    [category, query.q, selectedStatuses, sortKey, sortOrder, pagination.pageIndex, pagination.pageSize, visibleColumns]
  );

  const list = useComplianceList(listQuery);
  const createMutation = useCreateCompliance();
  const updateMutation = useUpdateCompliance();
  const deleteMutation = useDeleteCompliance();

  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  const columns = useMemo<ColumnDef<ComplianceRecord>[]>(
    () => [
      {
        accessorKey: 'status',
        header: () => 'Status',
        cell: info => (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              statusBadgeStyles[info.getValue() as ComplianceStatus]
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {String(info.getValue())}
          </span>
        ),
        enableSorting: true
      },
      {
        accessorKey: 'name',
        header: () => 'Name',
        cell: info => (
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">{String(info.getValue())}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{info.row.original.id}</p>
          </div>
        ),
        enableSorting: true
      },
      {
        accessorKey: 'owner',
        header: () => 'Owner',
        cell: info => String(info.getValue()),
        enableSorting: true
      },
      {
        accessorKey: 'items',
        header: () => 'Items',
        cell: info => info.getValue() ?? '-',
        enableSorting: true
      },
      {
        accessorKey: 'updatedAt',
        header: () => 'Updated',
        cell: info => new Date(String(info.getValue())).toLocaleString(),
        enableSorting: true
      },
      {
        id: 'actions',
        header: () => 'Actions',
        cell: info => (
          <div className="flex gap-2">
            <Guard can="compliance.write">
              <button
                type="button"
                onClick={() => setModalState({ mode: 'edit', record: info.row.original })}
                className="text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-300"
              >
                Edit
              </button>
            </Guard>
            <Guard can="compliance.delete" fallback={null}>
              <button
                type="button"
                onClick={() => setDeleteTarget(info.row.original)}
                className="text-xs text-rose-500 underline-offset-2 hover:underline"
              >
                Delete
              </button>
            </Guard>
          </div>
        )
      }
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnVisibility,
      pagination
    },
    onSortingChange: updater => {
      setSorting(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (!next.length) {
          setQuery({ sort: DEFAULT_SORT.sort, order: DEFAULT_SORT.order });
          return next;
        }
        const [first] = next;
        const sortId = isComplianceSort(first.id) ? first.id : DEFAULT_SORT.sort;
        setQuery({ sort: sortId, order: first.desc ? 'desc' : 'asc' });
        return next;
      });
    },
    onColumnVisibilityChange: updater => {
      setColumnVisibility(prev => {
        const next =
          typeof updater === 'function' ? updater(prev) : (updater as VisibilityState);
        const visible = extractVisible(next);
        setQuery({ cols: visible });
        return next;
      });
    },
    onPaginationChange: updater => {
      setPagination(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next.pageSize !== prev.pageSize) {
          setQuery({ pageSize: next.pageSize, page: 0 });
          return { ...next, pageIndex: 0 };
        }
        if (next.pageIndex !== prev.pageIndex) {
          setQuery({ page: next.pageIndex });
        }
        return next;
      });
    },
    getCoreRowModel: getCoreRowModel(),
    enableSortingRemoval: true,
    manualSorting: true,
    manualPagination: true,
    autoResetPageIndex: false,
    pageCount: Math.max(1, Math.ceil(total / Math.max(1, pagination.pageSize))),
    debugTable: false
  });

  const handleSubmit = async (values: GoalFormValues) => {
    if (modalState.mode === 'edit' && modalState.record) {
      await updateMutation.mutateAsync({
        id: modalState.record.id,
        input: {
          name: values.name,
          owner: values.owner,
          status: values.dynamicStatus as ComplianceStatus,
          items: values.audits,
          summary: modalState.record.summary
        }
      });
      showToast({
        title: 'Compliance item updated',
        description: values.name,
        tone: 'success'
      });
    } else {
      const record = await createMutation.mutateAsync({
        name: values.name,
        owner: values.owner,
        status: values.dynamicStatus as ComplianceStatus,
        items: values.audits,
        summary: values.name,
        category
      });
      showToast({
        title: 'Compliance item created',
        description: record.name,
        tone: 'success'
      });
    }
    setModalState({ mode: null });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const toggleStatus = (status: ComplianceStatus) => {
    const current = new Set(selectedStatuses);
    if (current.has(status)) {
      current.delete(status);
    } else {
      current.add(status);
    }
    setQuery({ status: Array.from(current), page: 0 });
  };

  const clearFilters = () => {
    setQuery({ q: '', status: [], page: 0 });
  };

  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pagination.pageSize)));
  const currentPage = pagination.pageIndex;
  const hasFilters = Boolean(query.q || selectedStatuses.length);

  const handleExport = () => {
    const exportColumns = visibleColumns
      .filter(columnId => columnId !== 'actions')
      .map(columnId => {
        const header = COLUMN_HEADERS[columnId as (typeof ALL_COLUMN_IDS)[number]] ?? columnId;
        const accessor =
          COLUMN_ACCESSORS[columnId as keyof typeof COLUMN_ACCESSORS] ??
          ((record: ComplianceRecord) => (record as Record<string, unknown>)[columnId]);
        return {
          id: columnId,
          header,
          accessor
        };
      });

    startCsvExport<ComplianceRecord>({
      module: `compliance-${category}`,
      filename: `${category}-compliance.csv`,
      columns: exportColumns,
      rows,
      totalCount: total,
      query: {
        ...listQuery,
        visibleColumns
      },
      threshold: 500
    });
  };

  return (
    <section className="flex flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <Guard can="compliance.write">
          <button
            type="button"
            onClick={() => setModalState({ mode: 'create' })}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            New record
          </button>
        </Guard>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search records…"
            value={query.q}
            onChange={event => setQuery({ q: event.target.value, page: 0 })}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map(status => {
            const active = selectedStatuses.includes(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:focus-visible:outline-slate-400 ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {status}
              </button>
            );
          })}
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-400"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <ViewsMenu
            currentQuery={{
              category,
              q: query.q,
              status: selectedStatuses,
              sort: sortKey,
              order: sortOrder,
              page: pagination.pageIndex,
              pageSize: pagination.pageSize,
              cols: visibleColumns
            }}
            onApply={next => {
              const payload: Partial<QueryState> = {};
              if ('q' in next) payload.q = (next.q as string) ?? '';
              if ('status' in next) payload.status = (next.status as string[]) ?? [];
              if ('sort' in next) {
                const nextSort = typeof next.sort === 'string' ? next.sort : DEFAULT_SORT.sort;
                payload.sort = isComplianceSort(nextSort) ? nextSort : DEFAULT_SORT.sort;
              }
              if ('order' in next) {
                const nextOrder = typeof next.order === 'string' ? next.order : DEFAULT_SORT.order;
                payload.order = nextOrder === 'asc' ? 'asc' : 'desc';
              }
              if ('pageSize' in next) payload.pageSize = Number(next.pageSize) || QueryDefaults.pageSize;
              if ('cols' in next) payload.cols = (next.cols as string[]) ?? QueryDefaults.cols;
              payload.page = ('page' in next ? Number(next.page) : 0) || 0;
              setQuery(payload);
            }}
          />
          <div data-column-menu className="relative">
            <button
              type="button"
              onClick={() => setColumnMenuOpen(prev => !prev)}
              aria-haspopup="menu"
              aria-expanded={columnMenuOpen}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-400"
            >
              <Columns3 className="h-4 w-4" aria-hidden="true" />
              Columns
            </button>
            {columnMenuOpen ? (
              <div
                role="menu"
                tabIndex={-1}
                className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
              >
                <p className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Visible columns</p>
                <ul className="space-y-2">
                  {ALL_COLUMN_IDS.filter(id => id !== 'actions').map(columnId => {
                    const column = table.getColumn(columnId);
                    if (!column) return null;
                    return (
                      <li key={columnId}>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                            checked={column.getIsVisible()}
                            onChange={column.getToggleVisibilityHandler()}
                          />
                          <span className="text-slate-600 dark:text-slate-300 capitalize">
                            {columnId}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative" style={{ contain: 'paint', willChange: 'transform' }}>
        {list.isFetching ? (
          <div className="pointer-events-none absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-100/10 dark:text-slate-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Refreshing…
          </div>
        ) : null}
        <VirtualTable
          table={table}
          height={480}
          isLoading={list.isLoading}
          virtualizationThreshold={500}
          emptyMessage={hasFilters ? 'No records match the current filters.' : 'No records yet.'}
          className="bg-white dark:bg-slate-900"
          tableClassName="min-w-full table-fixed divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800"
          headClassName="bg-slate-50 text-left font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-300"
          bodyClassName="divide-y divide-slate-200 dark:divide-slate-800"
          rowClassName="hover:bg-slate-50 dark:hover:bg-slate-900/60"
          cellClassName="px-4 py-3 text-slate-600 dark:text-slate-200"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <div>
          Showing page {currentPage + 1} of {pageCount} · {total} total records
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Prev
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <Modal
        isOpen={modalState.mode !== null}
        onClose={() => setModalState({ mode: null })}
        title={modalState.mode === 'edit' ? 'Edit compliance item' : 'Create compliance item'}
        description={modalState.mode === 'edit' ? modalState.record?.name : 'Define a new compliance record'}
      >
        <GoalForm
          initialValues={modalState.record ? toGoalFormValues(modalState.record) : undefined}
          onSubmit={values => handleSubmit(values)}
          onCancel={() => setModalState({ mode: null })}
          busy={createMutation.isPending || updateMutation.isPending}
          submitLabel={modalState.mode === 'edit' ? 'Save changes' : 'Create record'}
        />
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete record"
        description={deleteTarget ? `This will remove ${deleteTarget.name}.` : undefined}
        confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </section>
  );
};

const ComplianceCategoryPage: React.FC<{
  category: ComplianceCategory;
  title: string;
  description: string;
}> = props => (
  <QueryErrorBoundary>
    <ComplianceCategoryContent {...props} />
  </QueryErrorBoundary>
);

export default ComplianceCategoryPage;
