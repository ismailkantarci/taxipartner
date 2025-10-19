import { AppState } from '../core.state/app.state.module.js';
import {
  createTable,
  getCoreRowModel,
  getSortedRowModel
} from '@tanstack/table-core';

const TABLE_PREF_KEY = 'companies.table';

const COMPANY_DATA = [
  {
    id: 'CMP-1001',
    name: 'TAXIPartner GmbH',
    tenantId: 'tenant-taxipartner',
    tenantName: 'TAXIPartner GmbH',
    status: 'active',
    vehicles: 142,
    permit: 'Konzession Typ A',
    lastAudit: '2024-08-19',
    region: 'Wien'
  },
  {
    id: 'CMP-1002',
    name: 'Reftiss KG',
    tenantId: 'tenant-reftiss',
    tenantName: 'Reftiss KG',
    status: 'pending',
    vehicles: 36,
    permit: 'Konzession Typ B',
    lastAudit: '2024-06-04',
    region: 'Linz'
  },
  {
    id: 'CMP-1003',
    name: 'RufTaxi OG',
    tenantId: 'tenant-ruf',
    tenantName: 'RufTaxi OG',
    status: 'active',
    vehicles: 58,
    permit: 'Konzession Typ A',
    lastAudit: '2024-07-12',
    region: 'Graz'
  },
  {
    id: 'CMP-1004',
    name: 'CityRide GmbH',
    tenantId: 'tenant-cityride',
    tenantName: 'CityRide GmbH',
    status: 'suspended',
    vehicles: 21,
    permit: 'Konzession Typ C',
    lastAudit: '2024-02-28',
    region: 'Salzburg'
  },
  {
    id: 'CMP-1005',
    name: 'MetroCab AG',
    tenantId: 'tenant-metro',
    tenantName: 'MetroCab AG',
    status: 'active',
    vehicles: 97,
    permit: 'Konzession Typ A',
    lastAudit: '2024-09-01',
    region: 'Innsbruck'
  },
  {
    id: 'CMP-1006',
    name: 'ÖkoDrive GmbH',
    tenantId: 'tenant-okodrive',
    tenantName: 'ÖkoDrive GmbH',
    status: 'pending',
    vehicles: 12,
    permit: 'Konzession Typ B',
    lastAudit: '2024-05-15',
    region: 'St. Pölten'
  },
  {
    id: 'CMP-1007',
    name: 'TaxiNova GmbH',
    tenantId: 'tenant-taxinova',
    tenantName: 'TaxiNova GmbH',
    status: 'active',
    vehicles: 64,
    permit: 'Konzession Typ A',
    lastAudit: '2024-03-24',
    region: 'Wien'
  },
  {
    id: 'CMP-1008',
    name: 'Vienna Mobility GmbH',
    tenantId: 'tenant-vienna-mobility',
    tenantName: 'Vienna Mobility GmbH',
    status: 'suspended',
    vehicles: 18,
    permit: 'Konzession Typ C',
    lastAudit: '2023-12-19',
    region: 'Wien'
  },
  {
    id: 'CMP-1009',
    name: 'AlpineFleet GmbH',
    tenantId: 'tenant-alpine',
    tenantName: 'AlpineFleet GmbH',
    status: 'active',
    vehicles: 44,
    permit: 'Konzession Typ B',
    lastAudit: '2024-07-02',
    region: 'Bregenz'
  },
  {
    id: 'CMP-1010',
    name: 'Mobilis AG',
    tenantId: 'tenant-mobilis',
    tenantName: 'Mobilis AG',
    status: 'pending',
    vehicles: 29,
    permit: 'Konzession Typ B',
    lastAudit: '2024-04-08',
    region: 'Klagenfurt'
  },
  {
    id: 'CMP-1011',
    name: 'Fleetia GmbH',
    tenantId: 'tenant-fleetia',
    tenantName: 'Fleetia GmbH',
    status: 'active',
    vehicles: 73,
    permit: 'Konzession Typ A',
    lastAudit: '2024-08-10',
    region: 'Wien'
  },
  {
    id: 'CMP-1012',
    name: 'CityCab Salzburg',
    tenantId: 'tenant-citycab-sbg',
    tenantName: 'CityCab Salzburg',
    status: 'active',
    vehicles: 33,
    permit: 'Konzession Typ A',
    lastAudit: '2024-05-27',
    region: 'Salzburg'
  },
  {
    id: 'CMP-1013',
    name: 'UrbanRide GmbH',
    tenantId: 'tenant-urbanride',
    tenantName: 'UrbanRide GmbH',
    status: 'pending',
    vehicles: 19,
    permit: 'Konzession Typ B',
    lastAudit: '2024-01-14',
    region: 'Wels'
  },
  {
    id: 'CMP-1014',
    name: 'Flottenwerk OG',
    tenantId: 'tenant-flottenwerk',
    tenantName: 'Flottenwerk OG',
    status: 'active',
    vehicles: 51,
    permit: 'Konzession Typ A',
    lastAudit: '2024-06-30',
    region: 'Graz'
  },
  {
    id: 'CMP-1015',
    name: 'Nightrider KG',
    tenantId: 'tenant-nightrider',
    tenantName: 'Nightrider KG',
    status: 'suspended',
    vehicles: 14,
    permit: 'Konzession Typ C',
    lastAudit: '2023-11-02',
    region: 'Linz'
  }
];

const STATUS_META = {
  active: { tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', labelKey: 'companies.status.active', fallback: 'Active' },
  pending: { tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', labelKey: 'companies.status.pending', fallback: 'Pending' },
  suspended: { tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', labelKey: 'companies.status.suspended', fallback: 'Suspended' }
};

const resolveUpdater = (updater, previous) =>
  typeof updater === 'function' ? updater(previous) : updater;

const formatDate = (dateString) => {
  try {
    const locale = AppState.language || 'de-AT';
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(dateString));
  } catch {
    return dateString;
  }
};

const createStatusBadge = (status, translate) => {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return `
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${meta.tone}">
      ${translate(meta.labelKey, meta.fallback)}
    </span>
  `;
};

let cleanupFns = [];

const disposeListeners = () => {
  cleanupFns.forEach((dispose) => {
    try {
      dispose();
    } catch {}
  });
  cleanupFns = [];
};

export default {
  init(target) {
    disposeListeners();
    AppState.setAsyncFlag('companies.loading', true);
    const translate = (key, fallback) => AppState.getTranslation?.(key) || fallback;
    AppState.setActiveModule?.('Companies');

    const storedPrefs = AppState.getTablePrefs(TABLE_PREF_KEY);
    let searchTerm = storedPrefs.filters?.search || '';
    let statusFilter = storedPrefs.filters?.status || 'all';
    let tenantFilter = storedPrefs.filters?.tenant || 'all';
    let pageSize = Number(storedPrefs.filters?.pageSize) || 10;
    let pageIndex = 0;
    let columnVisibility = storedPrefs.columnVisibility || {};
    let sorting = Array.isArray(storedPrefs.sorting) && storedPrefs.sorting.length
      ? storedPrefs.sorting
      : [{ id: 'name', desc: false }];

    const uniqueTenants = Array.from(
      new Map(
        COMPANY_DATA.map((row) => [row.tenantId, row.tenantName])
      ).entries()
    ).map(([id, label]) => ({ id, label }));

    const currentTenantId = AppState.tenant || (AppState.currentUser?.tenants?.[0]?.tenantId ?? '');

    const columns = [
      {
        id: 'name',
        accessorKey: 'name',
        header: () => translate('companies.columns.name', 'Company'),
        cell: (info) => `
          <div class="font-medium text-gray-900 dark:text-gray-100">${info.getValue()}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">${info.row.original.id}</div>
        `,
        meta: { align: 'left', label: translate('companies.columns.name', 'Company') }
      },
      {
        id: 'tenant',
        accessorKey: 'tenantName',
        header: () => translate('companies.columns.tenant', 'Tenant'),
        cell: (info) => `
          <div>${info.getValue()}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">${info.row.original.region}</div>
        `,
        meta: { align: 'left', label: translate('companies.columns.tenant', 'Tenant') }
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: () => translate('companies.columns.status', 'Status'),
        cell: (info) => createStatusBadge(info.getValue(), translate),
        meta: { align: 'left', label: translate('companies.columns.status', 'Status') }
      },
      {
        id: 'vehicles',
        accessorKey: 'vehicles',
        header: () => translate('companies.columns.vehicles', 'Vehicles'),
        cell: (info) => String(info.getValue()),
        meta: { align: 'right', label: translate('companies.columns.vehicles', 'Vehicles') }
      },
      {
        id: 'permit',
        accessorKey: 'permit',
        header: () => translate('companies.columns.permit', 'Permit'),
        cell: (info) => info.getValue(),
        meta: { align: 'left', label: translate('companies.columns.permit', 'Permit') }
      },
      {
        id: 'lastAudit',
        accessorKey: 'lastAudit',
        header: () => translate('companies.columns.lastAudit', 'Last audit'),
        cell: (info) => formatDate(info.getValue()),
        meta: { align: 'right', label: translate('companies.columns.lastAudit', 'Last audit') }
      }
    ];

    const layout = `
      <section class="space-y-6">
        <header class="space-y-2">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            ${translate('companies.title', 'Companies')}
          </h1>
          <p class="text-sm text-gray-600 dark:text-gray-300 max-w-3xl">
            ${translate(
              'companies.description',
              'Overview of all registered transport companies. Use filters, sorters and the column menu to tailor the dataset for your workflow.'
            )}
          </p>
        </header>

        <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-900/70">
          <div class="flex flex-wrap items-center gap-3">
            <div class="relative">
              <label for="companies-search" class="sr-only">${translate('companies.search.label', 'Search companies')}</label>
              <input
                id="companies-search"
                class="w-60 rounded-xl border border-gray-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100"
                type="search"
                placeholder="${translate('companies.search.placeholder', 'Search by name, permit or region')}"
                value="${searchTerm}"
              />
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 dark:text-gray-500">
                🔍
              </span>
            </div>
            <select id="companies-status-filter" class="rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100">
              <option value="all"${statusFilter === 'all' ? ' selected' : ''}>${translate('companies.filters.status.all', 'All statuses')}</option>
              <option value="active"${statusFilter === 'active' ? ' selected' : ''}>${translate('companies.status.active', 'Active')}</option>
              <option value="pending"${statusFilter === 'pending' ? ' selected' : ''}>${translate('companies.status.pending', 'Pending')}</option>
              <option value="suspended"${statusFilter === 'suspended' ? ' selected' : ''}>${translate('companies.status.suspended', 'Suspended')}</option>
            </select>
            <select id="companies-tenant-filter" class="rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100">
              <option value="all"${tenantFilter === 'all' ? ' selected' : ''}>${translate('companies.filters.tenant.all', 'All tenants')}</option>
              <option value="current"${tenantFilter === 'current' ? ' selected' : ''}>${translate('companies.filters.tenant.current', 'Active tenant')}</option>
              ${uniqueTenants
                .map(
                  (tenant) =>
                    `<option value="${tenant.id}"${tenantFilter === tenant.id ? ' selected' : ''}>${tenant.label}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="flex items-center gap-2">
            <label for="companies-page-size" class="text-sm text-gray-500 dark:text-gray-400">
              ${translate('companies.table.pageSize', 'Rows')}
            </label>
            <select id="companies-page-size" class="rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100">
              <option value="10"${pageSize === 10 ? ' selected' : ''}>10</option>
              <option value="20"${pageSize === 20 ? ' selected' : ''}>20</option>
              <option value="50"${pageSize === 50 ? ' selected' : ''}>50</option>
            </select>
            <div class="relative">
              <button
                type="button"
                id="companies-columns-toggle"
                class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                aria-expanded="false"
              >
                ${translate('companies.table.columns', 'Columns')}
              </button>
              <div
                id="companies-columns-panel"
                class="absolute right-0 z-40 mt-2 hidden w-48 rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
              ></div>
            </div>
          </div>
        </div>

        <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
              <thead class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-300"></thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800"></tbody>
            </table>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            <span id="companies-table-info"></span>
            <div class="flex items-center gap-1">
              <button data-page="prev" class="rounded-lg border border-gray-200 bg-white px-3 py-1 font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
                ${translate('companies.table.prev', 'Previous')}
              </button>
              <button data-page="next" class="rounded-lg border border-gray-200 bg-white px-3 py-1 font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
                ${translate('companies.table.next', 'Next')}
              </button>
            </div>
          </div>
        </div>
      </section>
    `;

    target.innerHTML = layout;

    const searchInput = target.querySelector('#companies-search');
    const statusSelect = target.querySelector('#companies-status-filter');
    const tenantSelect = target.querySelector('#companies-tenant-filter');
    const pageSizeSelect = target.querySelector('#companies-page-size');
    const tableHead = target.querySelector('thead');
    const tableBody = target.querySelector('tbody');
    const infoLabel = target.querySelector('#companies-table-info');
    const prevButton = target.querySelector('[data-page="prev"]');
    const nextButton = target.querySelector('[data-page="next"]');
    const columnsToggle = target.querySelector('#companies-columns-toggle');
    const columnsPanel = target.querySelector('#companies-columns-panel');

    const persistState = () => {
      AppState.updateTablePrefs(TABLE_PREF_KEY, (current) => ({
        ...current,
        columnVisibility,
        sorting,
        filters: {
          ...current.filters,
          search: searchTerm,
          status: statusFilter,
          tenant: tenantFilter,
          pageSize
        }
      }));
    };

    const getTenantLabel = (tenantId) =>
      uniqueTenants.find((tenant) => tenant.id === tenantId)?.label || tenantId;

    const applyFilters = () => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      return COMPANY_DATA.filter((row) => {
        const matchesSearch =
          !normalizedSearch ||
          [row.name, row.permit, row.region, row.tenantName]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedSearch));
        const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
        const matchesTenant =
          tenantFilter === 'all'
            ? true
            : tenantFilter === 'current'
            ? currentTenantId
              ? row.tenantId === currentTenantId
              : true
            : row.tenantId === tenantFilter;
        return matchesSearch && matchesStatus && matchesTenant;
      });
    };

    const renderColumnsPanel = (instance) => {
      if (!columnsPanel) return;
      const leafColumns = instance.getAllLeafColumns();
      columnsPanel.innerHTML = `
        <fieldset class="space-y-2">
          <legend class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            ${translate('companies.table.columns', 'Columns')}
          </legend>
          ${leafColumns
            .map((column) => {
              const checked = column.getIsVisible() ? 'checked' : '';
              const label =
                column.columnDef.meta?.label ||
                (typeof column.columnDef.header === 'string'
                  ? column.columnDef.header
                  : column.id);
              return `
                <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input type="checkbox" data-column="${column.id}" class="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500" ${checked} />
                  <span>${label}</span>
                </label>
              `;
            })
            .join('')}
        </fieldset>
      `;
      columnsPanel.querySelectorAll('input[data-column]').forEach((checkbox) => {
        const columnId = checkbox.getAttribute('data-column');
        checkbox.addEventListener('change', () => {
          const column = leafColumns.find((col) => col.id === columnId);
          if (!column) return;
          column.toggleVisibility(checkbox.checked);
        });
      });
    };

    const defaultPinning = { left: [], right: [] };

    const renderTable = () => {
      const filteredRows = applyFilters();
      const tableInstance = createTable({
        data: filteredRows,
        columns,
        state: {
          sorting,
          columnVisibility,
          columnPinning: defaultPinning
        },
        onSortingChange: (updater) => {
          sorting = resolveUpdater(updater, sorting);
          persistState();
          renderTable();
        },
        onColumnVisibilityChange: (updater) => {
          columnVisibility = resolveUpdater(updater, columnVisibility);
          persistState();
          renderTable();
        },
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel()
      });

      const sortedRows = tableInstance.getSortedRowModel().rows;
      const total = sortedRows.length;
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      if (pageIndex >= pageCount) pageIndex = Math.max(pageCount - 1, 0);

      const start = pageIndex * pageSize;
      const end = start + pageSize;
      const pageRows = sortedRows.slice(start, end);

      const headerGroups = tableInstance.getHeaderGroups();
      tableHead.innerHTML = headerGroups
        .map(
          (headerGroup) => `
            <tr>
              ${headerGroup.headers
                .map((header) => {
                  if (header.isPlaceholder) return '<th></th>';
                  const column = header.column;
                  const isSortable = column.getCanSort();
                  const sortState = column.getIsSorted();
                  const alignClass =
                    column.columnDef.meta?.align === 'right'
                      ? 'text-right'
                      : column.columnDef.meta?.align === 'center'
                      ? 'text-center'
                      : 'text-left';
                  const ariaSort =
                    sortState === 'asc' ? 'ascending' : sortState === 'desc' ? 'descending' : 'none';
                  const label =
                    typeof column.columnDef.header === 'function'
                      ? column.columnDef.header(header.getContext())
                      : column.columnDef.header || column.id;
                  const sortIndicator =
                    sortState === 'asc' ? '▲' : sortState === 'desc' ? '▼' : '';
                  return `
                    <th
                      scope="col"
                      class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 ${alignClass} ${isSortable ? 'cursor-pointer select-none' : ''}"
                      ${isSortable ? 'role="button" tabIndex="0"' : ''}
                      aria-sort="${ariaSort}"
                      data-column-id="${column.id}"
                    >
                      <span class="inline-flex items-center gap-1">
                        ${label}
                        <span class="text-[10px]">${sortIndicator}</span>
                      </span>
                    </th>
                  `;
                })
                .join('')}
            </tr>
          `
        )
        .join('');

      tableHead.querySelectorAll('[data-column-id]').forEach((th) => {
        const columnId = th.getAttribute('data-column-id');
        const column = tableInstance.getColumn(columnId);
        if (!column || !column.getCanSort()) return;
        const handleSort = (event) => {
          event.preventDefault();
          column.toggleSorting(undefined, event.shiftKey);
        };
        th.addEventListener('click', handleSort);
        th.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            handleSort(event);
          }
        });
      });

      if (!pageRows.length) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="${tableInstance.getVisibleLeafColumns().length}" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              ${translate('companies.table.empty', 'No companies match the current filters.')}
            </td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = pageRows
          .map(
            (row) => `
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                ${row.getVisibleCells()
                  .map((cell) => {
                    const alignClass =
                      cell.column.columnDef.meta?.align === 'right'
                        ? 'text-right'
                        : cell.column.columnDef.meta?.align === 'center'
                        ? 'text-center'
                        : 'text-left';
                    const value =
                      typeof cell.column.columnDef.cell === 'function'
                        ? cell.column.columnDef.cell(cell.getContext())
                        : cell.getValue();
                    return `<td class="px-4 py-3 ${alignClass} text-sm text-gray-700 dark:text-gray-200">${value}</td>`;
                  })
                  .join('')}
              </tr>
            `
          )
          .join('');
      }

      const rangeStart = total === 0 ? 0 : pageIndex * pageSize + 1;
      const rangeEnd = Math.min(total, pageIndex * pageSize + pageSize);
      infoLabel.textContent = translate(
        'companies.table.summary',
        '{start}-{end} of {total} records'
      )
        .replace('{start}', rangeStart)
        .replace('{end}', rangeEnd)
        .replace('{total}', total);

      prevButton.disabled = pageIndex === 0;
      nextButton.disabled = pageIndex >= pageCount - 1;

      renderColumnsPanel(tableInstance);
      AppState.setAsyncFlag('companies.loading', false);
    };

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchTerm = searchInput.value || '';
        pageIndex = 0;
        persistState();
        renderTable();
      });
    }

    if (statusSelect) {
      statusSelect.addEventListener('change', () => {
        statusFilter = statusSelect.value;
        pageIndex = 0;
        persistState();
        renderTable();
      });
    }

    if (tenantSelect) {
      tenantSelect.addEventListener('change', () => {
        tenantFilter = tenantSelect.value;
        pageIndex = 0;
        persistState();
        renderTable();
      });
    }

    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', () => {
        pageSize = Number(pageSizeSelect.value) || 10;
        pageIndex = 0;
        persistState();
        renderTable();
      });
    }

    if (prevButton) {
      prevButton.addEventListener('click', () => {
        if (pageIndex === 0) return;
        pageIndex -= 1;
        renderTable();
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        pageIndex += 1;
        renderTable();
      });
    }

    let columnsPanelOpen = false;
    const setColumnsPanelVisibility = (open) => {
      columnsPanelOpen = open;
      if (columnsPanel) {
        columnsPanel.classList.toggle('hidden', !open);
      }
      if (columnsToggle) {
        columnsToggle.setAttribute('aria-expanded', String(open));
      }
    };

    if (columnsToggle) {
      columnsToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        setColumnsPanelVisibility(!columnsPanelOpen);
      });
    }

    const onDocumentClick = (event) => {
      if (!columnsPanelOpen) return;
      if (!columnsPanel || !columnsToggle) return;
      if (columnsPanel.contains(event.target) || columnsToggle.contains(event.target)) return;
      setColumnsPanelVisibility(false);
    };
    const onEscape = (event) => {
      if (event.key === 'Escape' && columnsPanelOpen) {
        setColumnsPanelVisibility(false);
      }
    };

    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onEscape);

    const onHeaderSearch = (event) => {
      const value = event.detail?.value ?? '';
      searchTerm = value;
      if (searchInput) searchInput.value = value;
      pageIndex = 0;
      persistState();
      renderTable();
    };
    document.addEventListener('header:search', onHeaderSearch);

    cleanupFns.push(() => document.removeEventListener('click', onDocumentClick));
    cleanupFns.push(() => document.removeEventListener('keydown', onEscape));
    cleanupFns.push(() => document.removeEventListener('header:search', onHeaderSearch));

    renderTable();
  },
  dispose() {
    disposeListeners();
  }
};
