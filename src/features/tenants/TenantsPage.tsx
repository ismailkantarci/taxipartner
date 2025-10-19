import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table';
import { useTranslation } from '../../lib/i18n';
import {
  useAssignTenantUser,
  useCreateTenant,
  useTenantsQuery,
  tenantKeys
} from '../../api/tenants';
import type {
  AssignTenantUserInput,
  CreateTenantInput,
  TenantItem,
  TenantListParams
} from '../../api/tenants/types';
import { FormDialog } from '../common';
import { cx } from '../common/utils';
import { useToast } from '../../components/feedback/ToastProvider';
import TenantStatusBadge from './components/TenantStatusBadge';

const STATUS_FILTERS: Array<{ value: string; labelKey: string; fallback: string }> = [
  { value: 'all', labelKey: 'tenants.filters.status.all', fallback: 'All statuses' },
  { value: 'Active', labelKey: 'tenants.filters.status.active', fallback: 'Active' },
  { value: 'Pending', labelKey: 'tenants.filters.status.pending', fallback: 'Pending' },
  { value: 'Ruhend', labelKey: 'tenants.filters.status.ruhend', fallback: 'Dormant' },
  { value: 'Suspended', labelKey: 'tenants.filters.status.suspended', fallback: 'Suspended' },
  { value: 'Deleted', labelKey: 'tenants.filters.status.deleted', fallback: 'Deleted' }
];

const SORT_OPTIONS: Array<{ value: TenantListParams['sort']; labelKey: string; fallback: string }> = [
  { value: 'name', labelKey: 'tenants.filters.sort.name', fallback: 'Name' },
  { value: 'tenantid', labelKey: 'tenants.filters.sort.tenantId', fallback: 'Tenant ID' },
  { value: 'status', labelKey: 'tenants.filters.sort.status', fallback: 'Status' },
  { value: 'created', labelKey: 'tenants.filters.sort.created', fallback: 'Created' }
];

const DEFAULT_PAGE_SIZE = 25;

const mapStatusOptions = (t: ReturnType<typeof useTranslation>['t']) =>
  STATUS_FILTERS.map(option => ({
    value: option.value,
    label: t(option.labelKey, { defaultValue: option.fallback })
  }));

const TenantsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<TenantListParams['sort']>('name');
  const [order, setOrder] = useState<TenantListParams['order']>('asc');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [isCreateTenantDialogOpen, setCreateTenantDialogOpen] = useState(false);
  const [createTenantError, setCreateTenantError] = useState<string | null>(null);
  const [isAssignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [assignUserError, setAssignUserError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const listParams = useMemo<TenantListParams>(
    () => ({
      query: query || undefined,
      status: status === 'all' ? undefined : status,
      sort: sort ?? undefined,
      order: order ?? undefined,
      page,
      pageSize
    }),
    [query, status, sort, order, page, pageSize]
  );

  const listQuery = useTenantsQuery(listParams, {
    placeholderData: keepPreviousData
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? items.length;
  const currentPage = listQuery.data?.page ?? page;
  const effectivePageSize = listQuery.data?.pageSize ?? pageSize;
  const pageCount = effectivePageSize > 0 ? Math.max(1, Math.ceil(total / effectivePageSize)) : 1;

  useEffect(() => {
    if (!items.length) {
      setSelectedTenantId(null);
      return;
    }
    if (!selectedTenantId || !items.some(item => item.tenantId === selectedTenantId)) {
      setSelectedTenantId(items[0]?.tenantId ?? null);
    }
  }, [items, selectedTenantId]);

  const columns = useMemo<ColumnDef<TenantItem>[]>(() => [
    {
      id: 'select',
      header: () => <span className="sr-only">{t('tenants.table.select', { defaultValue: 'Select' })}</span>,
      cell: info => {
        const record = info.row.original;
        const isSelected = record.tenantId === selectedTenantId;
        return (
          <div className="flex justify-center">
            <input
              type="radio"
              name="tenant-selection"
              aria-label={t('tenants.table.selectTenant', {
                defaultValue: 'Select {{tenant}}',
                tenant: record.legalName
              })}
              checked={isSelected}
              onChange={event => {
                event.stopPropagation();
                setSelectedTenantId(record.tenantId);
              }}
              onClick={event => event.stopPropagation()}
              className="h-4 w-4 rounded-full border-slate-300 text-slate-700 focus:ring-slate-500 dark:border-slate-700 dark:text-slate-200"
            />
          </div>
        );
      },
      enableSorting: false,
      size: 48
    },
    {
      header: t('tenants.table.tenant', { defaultValue: 'Tenant' }),
      accessorKey: 'legalName',
      cell: info => {
        const record = info.row.original;
        return (
          <div className="flex flex-col">
            <span className="font-medium text-slate-900 dark:text-slate-100">{record.legalName}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{record.tenantId}</span>
          </div>
        );
      },
      size: 260
    },
    {
      header: t('tenants.table.status', { defaultValue: 'Status' }),
      accessorKey: 'status',
      cell: info => <TenantStatusBadge status={info.getValue<string | null | undefined>()} />,
      size: 160
    },
    {
      header: t('tenants.table.identifier', { defaultValue: 'Primary identifier' }),
      accessorFn: row => row.primaryIdentifier?.idValue ?? null,
      id: 'primaryIdentifier',
      cell: info => {
        const record = info.row.original;
        if (!record.primaryIdentifier) {
          return <span className="text-xs text-slate-400">—</span>;
        }
        return (
          <div className="flex flex-col text-sm">
            <span className="font-mono text-slate-700 dark:text-slate-200">
              {record.primaryIdentifier.idValue}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {record.primaryIdentifier.idType}
            </span>
          </div>
        );
      },
      size: 220
    },
    {
      header: t('tenants.table.address', { defaultValue: 'Seat address' }),
      accessorFn: row => row.seatAddress ?? row.currentIdentity?.seatAddress ?? null,
      id: 'seatAddress',
      cell: info => {
        const value = info.getValue<string | null>();
        return value ? (
          <span className="text-sm text-slate-700 dark:text-slate-200">{value}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        );
      }
    }
  ], [selectedTenantId, t]);

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount
  });

  const statusOptions = useMemo(() => mapStatusOptions(t), [t]);

  const sortOptions = useMemo(
    () =>
      SORT_OPTIONS.map(option => ({
        value: option.value ?? '',
        label: t(option.labelKey, { defaultValue: option.fallback })
      })),
    [t]
  );

  const errorBanner =
    listQuery.isError || (listQuery.data && listQuery.data.ok === false && listQuery.data.error)
      ? listQuery.error instanceof Error
        ? listQuery.error.message
        : listQuery.data?.error ?? t('tenants.errors.generic', { defaultValue: 'Failed to load tenants.' })
      : null;

  const canPrev = currentPage > 0;
  const canNext = (currentPage + 1) * effectivePageSize < total;

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: tenantKeys.all });
  };

  const createTenantMutation = useCreateTenant({
    onSuccess: async response => {
      setCreateTenantDialogOpen(false);
      setCreateTenantError(null);
      const newlyCreatedId = response.tenant?.tenantId;
      if (newlyCreatedId) {
        setSelectedTenantId(newlyCreatedId);
        navigate(`/tenants/${newlyCreatedId}`, {
          state: response.tenant ? { tenant: response.tenant } : undefined
        });
      }
      await queryClient.invalidateQueries({ queryKey: tenantKeys.all });
      showToast({
        title: t('tenants.toasts.tenantCreated', { defaultValue: 'Tenant created' }),
        description: response.tenant?.legalName ?? response.tenant?.tenantId ?? '',
        tone: 'success'
      });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.create.error', { defaultValue: 'Failed to create tenant.' });
      setCreateTenantError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const assignUserMutation = useAssignTenantUser(selectedTenantId ?? '', {
    onSuccess: async () => {
      setAssignUserDialogOpen(false);
      setAssignUserError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.all });
      showToast({
        title: t('tenants.toasts.assignmentCreated', { defaultValue: 'User assigned' }),
        description: t('tenants.toasts.assignmentCreated.detail', { defaultValue: 'Assignment saved.' }),
        tone: 'success'
      });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.assign.error', { defaultValue: 'Failed to assign user.' });
      setAssignUserError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const handleCreateTenantSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const legalName = (formData.get('legalName') as string | null)?.trim() ?? '';
    if (!legalName) {
      setCreateTenantError(
        t('tenants.detail.create.validation', { defaultValue: 'Legal name is required.' })
      );
      return;
    }
    setCreateTenantError(null);
    const payload: CreateTenantInput = {
      tenantId: (formData.get('tenantId') as string | null)?.trim() || undefined,
      legalName,
      legalForm: (formData.get('legalForm') as string | null)?.trim() || undefined,
      seatAddress: (formData.get('seatAddress') as string | null)?.trim() || undefined
    };
    try {
      await createTenantMutation.mutateAsync(payload);
      form.reset();
    } catch {
      // handled via onError
    }
  };

  const handleAssignUserSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId) {
      setAssignUserError(
        t('tenants.detail.assign.validationTenant', {
          defaultValue: 'Select a tenant before assigning.'
        })
      );
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    const userId = (formData.get('userId') as string | null)?.trim() ?? '';
    if (!userId) {
      setAssignUserError(
        t('tenants.detail.assign.validationUser', {
          defaultValue: 'User ID is required.'
        })
      );
      return;
    }
    setAssignUserError(null);
    const payload: AssignTenantUserInput = {
      userId,
      role: (formData.get('role') as string | null)?.trim() || undefined
    };
    try {
      await assignUserMutation.mutateAsync(payload);
      form.reset();
    } catch {
      // handled via onError
    }
  };

  const statusLabel = statusOptions.find(option => option.value === status)?.label ?? status;
  const sortLabel = sortOptions.find(option => option.value === (sort ?? ''))?.label ?? sort;

  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t('tenants.page.title', { defaultValue: 'Tenants' })}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('tenants.page.subtitle', {
            defaultValue: 'Search and inspect tenant records from the identity service.'
          })}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setCreateTenantError(null);
            setCreateTenantDialogOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {t('tenants.actions.newTenant', { defaultValue: 'New tenant' })}
        </button>
        <button
          type="button"
          onClick={() => {
            setAssignUserError(null);
            setAssignUserDialogOpen(true);
          }}
          disabled={!selectedTenantId}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('tenants.actions.assignUser', { defaultValue: 'Assign user' })}
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label={
            listQuery.isFetching
              ? t('tenants.actions.refreshing', { defaultValue: 'Refreshing…' })
              : t('tenants.actions.refresh', { defaultValue: 'Refresh' })
          }
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        </button>
        {listQuery.isFetching ? (
          <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t('tenants.actions.refreshing', { defaultValue: 'Refreshing…' })}
          </span>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              placeholder={t('tenants.filters.search', { defaultValue: 'Search by name or ID…' })}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 transition focus:border-slate-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('tenants.filters.status.label', { defaultValue: 'Status' })}
            <select
              value={status}
              onChange={event => {
                setStatus(event.target.value);
                setPage(0);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('tenants.filters.sort.label', { defaultValue: 'Sort by' })}
            <select
              value={sort ?? ''}
              onChange={event => {
                setSort(event.target.value as TenantListParams['sort']);
                setPage(0);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('tenants.filters.order.label', { defaultValue: 'Order' })}
            <button
              type="button"
              onClick={() => {
                setOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                setPage(0);
              }}
              className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:border-slate-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <span>{order === 'asc'
                ? t('tenants.filters.order.asc', { defaultValue: 'Ascending' })
                : t('tenants.filters.order.desc', { defaultValue: 'Descending' })}
              </span>
              <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {t('tenants.filters.summary', {
            defaultValue: 'Showing {{status}} tenants sorted by {{sort}}.',
            values: {
              status: statusLabel,
              sort: sortLabel
            }
          })}
        </div>
      </div>

      {errorBanner ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
          {errorBanner}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="bg-slate-50 text-left font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} scope="col" className="px-4 py-3">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {table.getRowModel().rows.map(row => {
              const record = row.original;
              const isSelected = record.tenantId === selectedTenantId;
              return (
                <tr
                  key={row.id}
                  onClick={() => {
                    setSelectedTenantId(record.tenantId);
                    navigate(`/tenants/${record.tenantId}`, { state: { tenant: record } });
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedTenantId(record.tenantId);
                      navigate(`/tenants/${record.tenantId}`, { state: { tenant: record } });
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className={cx(
                    'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500',
                    isSelected
                      ? 'bg-slate-900/5 dark:bg-slate-100/10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                  )}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3 align-top text-sm text-slate-700 dark:text-slate-200">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-sm text-slate-500 dark:text-slate-300">
                  {query || status !== 'all'
                    ? t('tenants.table.emptyFiltered', {
                        defaultValue: 'No tenants match the current filters.'
                      })
                    : t('tenants.table.empty', { defaultValue: 'No tenants found.' })}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <div>
          {t('tenants.pagination.summary', {
            defaultValue: 'Page {{page}} of {{pages}} · {{total}} tenants',
            values: {
              page: currentPage + 1,
              pages: pageCount,
              total
            }
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!canPrev) return;
              const nextPage = Math.max(0, currentPage - 1);
              setPage(nextPage);
            }}
            disabled={!canPrev}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {t('tenants.pagination.prev', { defaultValue: 'Previous' })}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!canNext) return;
              const nextPage = currentPage + 1;
              setPage(nextPage);
            }}
            disabled={!canNext}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t('tenants.pagination.next', { defaultValue: 'Next' })}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <FormDialog
        isOpen={isCreateTenantDialogOpen}
        onClose={() => {
          setCreateTenantDialogOpen(false);
          setCreateTenantError(null);
        }}
        title={t('tenants.detail.create.dialog.title', { defaultValue: 'Create tenant' })}
        description={t('tenants.detail.create.dialog.description', {
          defaultValue: 'Enter tenant details to create a new record.'
        })}
        submitLabel={
          createTenantMutation.isPending
            ? t('tenants.detail.create.dialog.saving', { defaultValue: 'Saving…' })
            : t('tenants.detail.create.dialog.submit', { defaultValue: 'Save tenant' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        isSubmitting={createTenantMutation.isPending}
        onSubmit={handleCreateTenantSubmit}
      >
        {createTenantError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {createTenantError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.create.dialog.tenantId', { defaultValue: 'Tenant ID (optional)' })}
            </span>
            <input
              name="tenantId"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.create.dialog.legalName', { defaultValue: 'Legal name' })}
            </span>
            <input
              name="legalName"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.create.dialog.legalForm', { defaultValue: 'Legal form' })}
            </span>
            <input
              name="legalForm"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="sm:col-span-2 flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.create.dialog.seatAddress', { defaultValue: 'Seat address' })}
            </span>
            <textarea
              name="seatAddress"
              rows={3}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </FormDialog>

      <FormDialog
        isOpen={isAssignUserDialogOpen}
        onClose={() => {
          setAssignUserDialogOpen(false);
          setAssignUserError(null);
        }}
        title={t('tenants.detail.assign.dialog.title', { defaultValue: 'Assign user' })}
        description={t('tenants.detail.assign.dialog.description', {
          defaultValue: 'Link an existing user to the selected tenant.'
        })}
        submitLabel={
          assignUserMutation.isPending
            ? t('tenants.detail.assign.dialog.saving', { defaultValue: 'Saving…' })
            : t('tenants.detail.assign.dialog.submit', { defaultValue: 'Assign user' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        disableSubmit={!selectedTenantId}
        isSubmitting={assignUserMutation.isPending}
        onSubmit={handleAssignUserSubmit}
      >
        {assignUserError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {assignUserError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.assign.dialog.tenantId', { defaultValue: 'Tenant ID' })}
            </span>
            <input
              name="tenantId"
              value={selectedTenantId ?? ''}
              readOnly
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.assign.dialog.userId', { defaultValue: 'User ID' })}
            </span>
            <input
              name="userId"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.assign.dialog.role', { defaultValue: 'Role (optional)' })}
            </span>
            <input
              name="role"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </FormDialog>
    </section>
  );
};

export default TenantsPage;
