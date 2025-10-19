import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  createColumnHelper
} from '@tanstack/react-table';
import type {
  ColumnDef,
  SortingState,
  VisibilityState,
  RowSelectionState
} from '@tanstack/react-table';
import {
  Columns3,
  Download,
  EllipsisVertical,
  Filter,
  ListChecks,
  Loader2,
  PlusCircle,
  Search
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useQuerySync from '../hooks/useQuerySync';
import storage from '../utils/storage';
import { useToast } from '../components/feedback/ToastProvider';
import Modal from '../components/overlay/Modal';
import ConfirmDialog from '../components/overlay/ConfirmDialog';
import GoalForm from '../features/program/goals/GoalForm';
import type { GoalDynamicStatus, GoalRecord } from '../lib/repo/goals/types';
import { useGoalsRepository, normalizeError } from '../lib/repo/index.tsx';
import type { GoalFormValues } from '../lib/forms/validation';
import ImportDialog from '../features/program/goals/csv/ImportDialog';
import { startGoalsImport } from '../features/program/goals/csv/importJob';
import type { GoalsImportPayload } from '../features/program/goals/csv/importJob';
import { push as pushNotice } from '../lib/notifications/store';
import { Guard } from '../lib/rbac/guard';
import QueryErrorBoundary from '../components/errors/QueryErrorBoundary';
import ViewsMenu from '../components/views/ViewsMenu';
import { startCsvExport } from '../lib/export/exportCsv';
import {
  useGoalsList,
  useGoal,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  invalidateGoalsList
} from '../features/program/goals/api';

const STORAGE_KEY = 'tp-admin@program-goals';

const ALL_COLUMN_IDS = ['select', 'status', 'name', 'owner', 'audits', 'updated', 'actions'] as const;
type GoalColumnId = (typeof ALL_COLUMN_IDS)[number];
const SORTABLE_COLUMNS = ['status', 'name', 'owner', 'audits', 'updated'] as const;
type GoalSortableColumnId = (typeof SORTABLE_COLUMNS)[number];

const statusBadgeStyles: Record<GoalDynamicStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  risk: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
};

const statusLabels: Record<GoalDynamicStatus, string> = {
  ok: 'On Track',
  warn: 'At Risk',
  risk: 'Blocked'
};

const GOAL_COLUMN_HEADERS: Record<GoalSortableColumnId, string> = {
  status: 'Status',
  name: 'Goal',
  owner: 'Owner',
  audits: 'Audits',
  updated: 'Updated'
};

const GOAL_COLUMN_ACCESSORS: Record<GoalSortableColumnId, (record: GoalRecord) => unknown> = {
  status: record => statusLabels[record.dynamicStatus] ?? record.dynamicStatus,
  name: record => record.name,
  owner: record => record.owner,
  audits: record => record.audits,
  updated: record => record.updatedAt
};

const STATUS_OPTIONS: GoalDynamicStatus[] = ['ok', 'warn', 'risk'];

const GOAL_COLUMN_SET = new Set<string>(ALL_COLUMN_IDS);
const isGoalColumn = (value: string): value is GoalColumnId => GOAL_COLUMN_SET.has(value);
const isGoalSort = (value: string): value is GoalSortableColumnId =>
  SORTABLE_COLUMNS.includes(value as GoalSortableColumnId);
const STATUS_SET = new Set<GoalDynamicStatus>(STATUS_OPTIONS);
const isGoalStatus = (value: string): value is GoalDynamicStatus =>
  STATUS_SET.has(value as GoalDynamicStatus);
const isExportableColumn = (columnId: GoalColumnId): columnId is GoalSortableColumnId =>
  columnId !== 'select' && columnId !== 'actions';

const DEFAULT_SORT: { sort: GoalSortableColumnId; order: 'asc' | 'desc' } = {
  sort: 'name',
  order: 'asc'
};

const mapVisibleToState = (visible: readonly string[]): VisibilityState => {
  const normalized = visible.filter(isGoalColumn);
  const hidden = ALL_COLUMN_IDS.filter(id => !normalized.includes(id));
  return hidden.reduce<VisibilityState>((acc, col) => {
    acc[col] = false;
    return acc;
  }, {});
};

const extractVisible = (visibility: VisibilityState): GoalColumnId[] =>
  ALL_COLUMN_IDS.filter(id => visibility[id] !== false);

const visibilityEquals = (a: VisibilityState, b: VisibilityState): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
};

const mapSortingFromQuery = (sort: string, order: 'asc' | 'desc'): SortingState =>
  sort ? [{ id: sort, desc: order === 'desc' }] : [];

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(iso));
  } catch (_) {
    return '—';
  }
};

type QueryState = {
  q: string;
  status: string[];
  sort: string;
  order: string;
  page: number;
  pageSize: number;
  cols: string[];
  modal: string;
  modalGoal: string;
};

const QueryDefaults: QueryState = {
  q: '',
  status: [],
  sort: DEFAULT_SORT.sort,
  order: DEFAULT_SORT.order,
  page: 0,
  pageSize: 10,
  cols: [...ALL_COLUMN_IDS],
  modal: '',
  modalGoal: ''
};

type RowMenuState = {
  id: string;
};

const skeletonRows = Array.from({ length: 6 }, (_, index) => index);

const ProgramGoalsPageContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const goalsRepo = useGoalsRepository();
  const queryClient = useQueryClient();
  const storedPrefs =
    storage.get<{ pageSize: number; columns: string[] }>(STORAGE_KEY) ?? {
      pageSize: 10,
      columns: [...ALL_COLUMN_IDS]
    };

  const [{
    pageSize: defaultPageSize,
    columns: defaultColumns
  }] = useState({
    pageSize: storedPrefs.pageSize ?? 10,
    columns: storedPrefs.columns ?? [...ALL_COLUMN_IDS]
  });

  const [query, setQuery] = useQuerySync<QueryState>({
    defaults: {
      ...QueryDefaults,
      pageSize: defaultPageSize,
      cols: defaultColumns
    },
    schema: {
      q: 'string',
      status: 'string[]',
      sort: 'string',
      order: 'string',
      page: 'number',
      pageSize: 'number',
      cols: 'string[]',
      modal: 'string',
      modalGoal: 'string'
    }
  });

  const sortKey = isGoalSort(query.sort) ? query.sort : DEFAULT_SORT.sort;
  const sortOrder: 'asc' | 'desc' = query.order === 'desc' ? 'desc' : DEFAULT_SORT.order;

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
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GoalRecord | null>(null);
  const [pendingAction, setPendingAction] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const lastUserActionRef = useRef<'filter' | 'modal' | null>(null);

  const selectedStatuses = useMemo(
    () => query.status.filter(isGoalStatus),
    [query.status]
  );

  const listQuery = useMemo(
    () => ({
      search: query.q,
      status: selectedStatuses,
      sort: sortKey,
      order: sortOrder
    }),
    [query.q, selectedStatuses, sortKey, sortOrder]
  );

  const goalsQuery = useGoalsList({
    search: query.q,
    status: selectedStatuses,
    sort: sortKey,
    order: sortOrder,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
    cols: query.cols
  });

  if (goalsQuery.isError) {
    throw goalsQuery.error;
  }

  const goals = goalsQuery.data?.items ?? [];
  const totalResults = goalsQuery.data?.total ?? 0;
  const showSkeleton = goalsQuery.isInitialLoading;
  const isFetching = goalsQuery.isFetching && !goalsQuery.isInitialLoading;

  const createGoalMutation = useCreateGoal();
  const updateGoalMutation = useUpdateGoal();
  const deleteGoalMutation = useDeleteGoal();
  const modalBusy = createGoalMutation.isPending || updateGoalMutation.isPending;
  const deleteBusy = deleteGoalMutation.isPending && pendingAction === 'delete';

  useEffect(() => {
    storage.set(STORAGE_KEY, {
      pageSize: query.pageSize,
      columns: query.cols.length ? query.cols : ALL_COLUMN_IDS
    });
  }, [query.cols, query.pageSize]);

  useEffect(() => {
    if (lastUserActionRef.current === 'filter') {
      setRowSelection({});
      lastUserActionRef.current = null;
    }
  }, [query.q, query.status, query.sort, query.order, query.page, query.pageSize, query.cols]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setColumnMenuOpen(false);
        setRowMenu(null);
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  useEffect(() => {
    if (!columnMenuOpen) {
      return undefined;
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-column-menu]')) {
        setColumnMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [columnMenuOpen]);

  useEffect(() => {
    if (!rowMenu) {
      return undefined;
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-row-menu]')) {
        setRowMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [rowMenu]);

  useEffect(() => {
    setColumnVisibility(prev => {
      const next = mapVisibleToState(query.cols.length ? query.cols : ALL_COLUMN_IDS);
      return visibilityEquals(prev, next) ? prev : next;
    });
  }, [query.cols]);

  useEffect(() => {
    setSorting(mapSortingFromQuery(sortKey, sortOrder));
  }, [sortKey, sortOrder]);

  useEffect(() => {
    setPagination(prev => {
      const next = {
        pageIndex: query.page,
        pageSize: query.pageSize
      };
      if (prev.pageIndex !== next.pageIndex || prev.pageSize !== next.pageSize) {
        return next;
      }
      return prev;
    });
  }, [query.page, query.pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(goals.length / Math.max(1, pagination.pageSize)));
    if (pagination.pageIndex >= totalPages) {
      const nextIndex = Math.max(0, totalPages - 1);
      if (nextIndex !== pagination.pageIndex) {
        setPagination(prev => ({ ...prev, pageIndex: nextIndex }));
        setQuery({ page: nextIndex });
      }
    }
  }, [goals.length, pagination.pageIndex, pagination.pageSize, setQuery]);

  const columnHelper = createColumnHelper<GoalRecord>();

  const columns = useMemo<ColumnDef<GoalRecord, unknown>[]>(() => [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          aria-label={`Select ${row.original.name}`}
        />
      ),
      enableSorting: false,
      meta: { label: 'Select' }
    }),
    columnHelper.accessor('dynamicStatus', {
      id: 'status',
      header: () => 'Status',
      cell: info => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeStyles[info.getValue()]}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {statusLabels[info.getValue()]}
        </span>
      ),
      sortingFn: 'alphanumeric',
      meta: { label: 'Status' }
    }),
    columnHelper.accessor('name', {
      header: () => 'Goal',
      cell: info => (
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link
              to={{ pathname: `/program/goals/${info.row.original.id}`, search: location.search }}
              className="font-medium text-slate-900 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:text-slate-100 dark:hover:text-slate-200"
            >
              {info.getValue()}
            </Link>
            <div className="text-xs text-slate-500 dark:text-slate-400">{info.row.original.id}</div>
          </div>
        </div>
      ),
      sortingFn: 'alphanumeric',
      meta: { label: 'Goal' }
    }),
    columnHelper.accessor('owner', {
      header: () => 'Owner',
      cell: info => info.getValue(),
      sortingFn: 'alphanumeric',
      meta: { label: 'Owner' }
    }),
    columnHelper.accessor('audits', {
      header: () => 'Audits',
      cell: info => info.getValue(),
      sortingFn: 'basic',
      meta: { label: 'Audits' }
    }),
    columnHelper.accessor('updatedAt', {
      id: 'updated',
      header: () => 'Updated',
      cell: info => (
        <span className="text-slate-600 dark:text-slate-300">{formatDate(info.getValue())}</span>
      ),
      sortingFn: 'alphanumeric',
      meta: { label: 'Updated' }
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const isOpen = rowMenu?.id === row.original.id;
        return (
          <div className="relative" data-row-menu>
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                setRowMenu(prev => (prev?.id === row.original.id ? null : { id: row.original.id }));
              }}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Open actions</span>
            </button>
            {isOpen ? (
              <div
                role="menu"
                aria-label={`${row.original.name} actions`}
                className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => {
                    setRowMenu(null);
                    openEditModal(row.original.id);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:text-rose-300 dark:hover:bg-rose-500/20"
                  onClick={() => {
                    setRowMenu(null);
                    setDeleteTarget(row.original);
                  }}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        );
      },
      enableSorting: false,
      meta: { label: 'Actions' }
    })
  ], [columnHelper, location.search, rowMenu]);

  const table = useReactTable({
    data: goals,
    columns,
    state: {
      sorting,
      columnVisibility,
      pagination,
      rowSelection
    },
    onSortingChange: updater => {
      setSorting(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (!next.length) {
          setQuery({ sort: DEFAULT_SORT.sort, order: DEFAULT_SORT.order });
          lastUserActionRef.current = 'filter';
          return next;
        }
        const [first] = next;
        const nextSort = typeof first.id === 'string' && isGoalSort(first.id) ? first.id : DEFAULT_SORT.sort;
        setQuery({ sort: nextSort, order: first.desc ? 'desc' : 'asc' });
        lastUserActionRef.current = 'filter';
        return next;
      });
    },
    onColumnVisibilityChange: updater => {
      setColumnVisibility(prev => {
        const next = typeof updater === 'function' ? updater(prev) : (updater as VisibilityState);
        const visible = extractVisible(next);
        setQuery({ cols: visible });
        return next;
      });
    },
    onPaginationChange: updater => {
      setPagination(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (prev.pageIndex !== next.pageIndex) {
          setQuery({ page: next.pageIndex });
          lastUserActionRef.current = 'filter';
        }
        if (prev.pageSize !== next.pageSize) {
          setQuery({ pageSize: next.pageSize, page: 0 });
          lastUserActionRef.current = 'filter';
          return { ...next, pageIndex: 0 };
        }
        return next;
      });
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSortingRemoval: true,
    autoResetPageIndex: false,
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(totalResults / Math.max(1, pagination.pageSize))),
    debugTable: false
  });

  const pageCount = Math.max(1, Math.ceil(totalResults / Math.max(1, pagination.pageSize)));
  const currentPage = table.getState().pagination.pageIndex;

  const visibleColumns = extractVisible(columnVisibility);
  const hasFilters = Boolean(query.q || selectedStatuses.length);
  const showEmpty = !showSkeleton && totalResults === 0 && !hasFilters;
  const showNoResults = !showSkeleton && totalResults === 0 && hasFilters;

  const createModalOpen = query.modal === 'create';
  const editModalOpen = query.modal === 'edit' && Boolean(query.modalGoal);

  const { data: editGoalData } = useGoal(editModalOpen ? query.modalGoal : null);
  const editTarget = useMemo(
    () => editGoalData ?? goals.find(goal => goal.id === query.modalGoal),
    [editGoalData, goals, query.modalGoal]
  );

  const openCreateModal = () => {
    lastUserActionRef.current = 'modal';
    const params = new URLSearchParams(location.search);
    params.set('modal', 'create');
    params.delete('modalGoal');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: false });
  };

  const openEditModal = (goalId: string) => {
    lastUserActionRef.current = 'modal';
    const params = new URLSearchParams(location.search);
    params.set('modal', 'edit');
    params.set('modalGoal', goalId);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: false });
  };

  const closeModal = () => {
    const params = new URLSearchParams(location.search);
    params.delete('modal');
    params.delete('modalGoal');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const handleSearch = (value: string) => {
    lastUserActionRef.current = 'filter';
    setQuery({ q: value, page: 0 });
  };

  const toggleStatus = (status: GoalDynamicStatus) => {
    lastUserActionRef.current = 'filter';
    const current = new Set(selectedStatuses);
    if (current.has(status)) {
      current.delete(status);
    } else {
      current.add(status);
    }
    setQuery({ status: Array.from(current), page: 0 });
  };

  const clearFilters = () => {
    lastUserActionRef.current = 'filter';
    setQuery({ q: '', status: [], page: 0 });
  };

  const handleExport = () => {
    const exportColumns = visibleColumns
      .filter(isExportableColumn)
      .map(columnId => ({
        id: columnId,
        header: GOAL_COLUMN_HEADERS[columnId],
        accessor: GOAL_COLUMN_ACCESSORS[columnId]
      }));
    if (!exportColumns.length) {
      showToast({
        title: 'Nothing to export',
        description: 'Select at least one data column before exporting.',
        tone: 'info'
      });
      return;
    }
    startCsvExport<GoalRecord>({
      module: 'program-goals',
      filename: 'program-goals.csv',
      columns: exportColumns,
      rows: goals,
      totalCount: totalResults,
      query: {
        ...listQuery,
        page: pagination.pageIndex,
        pageSize: pagination.pageSize,
        cols: visibleColumns
      },
      threshold: 750
    });
  };

  const handleImportButton = () => {
    setImportOpen(true);
  };

  const handleImportDenied = () => {
    pushNotice({
      type: 'warning',
      title: 'Action denied',
      body: 'You do not have permission to import goals.',
      link: '/system'
    });
  };

  const handleStartImport = async (payload: GoalsImportPayload) => {
    startGoalsImport(payload, {
      repository: goalsRepo,
      onRefresh: () => invalidateGoalsList(queryClient)
    });
  };

  const handleCreate = async (values: GoalFormValues) => {
    setPendingAction('create');
    try {
      await createGoalMutation.mutateAsync(values);
      closeModal();
    } catch (error) {
      const normalized = normalizeError(error, 'Please try again later.');
      showToast({
        title: 'Could not create goal',
        description: normalized.message,
        tone: 'error'
      });
      throw normalized;
    } finally {
      setPendingAction(null);
    }
  };

  const handleEdit = async (values: GoalFormValues) => {
    if (!editTarget) {
      return;
    }
    setPendingAction('edit');
    try {
      await updateGoalMutation.mutateAsync({ id: editTarget.id, input: values });
      closeModal();
    } catch (error) {
      const normalized = normalizeError(error, 'Please try again later.');
      showToast({
        title: 'Could not save goal',
        description: normalized.message,
        tone: 'error'
      });
      throw normalized;
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setPendingAction('delete');
    try {
      await deleteGoalMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      showToast({
        title: 'Could not delete goal',
        description: normalizeError(error, 'Please try again later.').message,
        tone: 'error'
      });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section className="flex flex-1 flex-col gap-5" aria-labelledby="goals-heading">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 id="goals-heading" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Strategic goals
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track goal performance, audit cadence, and owners across the TAXIPartner program.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Guard
            can="program.goals.import"
            fallback={
              <button
                type="button"
                onClick={handleImportDenied}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-400 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-500"
              >
                Import CSV
              </button>
            }
          >
            <button
              type="button"
              onClick={handleImportButton}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Import CSV
            </button>
          </Guard>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            New goal
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search goals, owners, or IDs…"
            value={query.q}
            onChange={event => handleSearch(event.target.value)}
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
                <Filter className="h-4 w-4" aria-hidden="true" />
                {statusLabels[status]}
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
            disabled={!goals.length}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <ViewsMenu
            currentQuery={{
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
              if ('q' in next && typeof next.q === 'string') {
                payload.q = next.q;
              }
              if ('status' in next) {
                const nextStatus = Array.isArray(next.status)
                  ? next.status.filter((value): value is string => typeof value === 'string')
                  : [];
                payload.status = nextStatus;
              }
              if ('sort' in next) {
                const nextSort = typeof next.sort === 'string' ? next.sort : DEFAULT_SORT.sort;
                payload.sort = isGoalSort(nextSort) ? nextSort : DEFAULT_SORT.sort;
              }
              if ('order' in next) {
                const nextOrder = typeof next.order === 'string' ? next.order : DEFAULT_SORT.order;
                payload.order = nextOrder === 'desc' ? 'desc' : DEFAULT_SORT.order;
              }
              if ('pageSize' in next) {
                const nextPageSize = Number(next.pageSize);
                if (!Number.isNaN(nextPageSize) && nextPageSize > 0) {
                  payload.pageSize = nextPageSize;
                }
              }
              if ('cols' in next) {
                const nextCols = Array.isArray(next.cols)
                  ? next.cols.filter((value): value is string => typeof value === 'string')
                  : [];
                payload.cols = nextCols.length ? nextCols : [...ALL_COLUMN_IDS];
              }
              if ('page' in next) {
                const nextPage = Number(next.page);
                if (!Number.isNaN(nextPage) && nextPage >= 0) {
                  payload.page = nextPage;
                }
              }
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
                  {ALL_COLUMN_IDS.filter(id => id !== 'select').map(columnId => {
                    const column = table.getColumn(columnId);
                    if (!column) return null;
                    const columnLabel =
                      (column.columnDef.meta as { label?: string } | undefined)?.label ?? columnId;
                    return (
                      <li key={columnId}>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                            checked={column.getIsVisible()}
                            onChange={column.getToggleVisibilityHandler()}
                          />
                          <span className="text-slate-600 dark:text-slate-300">
                            {columnLabel}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-400"
          >
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            Sort
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        style={{ contain: 'paint', willChange: 'transform' }}
      >
          <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
            <thead className="bg-slate-50 text-left font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => {
                    const canSort = header.column.getCanSort();
                    const sortState = header.column.getIsSorted();
                    return (
                      <th key={header.id} scope="col" className="px-4 py-3">
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-left transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:focus-visible:outline-slate-400"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortState === 'asc'
                              ? '▲'
                              : sortState === 'desc'
                              ? '▼'
                              : ''}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {showSkeleton
                ? skeletonRows.map(row => (
                    <tr key={row} className="animate-pulse">
                      {visibleColumns.map(columnId => (
                        <td key={columnId} className="px-4 py-3">
                          <div className="h-4 w-full rounded bg-slate-200/70 dark:bg-slate-700/60" />
                        </td>
                      ))}
                    </tr>
                  ))
                : table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-4 py-3 text-slate-600 dark:text-slate-200">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
              {showEmpty ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-16 text-center">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-slate-500 dark:text-slate-300">
                      <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
                      <div>
                        <p className="text-base font-semibold">No goals yet</p>
                        <p className="mt-1 text-sm">
                          Create your first program goal to start tracking progress and cadence.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        <PlusCircle className="h-4 w-4" aria-hidden="true" />
                        Add first goal
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
              {showNoResults ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-300">
                    <div className="flex flex-col items-center gap-3">
                      <p>No goals match the current filters.</p>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Filter className="h-4 w-4" aria-hidden="true" />
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!showSkeleton && !showEmpty && !showNoResults && table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-300">
                    No goals available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
        <div>
          Page {currentPage + 1} of {pageCount || 1} • {totalResults} results
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            Rows:
            <select
              value={table.getState().pagination.pageSize}
              onChange={event => table.setPageSize(Number(event.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 focus:border-slate-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {[10, 20, 50].map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </footer>

      <Modal
        isOpen={createModalOpen}
        onClose={closeModal}
        title="Create goal"
        description="Document a new strategic goal and assign an owner."
      >
        <GoalForm
          onSubmit={handleCreate}
          onCancel={closeModal}
          submitLabel="Create goal"
          busy={modalBusy}
        />
      </Modal>

      <Modal
        isOpen={editModalOpen && Boolean(editTarget)}
        onClose={closeModal}
        title="Edit goal"
        description={editTarget ? `Update ${editTarget.name} and keep stakeholders in sync.` : undefined}
      >
        <GoalForm
          initialValues={editTarget ?? undefined}
          onSubmit={handleEdit}
          onCancel={closeModal}
          submitLabel="Save changes"
          busy={modalBusy}
        />
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete goal"
        description={deleteTarget ? `This will remove ${deleteTarget.name} from the program goals.` : undefined}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteBusy}
      />
      <ImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onStart={async payload => {
          await handleStartImport(payload);
        }}
      />
    </section>
  );
};

const ProgramGoalsPage: React.FC = () => (
  <QueryErrorBoundary>
    <ProgramGoalsPageContent />
  </QueryErrorBoundary>
);

export default ProgramGoalsPage;
