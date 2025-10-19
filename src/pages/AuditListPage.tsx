import React, { useEffect, useMemo, useState } from 'react';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { ColumnDef, SortingState, VisibilityState } from '@tanstack/react-table';
import { ArrowRight, Download, Filter, RefreshCw, Search } from 'lucide-react';
import QueryErrorBoundary from '../components/errors/QueryErrorBoundary';
import VirtualTable from '../components/table/VirtualTable';
import ViewsMenu from '../components/views/ViewsMenu';
import { useAuditList, useAuditEvent } from '../features/audit/api';
import type { AuditEvent, AuditListQuery } from '../lib/repo/audit';
import useQuerySync from '../hooks/useQuerySync';
import AuditDetailModal from '../components/AuditDetailModal';
import { startCsvExport } from '../lib/export/exportCsv';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeAuditStream } from '../lib/ws/mockSocket';
import { useTranslation, useLocale } from '../lib/i18n';
import { useToast } from '../components/feedback/ToastProvider';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const ACTION_OPTIONS = [
  'program.goal.created',
  'program.goal.updated',
  'risk.record.updated',
  'jobs.csv.completed',
  'auth.session.login',
  'rbac.permission.denied'
];

const USERS = [
  { id: 'user-demo', name: 'Admin Demo' },
  { id: 'user-lisa', name: 'Lisa Graf' },
  { id: 'user-marco', name: 'Marco Huber' },
  { id: 'user-eva', name: 'Eva Leitner' }
];

type QueryState = {
  q: string;
  user: string;
  action: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  sort: NonNullable<AuditListQuery['sort']>;
  order: NonNullable<AuditListQuery['order']>;
};

const QueryDefaults: QueryState = {
  q: '',
  user: '',
  action: '',
  from: '',
  to: '',
  page: 0,
  pageSize: 25,
  sort: 'ts',
  order: 'desc'
};

const isAuditSort = (value: string): value is QueryState['sort'] =>
  value === 'ts' || value === 'action' || value === 'actor';

const AuditListContent: React.FC = () => {
  const client = useQueryClient();
  const { t } = useTranslation();
  const locale = useLocale();
  const { showToast } = useToast();
  const locationRouter = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ auditId?: string }>();
  const [query, setQuery] = useQuerySync<QueryState>({
    defaults: QueryDefaults,
    schema: {
      q: 'string',
      user: 'string',
      action: 'string',
      from: 'string',
      to: 'string',
      page: 'number',
      pageSize: 'number',
      sort: 'string',
      order: 'string'
    }
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'ts', desc: true }
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(params.auditId ?? null);
  }, [params.auditId]);

  useEffect(() => {
    const unsubscribe = subscribeAuditStream(() => {
      void client.invalidateQueries({ queryKey: ['audit'] });
    });
    return () => unsubscribe();
  }, [client]);

  const listQuery: AuditListQuery = useMemo(() => {
    const { q, user, action, from, to, page, pageSize, sort, order } = query;
    return {
      q,
      user: user || undefined,
      action: action || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize,
      sort,
      order
    };
  }, [query]);

  const list = useAuditList(listQuery);
  const detail = useAuditEvent(selectedId);

  const columns = useMemo<ColumnDef<AuditEvent>[]>(
    () => [
      {
        accessorKey: 'ts',
        header: () => t('audit.table.timestamp', { defaultValue: 'Time' }),
        cell: info =>
          new Intl.DateTimeFormat(locale.locale, {
            dateStyle: 'short',
            timeStyle: 'medium'
          }).format(new Date(info.getValue<string>())),
        enableSorting: true
      },
      {
        accessorKey: 'summary',
        header: () => t('audit.table.summary', { defaultValue: 'Summary' }),
        cell: info => (
          <button
            type="button"
            onClick={() => navigate(`/audit/${info.row.original.id}${locationRouter.search}`)}
            className="text-left text-slate-900 underline-offset-2 hover:underline dark:text-slate-100"
          >
            {info.getValue<string>()}
          </button>
        )
      },
      {
        accessorKey: 'action',
        header: () => t('audit.table.action', { defaultValue: 'Action' }),
        cell: info => <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{info.getValue<string>()}</span>,
        enableSorting: true
      },
      {
        accessorKey: 'actor',
        header: () => t('audit.table.actor', { defaultValue: 'Actor' }),
        cell: info => info.row.original.actor.name
      },
      {
        accessorKey: 'target',
        header: () => t('audit.table.target', { defaultValue: 'Target' }),
        cell: info => info.row.original.target.name ?? info.row.original.target.id
      },
      {
        accessorKey: 'source',
        header: () => t('audit.table.source', { defaultValue: 'Source' }),
        cell: info => info.getValue<string>() ?? 'ui'
      }
    ],
    [locale.locale, t]
  );

  const table = useReactTable({
    data: list.data?.items ?? [],
    columns,
    state: {
      sorting,
      columnVisibility,
      pagination: {
        pageIndex: query.page,
        pageSize: query.pageSize
      }
    },
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    pageCount: Math.max(1, Math.ceil((list.data?.total ?? 0) / Math.max(1, query.pageSize))),
    onSortingChange: updater => {
      setSorting(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next.length === 0) {
          setQuery({ sort: 'ts', order: 'desc', page: 0 });
          return next;
        }
        const [first] = next;
        const sortId = isAuditSort(first.id) ? first.id : 'ts';
        setQuery({ sort: sortId, order: first.desc ? 'desc' : 'asc', page: 0 });
        return next;
      });
    },
    onPaginationChange: updater => {
      const next = typeof updater === 'function' ? updater({ pageIndex: query.page, pageSize: query.pageSize }) : updater;
      if (next.pageSize !== query.pageSize) {
        setQuery({ pageSize: next.pageSize, page: 0 });
      } else if (next.pageIndex !== query.page) {
        setQuery({ page: next.pageIndex });
      }
    },
    onColumnVisibilityChange: updater => {
      setColumnVisibility(updater);
    }
  });

  const handleExport = () => {
    const currentRows = table.getRowModel().rows.map(row => row.original as AuditEvent);
    if (!currentRows.length) {
      showToast({ title: t('audit.export.empty', { defaultValue: 'Nothing to export' }), tone: 'info' });
      return;
    }

    const visibleColumns = table
      .getAllLeafColumns()
      .filter(column => column.getIsVisible())
      .map(column => column.id);

    const columnMap = {
      ts: {
        id: 'ts',
        header: t('audit.table.timestamp', { defaultValue: 'Time' }),
        accessor: (row: AuditEvent) => row.ts
      },
      summary: {
        id: 'summary',
        header: t('audit.table.summary', { defaultValue: 'Summary' }),
        accessor: (row: AuditEvent) => row.summary
      },
      actor: {
        id: 'actor',
        header: t('audit.table.actor', { defaultValue: 'Actor' }),
        accessor: (row: AuditEvent) => row.actor.name
      },
      action: {
        id: 'action',
        header: t('audit.table.action', { defaultValue: 'Action' }),
        accessor: (row: AuditEvent) => row.action
      },
      target: {
        id: 'target',
        header: t('audit.table.target', { defaultValue: 'Target' }),
        accessor: (row: AuditEvent) => row.target.name ?? row.target.id
      },
      source: {
        id: 'source',
        header: t('audit.table.source', { defaultValue: 'Source' }),
        accessor: (row: AuditEvent) => row.source ?? 'ui'
      }
    } satisfies Record<string, { id: string; header: string; accessor: (row: AuditEvent) => unknown }>;

    const exportColumns = visibleColumns
      .map(columnId => columnMap[columnId as keyof typeof columnMap])
      .filter((column): column is (typeof columnMap)[keyof typeof columnMap] => Boolean(column));

    if (!exportColumns.length) {
      showToast({ title: t('audit.export.empty', { defaultValue: 'Nothing to export' }), tone: 'info' });
      return;
    }

    startCsvExport<AuditEvent>({
      module: 'audit-events',
      filename: 'audit-events.csv',
      rows: currentRows,
      totalCount: list.data?.total ?? currentRows.length,
      query: { ...listQuery, visibleColumns },
      columns: exportColumns
    });
  };

  return (
    <section className="flex flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('audit.title', { defaultValue: 'Audit center' })}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('audit.description', { defaultValue: 'Monitor key events, access changes and exportable logs in real-time.' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {t('audit.actions.export', { defaultValue: 'Export CSV' })}
          </button>
          <ViewsMenu currentQuery={query} onApply={params => setQuery({ ...params })} />
        </div>
      </header>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query.q}
              onChange={event => setQuery({ q: event.target.value, page: 0 })}
              placeholder={t('audit.filters.search', { defaultValue: 'Search events…' })}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
            />
          </div>
          <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            <label htmlFor="audit-user">{t('audit.filters.user', { defaultValue: 'Actor' })}</label>
            <select
              id="audit-user"
              value={query.user}
              onChange={event => setQuery({ user: event.target.value, page: 0 })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
            >
              <option value="">{t('audit.filters.user.all', { defaultValue: 'All actors' })}</option>
              {USERS.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            <label htmlFor="audit-action">{t('audit.filters.action', { defaultValue: 'Action' })}</label>
            <select
              id="audit-action"
              value={query.action}
              onChange={event => setQuery({ action: event.target.value, page: 0 })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
            >
              <option value="">{t('audit.filters.action.all', { defaultValue: 'All actions' })}</option>
              {ACTION_OPTIONS.map(action => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            <label htmlFor="audit-from">{t('audit.filters.from', { defaultValue: 'From' })}</label>
            <input
              id="audit-from"
              type="date"
              value={query.from}
              onChange={event => setQuery({ from: event.target.value, page: 0 })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
            />
          </div>
          <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            <label htmlFor="audit-to">{t('audit.filters.to', { defaultValue: 'To' })}</label>
            <input
              id="audit-to"
              type="date"
              value={query.to}
              onChange={event => setQuery({ to: event.target.value, page: 0 })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setQuery({ q: '', user: '', action: '', from: '', to: '', page: 0 })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Filter className="h-4 w-4" />
            {t('audit.filters.reset', { defaultValue: 'Reset filters' })}
          </button>
        </div>
      </div>

      <div className="relative" style={{ contain: 'paint', willChange: 'transform' }}>
        {list.isFetching ? (
          <div className="pointer-events-none absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-100/10 dark:text-slate-300">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t('audit.refreshing', { defaultValue: 'Refreshing…' })}
          </div>
        ) : null}
        <VirtualTable
          table={table}
          height={520}
          virtualizationThreshold={400}
          isLoading={list.isLoading}
          emptyMessage={t('audit.empty', { defaultValue: 'No audit events match your filters.' })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <div>
          {t('audit.pagination.summary', {
            defaultValue: 'Showing page {{page}} of {{pages}} · {{total}} events',
            values: {
              page: query.page + 1,
              pages: Math.max(1, Math.ceil((list.data?.total ?? 0) / Math.max(1, query.pageSize))),
              total: list.data?.total ?? 0
            }
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />
            {t('audit.pagination.prev', { defaultValue: 'Prev' })}
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t('audit.pagination.next', { defaultValue: 'Next' })}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <AuditDetailModal
        event={detail.data ?? null}
        isOpen={Boolean(selectedId)}
        onClose={() => navigate({ pathname: '/audit', search: locationRouter.search }, { replace: true })}
      />
    </section>
  );
};

const AuditListPage: React.FC = () => (
  <QueryErrorBoundary>
    <AuditListContent />
  </QueryErrorBoundary>
);

export default AuditListPage;
