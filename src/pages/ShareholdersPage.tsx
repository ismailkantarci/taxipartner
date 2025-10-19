import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable
} from '@tanstack/react-table';
import RequirePermission from '../components/rbac/RequirePermission';
import { CrudLayout, DataGrid, InlineFilterBar } from '../features/common';
import { tenantKeys, useTenantsQuery, useTenantShareholdings } from '../api/tenants';
import type { ShareholdingItem, TenantItem, TenantListParams } from '../api/tenants/types';
import { useTranslation } from '../lib/i18n';
import { summarizeShareholdings, formatQuotaPercentage } from '../features/tenants/shareholdingsSummary';

const STATUS_FILTERS: Array<{ value: string; labelKey: string; fallback: string }> = [
  { value: 'all', labelKey: 'tenants.filters.status.all', fallback: 'All statuses' },
  { value: 'Active', labelKey: 'tenants.filters.status.active', fallback: 'Active' },
  { value: 'Pending', labelKey: 'tenants.filters.status.pending', fallback: 'Pending' },
  { value: 'Ruhend', labelKey: 'tenants.filters.status.ruhend', fallback: 'Dormant' },
  { value: 'Suspended', labelKey: 'tenants.filters.status.suspended', fallback: 'Suspended' },
  { value: 'Deleted', labelKey: 'tenants.filters.status.deleted', fallback: 'Deleted' }
];

const defaultTenantParams: Pick<TenantListParams, 'sort' | 'order' | 'pageSize'> = {
  sort: 'name',
  order: 'asc',
  pageSize: 25
};

const mapStatusOptions = (t: ReturnType<typeof useTranslation>['t']) =>
  STATUS_FILTERS.map(option => ({
    value: option.value,
    label: t(option.labelKey, { defaultValue: option.fallback })
  }));

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

const TenantStatusBadge: React.FC<{ status?: string | null; className?: string }> = ({
  status,
  className
}) => {
  const { t } = useTranslation();
  if (!status) {
    return (
      <span className={`inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300 ${className ?? ''}`}>
        {t('tenants.status.unknown', { defaultValue: 'Unknown' })}
      </span>
    );
  }
  const normalized = status.toLowerCase();
  const palette: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    suspended: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
    ruhend: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
    deleted: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
  };
  const paletteClass =
    palette[normalized] ??
    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${paletteClass} ${className ?? ''}`}
    >
      {status}
    </span>
  );
};

type ShareholderTableRow = ShareholdingItem;

const ShareholdersContent: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const tenantParams = useMemo<TenantListParams>(
    () => ({
      query: search.trim() ? search.trim() : undefined,
      status: status !== 'all' ? status : undefined,
      page,
      ...defaultTenantParams
    }),
    [search, status, page]
  );

  const tenantsQuery = useTenantsQuery(tenantParams, {
    placeholderData: keepPreviousData
  });

  const tenantItems: TenantItem[] = tenantsQuery.data?.items ?? [];
  const totalTenants = tenantsQuery.data?.total ?? tenantItems.length;
  const currentPage = tenantsQuery.data?.page ?? page;
  const effectivePageSize = tenantsQuery.data?.pageSize ?? defaultTenantParams.pageSize ?? 25;
  const pageCount =
    effectivePageSize > 0 ? Math.max(1, Math.ceil(totalTenants / effectivePageSize)) : 1;

  useEffect(() => {
    if (!tenantItems.length) {
      setSelectedTenantId(null);
      return;
    }
    setSelectedTenantId(prev =>
      prev && tenantItems.some(item => item.tenantId === prev)
        ? prev
        : tenantItems[0]?.tenantId ?? null
    );
  }, [tenantItems]);

  const selectedTenant =
    tenantItems.find(item => item.tenantId === selectedTenantId) ?? null;

  const shareholdingsQuery = useTenantShareholdings(selectedTenantId, {
    enabled: Boolean(selectedTenantId),
    placeholderData: keepPreviousData
  });

  const shareholdingItems: ShareholdingItem[] = shareholdingsQuery.data?.items ?? [];

  const shareholdingColumns = useMemo<ColumnDef<ShareholderTableRow>[]>(
    () => [
      {
        header: t('tenants.shareholders.table.party', { defaultValue: 'Party' }),
        accessorKey: 'party',
        cell: info => {
          const record = info.row.original;
          const displayName =
            record.party?.displayName ??
            record.partyId ??
            t('tenants.detail.shareholdings.unknownParty', { defaultValue: 'Unknown party' });
          return (
            <div className="flex flex-col">
              <span className="font-medium text-slate-900 dark:text-slate-100">{displayName}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{record.party?.type}</span>
            </div>
          );
        }
      },
      {
        header: t('tenants.shareholders.table.role', { defaultValue: 'Role' }),
        accessorKey: 'roleType',
        cell: info => (
          <span className="text-sm text-slate-600 dark:text-slate-200">{info.getValue<string>()}</span>
        )
      },
      {
        header: t('tenants.shareholders.table.quota', { defaultValue: 'Quota %' }),
        accessorKey: 'quotaPercent',
        cell: info => {
          const value = info.getValue<string | null | undefined>();
          if (!value) {
            return <span className="text-xs text-slate-400">—</span>;
          }
          const numeric = Number.parseFloat(value);
          if (Number.isNaN(numeric)) {
            return <span className="text-sm text-slate-600 dark:text-slate-200">{value}</span>;
          }
          return (
            <span className="text-sm font-medium text-slate-700 dark:text-slate-100">
              {formatQuotaPercentage(numeric)}
            </span>
          );
        }
      },
      {
        header: t('tenants.shareholders.table.liability', { defaultValue: 'Liability' }),
        accessorKey: 'liability',
        cell: info => (
          <span className="text-sm text-slate-600 dark:text-slate-200">
            {info.getValue<string | null | undefined>() ?? '—'}
          </span>
        )
      },
      {
        header: t('tenants.shareholders.table.validFrom', { defaultValue: 'Valid from' }),
        accessorKey: 'validFrom',
        cell: info => (
          <span className="text-sm text-slate-500 dark:text-slate-300">
            {formatDate(info.getValue<string | null | undefined>())}
          </span>
        )
      },
      {
        header: t('tenants.shareholders.table.validTo', { defaultValue: 'Valid to' }),
        accessorKey: 'validTo',
        cell: info => (
          <span className="text-sm text-slate-500 dark:text-slate-300">
            {formatDate(info.getValue<string | null | undefined>())}
          </span>
        )
      }
    ],
    [t]
  );

  const table = useReactTable<ShareholderTableRow>({
    data: shareholdingItems,
    columns: shareholdingColumns,
    getCoreRowModel: getCoreRowModel()
  });

  const summary = useMemo(
    () => summarizeShareholdings(shareholdingItems),
    [shareholdingItems]
  );

  const errorBanner =
    tenantsQuery.isError ||
    (tenantsQuery.data && tenantsQuery.data.ok === false && tenantsQuery.data.error)
      ? tenantsQuery.error instanceof Error
        ? tenantsQuery.error.message
        : tenantsQuery.data?.error ??
          t('tenants.errors.generic', { defaultValue: 'Failed to load tenants.' })
      : null;

  const shareholdingError =
    shareholdingsQuery.isError && shareholdingsQuery.error
      ? shareholdingsQuery.error instanceof Error
        ? shareholdingsQuery.error.message
        : t('tenants.shareholders.error', { defaultValue: 'Unable to load shareholdings.' })
      : null;

  const statusOptions = useMemo(() => mapStatusOptions(t), [t]);

  const canPrev = currentPage > 0;
  const canNext = (currentPage + 1) * effectivePageSize < totalTenants;

  const handleRefresh = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tenants'] }),
      selectedTenantId
        ? queryClient.invalidateQueries({
            queryKey: tenantKeys.shareholdings(selectedTenantId)
          })
        : Promise.resolve()
    ]);
  };

  return (
    <section className="flex flex-1 flex-col">
      <CrudLayout
        title={t('tenants.shareholders.title', { defaultValue: 'Shareholders' })}
        subtitle={t('tenants.shareholders.subtitle', {
          defaultValue:
            'Review the parties, ownership and control relationships linked to each tenant.'
        })}
        description={t('tenants.shareholders.description', {
          defaultValue:
            'Select a tenant to inspect ownership records, quota coverage and liability information.'
        })}
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCcw className="h-4 w-4" />
            {shareholdingsQuery.isFetching || tenantsQuery.isFetching
              ? t('tenants.actions.refreshing', { defaultValue: 'Refreshing…' })
              : t('tenants.actions.refresh', { defaultValue: 'Refresh' })}
          </button>
        }
        filterBar={
          <InlineFilterBar
            filters={
              <>
                <div className="relative flex-1 min-w-[200px]">
                  <input
                    type="search"
                    value={search}
                    onChange={event => {
                      setSearch(event.target.value);
                      setPage(0);
                    }}
                    placeholder={t('tenants.shareholders.search', {
                      defaultValue: 'Search tenants…'
                    })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
                  />
                  {tenantsQuery.isLoading ? (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                  ) : null}
                </div>
                <select
                  value={status}
                  onChange={event => {
                    setStatus(event.target.value);
                    setPage(0);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedTenantId ?? ''}
                  onChange={event => setSelectedTenantId(event.target.value || null)}
                  className="min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
                  disabled={!tenantItems.length}
                >
                  {tenantItems.length === 0 ? (
                    <option value="">
                      {t('tenants.shareholders.selectTenant', { defaultValue: 'No tenants found' })}
                    </option>
                  ) : null}
                  {tenantItems.map(item => (
                    <option key={item.tenantId} value={item.tenantId}>
                      {item.legalName}
                    </option>
                  ))}
                </select>
              </>
            }
            actions={
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {t('tenants.shareholders.pagination', {
                    defaultValue: 'Page {{current}} of {{total}}',
                    values: {
                      current: currentPage + 1,
                      total: pageCount
                    }
                  })}
                </span>
                <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPage(prev => Math.max(0, prev - 1))}
                    disabled={!canPrev}
                    className="px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(prev => (canNext ? prev + 1 : prev))}
                    disabled={!canNext}
                    className="px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    ›
                  </button>
                </div>
              </div>
            }
          />
        }
        detail={
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {selectedTenant ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    {selectedTenant.legalName}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <TenantStatusBadge status={selectedTenant.status} />
                    {selectedTenant.legalForm ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {selectedTenant.legalForm}
                      </span>
                    ) : null}
                  </div>
                </div>
                <dl className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('tenants.detail.assign.dialog.tenantId', { defaultValue: 'Tenant ID' })}
                    </dt>
                    <dd className="font-mono text-slate-800 dark:text-slate-100">
                      {selectedTenant.tenantId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('tenants.detail.create.dialog.seatAddress', {
                        defaultValue: 'Registered address'
                      })}
                    </dt>
                    <dd>
                      {selectedTenant.seatAddress ??
                        selectedTenant.currentIdentity?.seatAddress ??
                        '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('tenants.detail.section.identifiers', { defaultValue: 'Identifiers' })}
                    </dt>
                    <dd className="flex flex-col gap-1">
                      {selectedTenant.primaryIdentifier ? (
                        <>
                          <span className="font-mono text-slate-800 dark:text-slate-100">
                            {selectedTenant.primaryIdentifier.idValue}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {selectedTenant.primaryIdentifier.idType}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {t('tenants.detail.identifiers.empty', { defaultValue: 'No identifiers registered yet.' })}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">
                  {t('tenants.shareholders.detail.placeholder.title', {
                    defaultValue: 'Select a tenant'
                  })}
                </h2>
                <p>
                  {t('tenants.shareholders.detail.placeholder.subtitle', {
                    defaultValue: 'Use the selector above to load shareholding records.'
                  })}
                </p>
              </div>
            )}
          </div>
        }
      >
        {errorBanner ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {errorBanner}
          </div>
        ) : null}

        {selectedTenantId ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {t('tenants.shareholders.metrics.total', { defaultValue: 'Total shareholdings' })}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
                  {summary.total}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('tenants.shareholders.metrics.active', {
                    defaultValue: '{{count}} active today',
                    values: {
                      count: summary.active
                    }
                  })}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {t('tenants.shareholders.metrics.parties', { defaultValue: 'Unique parties' })}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
                  {summary.uniqueParties}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('tenants.shareholders.metrics.partiesHint', {
                    defaultValue: 'Deduplicated by party identifier.'
                  })}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {t('tenants.shareholders.metrics.quota', { defaultValue: 'Recorded quota' })}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
                  {formatQuotaPercentage(summary.totalQuota)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('tenants.shareholders.metrics.quotaHint', {
                    defaultValue: 'Sum of available quota entries.'
                  })}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {t('tenants.shareholders.metrics.missingQuota', {
                    defaultValue: 'Missing quota'
                  })}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
                  {summary.withoutQuota}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('tenants.shareholders.metrics.missingQuotaHint', {
                    defaultValue: 'Shareholdings without recorded quota.'
                  })}
                </p>
              </div>
            </div>

            {shareholdingError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {shareholdingError}
              </div>
            ) : (
              <DataGrid
                table={table}
                isLoading={shareholdingsQuery.isLoading}
                virtualizationThreshold={120}
                emptyMessage={t('tenants.shareholders.empty', {
                  defaultValue: 'No shareholdings registered for this tenant yet.'
                })}
              />
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
            {t('tenants.shareholders.placeholder', {
              defaultValue: 'A dedicated registry for parties and shareholdings will land here soon.'
            })}
          </div>
        )}
      </CrudLayout>
    </section>
  );
};

const ShareholdersPage: React.FC = () => (
  <RequirePermission permission="tenants.manage">
    <ShareholdersContent />
  </RequirePermission>
);

export default ShareholdersPage;
