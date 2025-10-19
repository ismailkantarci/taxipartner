import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Search
} from 'lucide-react';
import {
  keepPreviousData,
  useQueryClient
} from '@tanstack/react-query';
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable
} from '@tanstack/react-table';
import { useTranslation } from '../../lib/i18n';
import {
  useTenantsQuery,
  useTenantIdentityHistory,
  useTenantIdentifiers,
  useTenantAttachments,
  useTenantShareholdings,
  useTenantApprovals,
  useTenantOfficers,
  useTenantVehicleAssignments,
  useTenantDriverAssignments,
  useCreateTenantIdentity,
  useCreateShareholding,
  useCreateAttachment,
  useCreateOfficer,
  useCreateVehicleAssignment,
  useCreateDriverAssignment,
  useUpdateOfficer,
  useDeleteOfficer,
  useUpdateVehicleAssignment,
  useDeleteVehicleAssignment,
  useUpdateDriverAssignment,
  useDeleteDriverAssignment,
  useCreateTenant,
  useAssignTenantUser,
  useDeleteAttachment,
  useDeleteTenantApproval,
  useCreateTenantApproval,
  tenantKeys
} from '../../api/tenants';
import type {
  TenantItem,
  TenantListParams,
  TenantIdentityItem,
  TenantIdentifierItem,
  AttachmentItem,
  ShareholdingItem,
  TenantApprovalItem,
  OfficerItem,
  VehicleAssignmentItem,
  DriverAssignmentItem,
  CreateTenantInput,
  AssignTenantUserInput,
  CreateAttachmentInput,
  CreateOfficerInput,
  CreateVehicleAssignmentInput,
  CreateDriverAssignmentInput,
  CreateApprovalInput
} from '../../api/tenants/types';
import { CrudLayout, DataGrid, DetailPanel, InlineFilterBar, FormDialog } from '../common';
import { cx } from '../common/utils';
import { useToast } from '../../components/feedback/ToastProvider';
import ConfirmDialog from '../../components/overlay/ConfirmDialog';

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

const toInputDate = (value?: string | null) => {
  if (!value) return '';
  return value.slice(0, 10);
};

const TenantStatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const { t } = useTranslation();
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
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
  const className =
    palette[normalized] ??
    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200';
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        className
      )}
    >
      {status}
    </span>
  );
};

const mapStatusOptions = (t: ReturnType<typeof useTranslation>['t']) =>
  STATUS_FILTERS.map(option => ({
    value: option.value,
    label: t(option.labelKey, { defaultValue: option.fallback })
  }));

type EditDialogState<T> = { mode: 'create' | 'edit'; record?: T } | null;

const TenantsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<TenantListParams['sort']>('name');
  const [order, setOrder] = useState<TenantListParams['order']>('asc');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [isIdentityDialogOpen, setIdentityDialogOpen] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [isShareholdingDialogOpen, setShareholdingDialogOpen] = useState(false);
  const [shareholdingError, setShareholdingError] = useState<string | null>(null);
  const [isAttachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentDeleteTarget, setAttachmentDeleteTarget] = useState<AttachmentItem | null>(null);
  const [officerDialog, setOfficerDialog] = useState<EditDialogState<OfficerItem>>(null);
  const [officerError, setOfficerError] = useState<string | null>(null);
  const [officerDeleteTarget, setOfficerDeleteTarget] = useState<OfficerItem | null>(null);
  const [vehicleDialog, setVehicleDialog] = useState<EditDialogState<VehicleAssignmentItem>>(null);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [vehicleDeleteTarget, setVehicleDeleteTarget] = useState<VehicleAssignmentItem | null>(null);
  const [driverDialog, setDriverDialog] = useState<EditDialogState<DriverAssignmentItem>>(null);
  const [driverError, setDriverError] = useState<string | null>(null);
  const [driverDeleteTarget, setDriverDeleteTarget] = useState<DriverAssignmentItem | null>(null);
  const [isApprovalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalDeleteTarget, setApprovalDeleteTarget] = useState<TenantApprovalItem | null>(null);
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

  const columns = useMemo<ColumnDef<TenantItem>[]>(
    () => [
      {
        header: t('tenants.table.tenant', { defaultValue: 'Tenant' }),
        accessorKey: 'legalName',
        cell: info => {
          const record = info.row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {record.legalName}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{record.tenantId}</span>
            </div>
          );
        }
      },
      {
        header: t('tenants.table.status', { defaultValue: 'Status' }),
        accessorKey: 'status',
        cell: info => <TenantStatusBadge status={info.getValue<string | null | undefined>()} />
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
        }
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
    ],
    [t]
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount
  });

  const selectedTenant = items.find(item => item.tenantId === selectedTenantId) ?? null;

  const identityHistory = useTenantIdentityHistory(selectedTenantId, {
    enabled: Boolean(selectedTenantId),
    placeholderData: keepPreviousData
  });

  const identifiers = useTenantIdentifiers(selectedTenantId, {
    enabled: Boolean(selectedTenantId),
    placeholderData: keepPreviousData
  });

  const attachments = useTenantAttachments(selectedTenantId, {
    enabled: Boolean(selectedTenantId),
    placeholderData: keepPreviousData
  });

  const shareholdings = useTenantShareholdings(selectedTenantId, {
    enabled: Boolean(selectedTenantId),
    placeholderData: keepPreviousData
  });

  const approvals = useTenantApprovals(selectedTenantId, {
    enabled: Boolean(selectedTenantId),
    placeholderData: keepPreviousData
  });
  const officers = useTenantOfficers(selectedTenantId, {
    enabled: Boolean(selectedTenantId),
    placeholderData: keepPreviousData
  });
  const vehicleAssignments = useTenantVehicleAssignments(selectedTenantId, {
    enabled: Boolean(selectedTenantId),
    placeholderData: keepPreviousData
  });
  const driverAssignments = useTenantDriverAssignments(selectedTenantId, {
    enabled: Boolean(selectedTenantId),
    placeholderData: keepPreviousData
  });

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['tenants'] });
  };

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

  const identityItems: TenantIdentityItem[] = identityHistory.data?.items ?? [];
  const identifierItems: TenantIdentifierItem[] = identifiers.data?.items ?? [];
  const attachmentItems: AttachmentItem[] = attachments.data?.items ?? [];
  const shareholdingItems: ShareholdingItem[] = shareholdings.data?.items ?? [];
  const approvalItems: TenantApprovalItem[] = approvals.data?.items ?? [];
  const officerItems: OfficerItem[] = officers.data?.items ?? [];
  const vehicleItems: VehicleAssignmentItem[] = vehicleAssignments.data?.items ?? [];
  const driverItems: DriverAssignmentItem[] = driverAssignments.data?.items ?? [];

  const identityMutation = useCreateTenantIdentity(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setIdentityDialogOpen(false);
      setIdentityError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.identities(selectedTenantId) });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.identifiers.error', { defaultValue: 'Failed to create identifier.' });
      setIdentityError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const attachmentMutation = useCreateAttachment(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setAttachmentDialogOpen(false);
      setAttachmentError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.attachments(selectedTenantId) });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.attachments.error', { defaultValue: 'Failed to create attachment.' });
      setAttachmentError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const deleteAttachmentMutation = useDeleteAttachment(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setAttachmentDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.attachments(selectedTenantId) });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.attachments.error', { defaultValue: 'Failed to create attachment.' });
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const shareholdingMutation = useCreateShareholding(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setShareholdingDialogOpen(false);
      setShareholdingError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.shareholdings(selectedTenantId) });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.shareholdings.error', { defaultValue: 'Failed to create shareholding.' });
      setShareholdingError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const approvalMutation = useCreateTenantApproval(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setApprovalDialogOpen(false);
      setApprovalError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.approvals(selectedTenantId) });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.approvals.error', { defaultValue: 'Failed to create approval.' });
      setApprovalError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const deleteApprovalMutation = useDeleteTenantApproval(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setApprovalDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.approvals(selectedTenantId) });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.approvals.error', { defaultValue: 'Failed to create approval.' });
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const officerMutation = useCreateOfficer(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setOfficerDialog(null);
      setOfficerError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.officers(selectedTenantId) });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.officers.error', { defaultValue: 'Failed to add officer.' });
      setOfficerError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const updateOfficerMutation = useUpdateOfficer(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setOfficerDialog(null);
      setOfficerError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.officers(selectedTenantId) });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.officers.error', { defaultValue: 'Failed to add officer.' });
      setOfficerError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const deleteOfficerMutation = useDeleteOfficer(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setOfficerDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.officers(selectedTenantId) });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.officers.error', { defaultValue: 'Failed to add officer.' });
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const vehicleMutation = useCreateVehicleAssignment(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setVehicleDialog(null);
      setVehicleError(null);
      await queryClient.invalidateQueries({
        queryKey: tenantKeys.vehicleAssignments(selectedTenantId)
      });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.vehicles.error', { defaultValue: 'Failed to assign vehicle.' });
      setVehicleError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const updateVehicleMutation = useUpdateVehicleAssignment(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setVehicleDialog(null);
      setVehicleError(null);
      await queryClient.invalidateQueries({
        queryKey: tenantKeys.vehicleAssignments(selectedTenantId)
      });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.vehicles.error', { defaultValue: 'Failed to assign vehicle.' });
      setVehicleError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const deleteVehicleMutation = useDeleteVehicleAssignment(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setVehicleDeleteTarget(null);
      await queryClient.invalidateQueries({
        queryKey: tenantKeys.vehicleAssignments(selectedTenantId)
      });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.vehicles.error', { defaultValue: 'Failed to assign vehicle.' });
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const driverMutation = useCreateDriverAssignment(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setDriverDialog(null);
      setDriverError(null);
      await queryClient.invalidateQueries({
        queryKey: tenantKeys.driverAssignments(selectedTenantId)
      });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.drivers.error', { defaultValue: 'Failed to assign driver.' });
      setDriverError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const updateDriverMutation = useUpdateDriverAssignment(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setDriverDialog(null);
      setDriverError(null);
      await queryClient.invalidateQueries({
        queryKey: tenantKeys.driverAssignments(selectedTenantId)
      });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.drivers.error', { defaultValue: 'Failed to assign driver.' });
      setDriverError(message);
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const deleteDriverMutation = useDeleteDriverAssignment(selectedTenantId ?? '', {
    onSuccess: async () => {
      if (!selectedTenantId) return;
      setDriverDeleteTarget(null);
      await queryClient.invalidateQueries({
        queryKey: tenantKeys.driverAssignments(selectedTenantId)
      });
    },
    onError: error => {
      const message =
        error instanceof Error
          ? error.message
          : t('tenants.detail.drivers.error', { defaultValue: 'Failed to assign driver.' });
      showToast({
        title: t('tenants.toasts.errorTitle', { defaultValue: 'Action failed' }),
        description: message,
        tone: 'error'
      });
    }
  });

  const createTenantMutation = useCreateTenant({
    onSuccess: async response => {
      setCreateTenantDialogOpen(false);
      setCreateTenantError(null);
      const newlyCreatedId = response.tenant?.tenantId;
      if (newlyCreatedId) {
        setSelectedTenantId(newlyCreatedId);
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

  const editingOfficer = officerDialog?.record ?? null;
  const officerFormBusy =
    officerDialog?.mode === 'edit' ? updateOfficerMutation.isPending : officerMutation.isPending;
  const editingVehicle = vehicleDialog?.record ?? null;
  const vehicleFormBusy =
    vehicleDialog?.mode === 'edit' ? updateVehicleMutation.isPending : vehicleMutation.isPending;
  const editingDriver = driverDialog?.record ?? null;
  const driverFormBusy =
    driverDialog?.mode === 'edit' ? updateDriverMutation.isPending : driverMutation.isPending;

  const handleIdentifierSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const idType = (formData.get('idType') as string | null)?.trim() ?? '';
    const idValue = (formData.get('idValue') as string | null)?.trim() ?? '';
    if (!idType || !idValue) {
      setIdentityError(
        t('tenants.detail.identifiers.validation', {
          defaultValue: 'Identifier type and value are required.'
        })
      );
      return;
    }
    setIdentityError(null);
    try {
      await identityMutation.mutateAsync({
        idType,
        idValue,
        countryCode: (formData.get('countryCode') as string | null)?.trim() || undefined,
        validFrom: (formData.get('validFrom') as string | null) || undefined,
        validTo: (formData.get('validTo') as string | null) || undefined,
        target: (formData.get('target') as string | null)?.trim() || undefined,
        primaryFlag: formData.get('primaryFlag') === 'on'
      });
      showToast({
        title: t('tenants.toasts.identifierCreated', { defaultValue: 'Identifier saved' }),
        description: idValue,
        tone: 'success'
      });
      form.reset();
    } catch {
      // handled via onError
    }
  };

  const handleShareholdingSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const roleType = (formData.get('roleType') as string | null)?.trim() ?? '';
    const partyId = (formData.get('partyId') as string | null)?.trim() ?? '';
    const partyType = (formData.get('partyType') as string | null)?.trim() ?? '';
    const partyName = (formData.get('partyName') as string | null)?.trim() ?? '';

    if (!roleType || (!partyId && (!partyType || !partyName))) {
      setShareholdingError(
        t('tenants.detail.shareholdings.validation', {
          defaultValue: 'Role and either party ID or party details are required.'
        })
      );
      return;
    }

    setShareholdingError(null);

    try {
      await shareholdingMutation.mutateAsync({
        roleType,
        quotaPercent: (formData.get('quotaPercent') as string | null)?.trim() || undefined,
        einlageAmount: (formData.get('capital') as string | null)?.trim() || undefined,
        liability: (formData.get('liability') as string | null)?.trim() || undefined,
        validFrom: (formData.get('validFrom') as string | null) || undefined,
        validTo: (formData.get('validTo') as string | null) || undefined,
        ...(partyId
          ? { partyId }
          : {
              party: {
                type: partyType,
              displayName: partyName
            }
          })
      });
      const summary = partyName || partyId || roleType;
      showToast({
        title: t('tenants.toasts.shareholdingCreated', { defaultValue: 'Shareholding saved' }),
        description: summary,
        tone: 'success'
      });
      form.reset();
    } catch {
      // handled via onError
    }
  };

  const handleAttachmentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const ownerTypeRaw = (formData.get('ownerType') as string | null) ?? 'TENANT';
    const ownerType: CreateAttachmentInput['ownerType'] =
      ownerTypeRaw === 'COMPANY'
        ? 'COMPANY'
        : ownerTypeRaw === 'COMPANY_PERMIT'
        ? 'COMPANY_PERMIT'
        : 'TENANT';
    const ownerId = (formData.get('ownerId') as string | null)?.trim() ?? '';
    const attachmentType = (formData.get('attachmentType') as string | null)?.trim() ?? '';
    const fileRef = (formData.get('fileRef') as string | null)?.trim() ?? '';
    const issuedAt = (formData.get('issuedAt') as string | null)?.trim() ?? '';
    const sourceUrl = (formData.get('sourceUrl') as string | null)?.trim() ?? '';

    if (!ownerId || !attachmentType || !fileRef) {
      setAttachmentError(
        t('tenants.detail.attachments.validation', {
          defaultValue: 'Owner, attachment type and file reference are required.'
        })
      );
      return;
    }

    setAttachmentError(null);

    try {
      await attachmentMutation.mutateAsync({
        ownerType,
        ownerId,
        attachmentType,
        fileRef,
        issuedAt: issuedAt || undefined,
        sourceUrl: sourceUrl || undefined
      });
      showToast({
        title: t('tenants.toasts.attachmentCreated', { defaultValue: 'Attachment saved' }),
        description: attachmentType,
        tone: 'success'
      });
      form.reset();
    } catch {
      // handled via onError
    }
  };

  const handleOfficerSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const officerType = (formData.get('officerType') as string | null)?.trim() ?? '';
    const level = ((formData.get('level') as string | null)?.trim().toUpperCase() ||
      officerDialog?.record?.level ||
      'TENANT') as 'TENANT' | 'COMPANY';
    const companyIdRaw = (formData.get('companyId') as string | null)?.trim() ?? '';
    if (!officerType) {
      setOfficerError(
        t('tenants.detail.officers.validation', {
          defaultValue: 'Officer type is required.'
        })
      );
      return;
    }
    if (level === 'COMPANY' && !companyIdRaw) {
      setOfficerError(
        t('tenants.detail.officers.companyRequired', {
          defaultValue: 'Company is required for company-level officers.'
        })
      );
      return;
    }
    const partyIdValue = (formData.get('partyId') as string | null)?.trim() ?? '';
    const partyTypeValue = (formData.get('partyType') as string | null)?.trim() ?? '';
    const partyNameValue = (formData.get('partyName') as string | null)?.trim() ?? '';
    if (!partyIdValue && (!partyTypeValue || !partyNameValue)) {
      setOfficerError(
        t('tenants.detail.officers.validation', {
          defaultValue: 'Officer type is required.'
        })
      );
      return;
    }

    setOfficerError(null);
    try {
      const payload: CreateOfficerInput = {
        level,
        officerType,
        companyId: level === 'COMPANY' ? companyIdRaw || undefined : undefined,
        partyId: partyIdValue || undefined,
        validFrom: (formData.get('validFrom') as string | null) || undefined,
        validTo: (formData.get('validTo') as string | null) || undefined,
        party: partyIdValue
          ? undefined
          : {
              type: partyTypeValue || 'NatürlichePerson',
              displayName:
                partyNameValue ||
                t('tenants.detail.officers.unknownParty', { defaultValue: 'Unknown party' })
            }
      };

      if (officerDialog?.mode === 'edit' && officerDialog.record) {
        await updateOfficerMutation.mutateAsync({
          officerId: officerDialog.record.id,
          input: payload
        });
        const summary = partyNameValue || partyIdValue || officerDialog.record.officerType;
        showToast({
          title: t('tenants.toasts.officerUpdated', { defaultValue: 'Officer updated' }),
          description: summary,
          tone: 'success'
        });
      } else {
        await officerMutation.mutateAsync(payload);
        const summary = partyNameValue || partyIdValue || officerType;
        showToast({
          title: t('tenants.toasts.officerCreated', { defaultValue: 'Officer added' }),
          description: summary,
          tone: 'success'
        });
        form.reset();
      }
    } catch {
      // handled via onError
    }
  };

  const handleVehicleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const vehicleId = (formData.get('vehicleId') as string | null)?.trim() ?? '';
    const companyId = (formData.get('companyId') as string | null)?.trim() ?? '';
    const assignedFrom = (formData.get('assignedFrom') as string | null)?.trim() ?? '';
    if (!vehicleId || !companyId || !assignedFrom) {
      setVehicleError(
        t('tenants.detail.vehicles.validation', {
          defaultValue: 'Vehicle, company, and start date are required.'
        })
      );
      return;
    }
    setVehicleError(null);
    const payload: CreateVehicleAssignmentInput = {
      vehicleId,
      companyId,
      assignedFrom,
      assignedTo: (formData.get('assignedTo') as string | null)?.trim() || undefined,
      approvalId: (formData.get('approvalId') as string | null)?.trim() || undefined
    };
    try {
      if (vehicleDialog?.mode === 'edit' && vehicleDialog.record) {
        await updateVehicleMutation.mutateAsync({
          assignmentId: vehicleDialog.record.id,
          input: payload
        });
        showToast({
          title: t('tenants.toasts.vehicleUpdated', { defaultValue: 'Vehicle assignment updated' }),
          description: vehicleId,
          tone: 'success'
        });
      } else {
        await vehicleMutation.mutateAsync(payload);
        showToast({
          title: t('tenants.toasts.vehicleAssigned', { defaultValue: 'Vehicle assignment saved' }),
          description: vehicleId,
          tone: 'success'
        });
        form.reset();
      }
    } catch {
      // handled via onError
    }
  };

  const handleDriverSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const companyId = (formData.get('companyId') as string | null)?.trim() ?? '';
    const assignedFrom = (formData.get('assignedFrom') as string | null)?.trim() ?? '';
    const partyId = (formData.get('partyId') as string | null)?.trim() ?? '';
    const partyName = (formData.get('partyName') as string | null)?.trim() ?? '';
    const partyType = (formData.get('partyType') as string | null)?.trim() ?? '';
    if (!companyId || !assignedFrom || (!partyId && (!partyName || !partyType))) {
      setDriverError(
        t('tenants.detail.drivers.validation', {
          defaultValue: 'Company, start date, and party details are required.'
        })
      );
      return;
    }
    setDriverError(null);
    const payload: CreateDriverAssignmentInput = {
      companyId,
      assignedFrom,
      assignedTo: (formData.get('assignedTo') as string | null)?.trim() || undefined,
      approvalId: (formData.get('approvalId') as string | null)?.trim() || undefined,
      ...(partyId
        ? { partyId }
        : {
            party: {
              type: partyType,
              displayName: partyName
            }
          })
    };
    try {
      if (driverDialog?.mode === 'edit' && driverDialog.record) {
        await updateDriverMutation.mutateAsync({
          assignmentId: driverDialog.record.id,
          input: payload
        });
        const summary = partyName || partyId || companyId;
        showToast({
          title: t('tenants.toasts.driverUpdated', { defaultValue: 'Driver assignment updated' }),
          description: summary,
          tone: 'success'
        });
      } else {
        await driverMutation.mutateAsync(payload);
        const summary = partyName || partyId || companyId;
        showToast({
          title: t('tenants.toasts.driverAssigned', { defaultValue: 'Driver assignment saved' }),
          description: summary,
          tone: 'success'
        });
        form.reset();
      }
    } catch {
      // handled via onError
    }
  };

  const handleApprovalSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const scope = (formData.get('scope') as string | null)?.trim() ?? '';
    const op = (formData.get('op') as string | null)?.trim() ?? '';
    const objectId = (formData.get('objectId') as string | null)?.trim() ?? '';
    const idempotencyKey = (formData.get('idempotencyKey') as string | null)?.trim() ?? '';
    const payloadRaw = (formData.get('payload') as string | null)?.trim() ?? '';

    if (!scope || !op) {
      setApprovalError(
        t('tenants.detail.approvals.validation', {
          defaultValue: 'Scope and operation are required.'
        })
      );
      return;
    }

    let payloadValue: CreateApprovalInput['payload'];
    if (payloadRaw) {
      const trimmedPayload = payloadRaw.trim();
      if (trimmedPayload.startsWith('{') || trimmedPayload.startsWith('[')) {
        try {
          payloadValue = JSON.parse(trimmedPayload);
        } catch {
          setApprovalError(
            t('tenants.detail.approvals.invalidPayload', {
              defaultValue: 'Payload must be valid JSON.'
            })
          );
          return;
        }
      } else {
        payloadValue = trimmedPayload;
      }
    }

    setApprovalError(null);

    try {
      const input: CreateApprovalInput = {
        scope,
        op,
        objectId: objectId || undefined,
        idempotencyKey: idempotencyKey || undefined
      };
      if (payloadValue !== undefined) {
        input.payload = payloadValue;
      }
      await approvalMutation.mutateAsync(input);
      showToast({
        title: t('tenants.toasts.approvalCreated', { defaultValue: 'Approval submitted' }),
        description: scope,
        tone: 'success'
      });
      form.reset();
    } catch {
      // handled via onError
    }
  };

  const handleOfficerDelete = async () => {
    if (!selectedTenantId || !officerDeleteTarget) return;
    try {
      await deleteOfficerMutation.mutateAsync({ officerId: officerDeleteTarget.id });
      const summary =
        officerDeleteTarget.party?.displayName ??
        officerDeleteTarget.partyId ??
        officerDeleteTarget.officerType;
      showToast({
        title: t('tenants.toasts.officerDeleted', { defaultValue: 'Officer removed' }),
        description: summary,
        tone: 'success'
      });
    } catch {
      // handled in onError
    }
  };

  const handleVehicleDelete = async () => {
    if (!selectedTenantId || !vehicleDeleteTarget) return;
    try {
      await deleteVehicleMutation.mutateAsync({ assignmentId: vehicleDeleteTarget.id });
      showToast({
        title: t('tenants.toasts.vehicleDeleted', { defaultValue: 'Vehicle assignment removed' }),
        description: vehicleDeleteTarget.vehicleId,
        tone: 'success'
      });
    } catch {
      // handled in onError
    }
  };

  const handleDriverDelete = async () => {
    if (!selectedTenantId || !driverDeleteTarget) return;
    try {
      await deleteDriverMutation.mutateAsync({ assignmentId: driverDeleteTarget.id });
      const summary =
        driverDeleteTarget.party?.displayName ??
        driverDeleteTarget.partyId ??
        driverDeleteTarget.companyId;
      showToast({
        title: t('tenants.toasts.driverDeleted', { defaultValue: 'Driver assignment removed' }),
        description: summary,
        tone: 'success'
      });
    } catch {
      // handled in onError
    }
  };

  const handleAttachmentDelete = async () => {
    if (!selectedTenantId || !attachmentDeleteTarget) return;
    const summary = attachmentDeleteTarget.fileRef || attachmentDeleteTarget.attachmentType;
    try {
      await deleteAttachmentMutation.mutateAsync({ attachmentId: attachmentDeleteTarget.id });
      showToast({
        title: t('tenants.toasts.attachmentDeleted', { defaultValue: 'Attachment removed' }),
        description: summary,
        tone: 'success'
      });
    } catch {
      // handled in onError
    }
  };

  const handleApprovalDelete = async () => {
    if (!selectedTenantId || !approvalDeleteTarget) return;
    const summary = `${approvalDeleteTarget.op} · ${approvalDeleteTarget.scope}`;
    try {
      await deleteApprovalMutation.mutateAsync({ approvalId: approvalDeleteTarget.id });
      showToast({
        title: t('tenants.toasts.approvalDeleted', { defaultValue: 'Approval removed' }),
        description: summary,
        tone: 'success'
      });
    } catch {
      // handled in onError
    }
  };

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

  return (
    <>
      <CrudLayout
      title={t('tenants.page.title', { defaultValue: 'Tenants' })}
      subtitle={t('tenants.page.subtitle', {
        defaultValue: 'Search and inspect tenant records from the identity service.'
      })}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCreateTenantDialogOpen(true);
              setCreateTenantError(null);
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
        </div>
      }
      filterBar={
        <InlineFilterBar
          filters={
            <>
              <div className="relative flex-1 min-w-[240px]">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchInput}
                  onChange={event => {
                    setSearchInput(event.target.value);
                  }}
                  placeholder={t('tenants.filters.search', { defaultValue: 'Search tenants…' })}
                  className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {STATUS_FILTERS.map(option => {
                  const isActive = status === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setStatus(option.value);
                        setPage(0);
                      }}
                      className={cx(
                        'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500',
                        isActive
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                      )}
                    >
                      {statusOptions.find(opt => opt.value === option.value)?.label ?? option.value}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sort ?? 'name'}
                  onChange={event => {
                    const next = (event.target.value as TenantListParams['sort']) || 'name';
                    setSort(next);
                    setPage(0);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {sortOptions.map(option => (
                    <option key={option.value ?? 'name'} value={option.value ?? 'name'}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    setPage(0);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label={t('tenants.filters.toggleOrder', { defaultValue: 'Toggle sort order' })}
                >
                  <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
                  {order === 'asc'
                    ? t('tenants.filters.order.asc', { defaultValue: 'Ascending' })
                    : t('tenants.filters.order.desc', { defaultValue: 'Descending' })}
                </button>
              </div>
            </>
          }
        />
      }
      detail={
        <DetailPanel
          title={
            selectedTenant
              ? selectedTenant.legalName
              : t('tenants.detail.placeholder.title', { defaultValue: 'Select a tenant' })
          }
          subtitle={
            selectedTenant
              ? selectedTenant.tenantId
              : t('tenants.detail.placeholder.subtitle', {
                  defaultValue: 'Choose a tenant from the list to view details.'
                })
          }
          stickyHeader
        >
          {selectedTenant ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t('tenants.detail.section.general', { defaultValue: 'General' })}
                </h3>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t('tenants.detail.labels.status', { defaultValue: 'Status' })}
                    </dt>
                    <dd>
                      <TenantStatusBadge status={selectedTenant.status} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t('tenants.detail.labels.tenantId', { defaultValue: 'Tenant ID' })}
                    </dt>
                    <dd className="font-mono text-sm text-slate-700 dark:text-slate-200">
                      {selectedTenant.tenantId}
                    </dd>
                  </div>
                  {selectedTenant.legalForm ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t('tenants.detail.labels.legalForm', { defaultValue: 'Legal form' })}
                      </dt>
                      <dd className="text-sm text-slate-700 dark:text-slate-200">
                        {selectedTenant.legalForm}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t('tenants.detail.labels.seatAddress', { defaultValue: 'Seat address' })}
                    </dt>
                    <dd className="text-sm text-slate-700 dark:text-slate-200">
                      {selectedTenant.seatAddress ??
                        selectedTenant.currentIdentity?.seatAddress ??
                        '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t('tenants.detail.labels.primaryIdentifier', {
                        defaultValue: 'Primary identifier'
                      })}
                    </dt>
                    <dd className="text-sm text-slate-700 dark:text-slate-200">
                      {selectedTenant.primaryIdentifier ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-mono">
                            {selectedTenant.primaryIdentifier.idValue}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {selectedTenant.primaryIdentifier.idType}
                          </span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t('tenants.detail.section.identityHistory', { defaultValue: 'Identity history' })}
                </h3>
                {identityHistory.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {t('tenants.detail.identity.loading', { defaultValue: 'Loading history…' })}
                  </div>
                ) : identityItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {t('tenants.detail.identity.empty', { defaultValue: 'No historical identities recorded.' })}
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {identityItems.map(identity => (
                      <li
                        key={identity.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {identity.legalName ?? selectedTenant.legalName}
                            </p>
                            {identity.legalForm ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {identity.legalForm}
                              </p>
                            ) : null}
                          </div>
                          {identity.currentFlag ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                              {t('tenants.detail.identity.current', { defaultValue: 'Current' })}
                            </span>
                          ) : null}
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.identity.identifier', {
                                defaultValue: 'Identifier'
                              })}
                            </dt>
                            <dd className="font-mono text-sm text-slate-700 dark:text-slate-200">
                              {identity.idValue ?? '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.identity.validFrom', {
                                defaultValue: 'Valid from'
                              })}
                            </dt>
                            <dd>{formatDate(identity.validFrom)}</dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.identity.validTo', { defaultValue: 'Valid to' })}
                            </dt>
                            <dd>{formatDate(identity.validTo)}</dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t('tenants.detail.section.identifiers', { defaultValue: 'Identifiers' })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentityError(null);
                      setIdentityDialogOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t('tenants.detail.identifiers.add', { defaultValue: 'Add identifier' })}
                  </button>
                </div>
                {identifiers.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {t('tenants.detail.identifiers.loading', { defaultValue: 'Loading identifiers…' })}
                  </div>
                ) : identifierItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {t('tenants.detail.identifiers.empty', { defaultValue: 'No identifiers registered yet.' })}
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {identifierItems.map(identifier => (
                      <li
                        key={identifier.id}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono">{identifier.idValue}</span>
                          <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {identifier.idType}
                          </span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.identifiers.country', { defaultValue: 'Country' })}
                            </dt>
                            <dd>{identifier.countryCode ?? '—'}</dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.identity.validFrom', { defaultValue: 'Valid from' })}
                            </dt>
                            <dd>{formatDate(identifier.validFrom)}</dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.identity.validTo', { defaultValue: 'Valid to' })}
                            </dt>
                            <dd>{formatDate(identifier.validTo)}</dd>
                          </div>
                        </dl>
                        {identifier.primaryFlag ? (
                          <span className="mt-2 inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                            {t('tenants.detail.identifiers.primary', { defaultValue: 'Primary' })}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t('tenants.detail.section.attachments', { defaultValue: 'Attachments' })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentError(null);
                      setAttachmentDialogOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t('tenants.detail.attachments.add', { defaultValue: 'Add attachment' })}
                  </button>
                </div>
                {attachments.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {t('tenants.detail.attachments.loading', { defaultValue: 'Loading attachments…' })}
                  </div>
                ) : attachmentItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {t('tenants.detail.attachments.empty', { defaultValue: 'No attachments uploaded.' })}
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {attachmentItems.map(attachment => (
                      <li
                        key={attachment.id}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <div>
                            <p className="font-medium">{attachment.attachmentType}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {t('tenants.detail.attachments.fileRef', { defaultValue: 'File' })}:{' '}
                              <span className="font-mono text-[13px] text-slate-600 dark:text-slate-300">
                                {attachment.fileRef}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 sm:justify-end">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {formatDate(attachment.issuedAt)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setAttachmentDeleteTarget(attachment);
                              }}
                              className="text-xs font-semibold text-rose-500 hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:text-rose-300 dark:hover:text-rose-200"
                            >
                              {t('tenants.detail.actions.remove', { defaultValue: 'Remove' })}
                            </button>
                          </div>
                        </div>
                        <dl className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.attachments.owner', { defaultValue: 'Owner' })}
                            </dt>
                            <dd>
                              <span className="font-medium">{attachment.ownerType}</span>
                              <span className="block font-mono text-[13px] text-slate-600 dark:text-slate-300">
                                {attachment.ownerId}
                              </span>
                            </dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.attachments.source', { defaultValue: 'Source' })}
                            </dt>
                            <dd>{attachment.sourceUrl ?? '—'}</dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.attachments.createdAt', { defaultValue: 'Uploaded' })}
                            </dt>
                            <dd>{formatDate(attachment.createdAt)}</dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t('tenants.detail.section.shareholdings', { defaultValue: 'Shareholdings' })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShareholdingError(null);
                      setShareholdingDialogOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t('tenants.detail.shareholdings.add', { defaultValue: 'Add shareholding' })}
                  </button>
                </div>
                {shareholdings.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {t('tenants.detail.shareholdings.loading', { defaultValue: 'Loading shareholdings…' })}
                  </div>
                ) : shareholdingItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {t('tenants.detail.shareholdings.empty', { defaultValue: 'No shareholdings recorded.' })}
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {shareholdingItems.map(item => (
                      <li
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {item.party?.displayName ?? item.partyId ?? t('tenants.detail.shareholdings.unknownParty', { defaultValue: 'Unknown party' })}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {item.roleType}
                            </p>
                          </div>
                          {item.quotaPercent ? (
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                              {item.quotaPercent}%
                            </span>
                          ) : null}
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.shareholdings.liability', { defaultValue: 'Liability' })}
                            </dt>
                            <dd>{item.liability ?? '—'}</dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.identity.validFrom', { defaultValue: 'Valid from' })}
                            </dt>
                            <dd>{formatDate(item.validFrom)}</dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.identity.validTo', { defaultValue: 'Valid to' })}
                            </dt>
                            <dd>{formatDate(item.validTo)}</dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t('tenants.detail.section.approvals', { defaultValue: 'Approvals' })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setApprovalError(null);
                      setApprovalDialogOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t('tenants.detail.approvals.add', { defaultValue: 'Add approval' })}
                  </button>
                </div>
                {approvals.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {t('tenants.detail.approvals.loading', { defaultValue: 'Loading approvals…' })}
                  </div>
                ) : approvalItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {t('tenants.detail.approvals.empty', { defaultValue: 'No pending approvals.' })}
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {approvalItems.map(approval => (
                      <li
                        key={approval.id}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{approval.op}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {approval.scope}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                              {approval.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setApprovalDeleteTarget(approval);
                              }}
                              className="text-xs font-semibold text-rose-500 hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:text-rose-300 dark:hover:text-rose-200"
                            >
                              {t('tenants.detail.actions.remove', { defaultValue: 'Remove' })}
                            </button>
                          </div>
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.approvals.object', { defaultValue: 'Object' })}
                            </dt>
                            <dd>{approval.objectId ?? '—'}</dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.approvals.createdAt', { defaultValue: 'Requested at' })}
                            </dt>
                            <dd>{formatDate(approval.createdAt)}</dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-wide">
                              {t('tenants.detail.approvals.idempotency', { defaultValue: 'Idempotency key' })}
                            </dt>
                            <dd>{approval.idempotencyKey ?? '—'}</dd>
                          </div>
                        </dl>
                        {typeof approval.payload !== 'undefined' && approval.payload !== null ? (
                          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                            <div className="mb-1 font-semibold uppercase tracking-wide">
                              {t('tenants.detail.approvals.payload', { defaultValue: 'Payload' })}
                            </div>
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                              {typeof approval.payload === 'string'
                                ? approval.payload
                                : JSON.stringify(approval.payload, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t('tenants.detail.placeholder.body', {
                defaultValue: 'Select a tenant from the list to view identity details, identifiers and assignments.'
              })}
            </div>
          )}
      </DetailPanel>
    }
  >
      <div className="relative">
        {listQuery.isFetching ? (
          <div className="pointer-events-none absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-100/10 dark:text-slate-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t('tenants.actions.refreshing', { defaultValue: 'Refreshing…' })}
          </div>
        ) : null}
        {errorBanner ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {errorBanner}
          </div>
        ) : null}
        <DataGrid
          table={table}
          height={520}
          isLoading={listQuery.isLoading}
          virtualizationThreshold={400}
          emptyMessage={
            query || status !== 'all'
              ? t('tenants.table.emptyFiltered', { defaultValue: 'No tenants match the current filters.' })
              : t('tenants.table.empty', { defaultValue: 'No tenants found.' })
          }
          tableClassName="min-w-full table-fixed divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800"
          getRowProps={row => {
            const record = row.original;
            const isSelected = record.tenantId === selectedTenantId;
            return {
              onClick: () => {
                setSelectedTenantId(record.tenantId);
              },
              onKeyDown: event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedTenantId(record.tenantId);
                }
              },
              tabIndex: 0,
              role: 'button',
              className: cx(
                'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500',
                isSelected
                  ? 'bg-slate-900/5 dark:bg-slate-100/10'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
              )
            };
          }}
        />
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
    </CrudLayout>

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
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
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
              {t('tenants.detail.create.dialog.legalForm', { defaultValue: 'Legal form (optional)' })}
            </span>
            <input
              name="legalForm"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.create.dialog.seatAddress', {
                defaultValue: 'Registered address (optional)'
              })}
            </span>
            <input
              name="seatAddress"
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

      <FormDialog
        isOpen={isIdentityDialogOpen && Boolean(selectedTenantId)}
        onClose={() => {
          setIdentityDialogOpen(false);
          setIdentityError(null);
        }}
        title={t('tenants.detail.identifiers.dialog.title', { defaultValue: 'Add identifier' })}
        description={t('tenants.detail.identifiers.dialog.description', {
          defaultValue: 'Create a new identifier for the selected tenant.'
        })}
        submitLabel={identityMutation.isPending ? t('tenants.detail.identifiers.dialog.saving', { defaultValue: 'Saving…' }) : t('tenants.detail.identifiers.dialog.submit', { defaultValue: 'Save identifier' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        disableSubmit={!selectedTenantId}
        isSubmitting={identityMutation.isPending}
        onSubmit={handleIdentifierSubmit}
      >
        {identityError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {identityError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.identifiers.dialog.type', { defaultValue: 'Identifier type' })}
            </span>
            <input
              name="idType"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.identifiers.dialog.value', { defaultValue: 'Identifier value' })}
            </span>
            <input
              name="idValue"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.identifiers.dialog.country', { defaultValue: 'Country (ISO)' })}
            </span>
            <input
              name="countryCode"
              maxLength={2}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm uppercase text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.identifiers.dialog.target', { defaultValue: 'Target' })}
            </span>
            <input
              name="target"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.identifiers.dialog.validFrom', { defaultValue: 'Valid from' })}
            </span>
            <input
              type="date"
              name="validFrom"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.identifiers.dialog.validTo', { defaultValue: 'Valid to' })}
            </span>
            <input
              type="date"
              name="validTo"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            name="primaryFlag"
            className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-800"
          />
          {t('tenants.detail.identifiers.dialog.primary', { defaultValue: 'Mark as primary' })}
        </label>
      </FormDialog>

      <FormDialog
        isOpen={Boolean(officerDialog) && Boolean(selectedTenantId)}
        onClose={() => {
          setOfficerDialog(null);
          setOfficerError(null);
        }}
        title={
          officerDialog?.mode === 'edit'
            ? t('tenants.detail.officers.dialog.editTitle', { defaultValue: 'Edit officer' })
            : t('tenants.detail.officers.dialog.title', { defaultValue: 'Add officer' })
        }
        description={t('tenants.detail.officers.dialog.description', {
          defaultValue: 'Record an officer for the selected tenant.'
        })}
        submitLabel={
          officerFormBusy
            ? t('tenants.detail.dialog.saving', { defaultValue: 'Saving…' })
            : officerDialog?.mode === 'edit'
            ? t('tenants.detail.officers.dialog.update', { defaultValue: 'Save changes' })
            : t('tenants.detail.officers.dialog.submit', { defaultValue: 'Save officer' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        disableSubmit={!selectedTenantId}
        isSubmitting={officerFormBusy}
        onSubmit={handleOfficerSubmit}
      >
        {officerError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {officerError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.officers.dialog.level', { defaultValue: 'Level' })}
            </span>
            <select
              name="level"
              defaultValue={editingOfficer?.level ?? 'TENANT'}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="TENANT">{t('tenants.detail.officers.level.tenant', { defaultValue: 'Tenant' })}</option>
              <option value="COMPANY">
                {t('tenants.detail.officers.level.company', { defaultValue: 'Company' })}
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.officers.dialog.company', { defaultValue: 'Company ID (required for company level)' })}
            </span>
            <input
              name="companyId"
              defaultValue={editingOfficer?.companyId ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.officers.dialog.officerType', { defaultValue: 'Officer type' })}
            </span>
            <input
              name="officerType"
              required
              defaultValue={editingOfficer?.officerType ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.officers.dialog.partyId', { defaultValue: 'Party ID (optional)' })}
            </span>
            <input
              name="partyId"
              defaultValue={editingOfficer?.partyId ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.officers.dialog.partyType', { defaultValue: 'Party type' })}
            </span>
            <input
              name="partyType"
              defaultValue={editingOfficer?.party?.type ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.officers.dialog.partyName', { defaultValue: 'Party name' })}
            </span>
            <input
              name="partyName"
              defaultValue={editingOfficer?.party?.displayName ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.identity.validFrom', { defaultValue: 'Valid from' })}
            </span>
            <input
              type="date"
              name="validFrom"
              defaultValue={toInputDate(editingOfficer?.validFrom)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.identity.validTo', { defaultValue: 'Valid to' })}
            </span>
            <input
              type="date"
              name="validTo"
              defaultValue={toInputDate(editingOfficer?.validTo)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </FormDialog>

      <FormDialog
        isOpen={Boolean(vehicleDialog) && Boolean(selectedTenantId)}
        onClose={() => {
          setVehicleDialog(null);
          setVehicleError(null);
        }}
        title={
          vehicleDialog?.mode === 'edit'
            ? t('tenants.detail.vehicles.dialog.editTitle', { defaultValue: 'Edit vehicle assignment' })
            : t('tenants.detail.vehicles.dialog.title', { defaultValue: 'Assign vehicle' })
        }
        description={t('tenants.detail.vehicles.dialog.description', {
          defaultValue: 'Assign a vehicle to the selected tenant.'
        })}
        submitLabel={
          vehicleFormBusy
            ? t('tenants.detail.dialog.saving', { defaultValue: 'Saving…' })
            : vehicleDialog?.mode === 'edit'
            ? t('tenants.detail.vehicles.dialog.update', { defaultValue: 'Save changes' })
            : t('tenants.detail.vehicles.dialog.submit', { defaultValue: 'Save assignment' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        disableSubmit={!selectedTenantId}
        isSubmitting={vehicleFormBusy}
        onSubmit={handleVehicleSubmit}
      >
        {vehicleError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {vehicleError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.vehicles.dialog.vehicle', { defaultValue: 'Vehicle ID' })}
            </span>
            <input
              name="vehicleId"
              required
              defaultValue={editingVehicle?.vehicleId ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.vehicles.dialog.company', { defaultValue: 'Company ID' })}
            </span>
            <input
              name="companyId"
              required
              defaultValue={editingVehicle?.companyId ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.vehicles.dialog.start', { defaultValue: 'Assigned from' })}
            </span>
            <input
              type="date"
              name="assignedFrom"
              required
              defaultValue={toInputDate(editingVehicle?.assignedFrom)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.vehicles.dialog.end', { defaultValue: 'Assigned to (optional)' })}
            </span>
            <input
              type="date"
              name="assignedTo"
              defaultValue={toInputDate(editingVehicle?.assignedTo)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.vehicles.dialog.approval', { defaultValue: 'Approval (optional)' })}
            </span>
            <input
              name="approvalId"
              defaultValue={editingVehicle?.approvalId ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </FormDialog>

      <FormDialog
        isOpen={Boolean(driverDialog) && Boolean(selectedTenantId)}
        onClose={() => {
          setDriverDialog(null);
          setDriverError(null);
        }}
        title={
          driverDialog?.mode === 'edit'
            ? t('tenants.detail.drivers.dialog.editTitle', { defaultValue: 'Edit driver assignment' })
            : t('tenants.detail.drivers.dialog.title', { defaultValue: 'Assign driver' })
        }
        description={t('tenants.detail.drivers.dialog.description', {
          defaultValue: 'Assign a driver to the selected tenant.'
        })}
        submitLabel={
          driverFormBusy
            ? t('tenants.detail.dialog.saving', { defaultValue: 'Saving…' })
            : driverDialog?.mode === 'edit'
            ? t('tenants.detail.drivers.dialog.update', { defaultValue: 'Save changes' })
            : t('tenants.detail.drivers.dialog.submit', { defaultValue: 'Save assignment' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        disableSubmit={!selectedTenantId}
        isSubmitting={driverFormBusy}
        onSubmit={handleDriverSubmit}
      >
        {driverError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {driverError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.drivers.dialog.company', { defaultValue: 'Company ID' })}
            </span>
            <input
              name="companyId"
              required
              defaultValue={editingDriver?.companyId ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.drivers.dialog.start', { defaultValue: 'Assigned from' })}
            </span>
            <input
              type="date"
              name="assignedFrom"
              required
              defaultValue={toInputDate(editingDriver?.assignedFrom)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.drivers.dialog.end', { defaultValue: 'Assigned to (optional)' })}
            </span>
            <input
              type="date"
              name="assignedTo"
              defaultValue={toInputDate(editingDriver?.assignedTo)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.drivers.dialog.approval', { defaultValue: 'Approval (optional)' })}
            </span>
            <input
              name="approvalId"
              defaultValue={editingDriver?.approvalId ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.drivers.dialog.partyId', { defaultValue: 'Party ID (optional)' })}
            </span>
            <input
              name="partyId"
              defaultValue={editingDriver?.partyId ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.drivers.dialog.partyType', { defaultValue: 'Party type' })}
            </span>
            <input
              name="partyType"
              defaultValue={editingDriver?.party?.type ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.drivers.dialog.partyName', { defaultValue: 'Party name' })}
            </span>
            <input
              name="partyName"
              defaultValue={editingDriver?.party?.displayName ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </FormDialog>

      <ConfirmDialog
        isOpen={Boolean(attachmentDeleteTarget)}
        title={t('tenants.detail.attachments.deleteTitle', { defaultValue: 'Remove attachment' })}
        description={
          attachmentDeleteTarget
            ? t('tenants.detail.attachments.deleteDescription', {
                defaultValue: 'This will remove {{type}} from the attachment list.',
                values: { type: attachmentDeleteTarget.attachmentType }
              })
            : undefined
        }
        confirmLabel={t('tenants.detail.actions.confirmRemove', { defaultValue: 'Remove' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        loading={deleteAttachmentMutation.isPending}
        onConfirm={() => {
          void handleAttachmentDelete();
        }}
        onCancel={() => setAttachmentDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(officerDeleteTarget)}
        title={t('tenants.detail.officers.deleteTitle', { defaultValue: 'Remove officer' })}
        description={
          officerDeleteTarget
            ? t('tenants.detail.officers.deleteDescription', {
                defaultValue: 'This will remove {{name}} from the officer list.',
                values: {
                  name:
                    officerDeleteTarget.party?.displayName ??
                    officerDeleteTarget.partyId ??
                    officerDeleteTarget.officerType
                }
              })
            : undefined
        }
        confirmLabel={t('tenants.detail.actions.confirmRemove', { defaultValue: 'Remove' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        loading={deleteOfficerMutation.isPending}
        onConfirm={() => {
          void handleOfficerDelete();
        }}
        onCancel={() => setOfficerDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(vehicleDeleteTarget)}
        title={t('tenants.detail.vehicles.deleteTitle', { defaultValue: 'Remove vehicle assignment' })}
        description={
          vehicleDeleteTarget
            ? t('tenants.detail.vehicles.deleteDescription', {
                defaultValue: 'This will remove vehicle {{vehicleId}} from this tenant.',
                values: { vehicleId: vehicleDeleteTarget.vehicleId }
              })
            : undefined
        }
        confirmLabel={t('tenants.detail.actions.confirmRemove', { defaultValue: 'Remove' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        loading={deleteVehicleMutation.isPending}
        onConfirm={() => {
          void handleVehicleDelete();
        }}
        onCancel={() => setVehicleDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(driverDeleteTarget)}
        title={t('tenants.detail.drivers.deleteTitle', { defaultValue: 'Remove driver assignment' })}
        description={
          driverDeleteTarget
            ? t('tenants.detail.drivers.deleteDescription', {
                defaultValue: 'This will remove {{name}} from this tenant.',
                values: {
                  name:
                    driverDeleteTarget.party?.displayName ??
                    driverDeleteTarget.partyId ??
                    driverDeleteTarget.companyId
                }
              })
            : undefined
        }
        confirmLabel={t('tenants.detail.actions.confirmRemove', { defaultValue: 'Remove' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        loading={deleteDriverMutation.isPending}
        onConfirm={() => {
          void handleDriverDelete();
        }}
        onCancel={() => setDriverDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(approvalDeleteTarget)}
        title={t('tenants.detail.approvals.deleteTitle', { defaultValue: 'Remove approval' })}
        description={
          approvalDeleteTarget
            ? t('tenants.detail.approvals.deleteDescription', {
                defaultValue: 'This will remove {{scope}} approval.',
                values: {
                  scope: approvalDeleteTarget.scope
                }
              })
            : undefined
        }
        confirmLabel={t('tenants.detail.actions.confirmRemove', { defaultValue: 'Remove' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        loading={deleteApprovalMutation.isPending}
        onConfirm={() => {
          void handleApprovalDelete();
        }}
        onCancel={() => setApprovalDeleteTarget(null)}
      />
      <FormDialog
        isOpen={isAttachmentDialogOpen && Boolean(selectedTenantId)}
        onClose={() => {
          setAttachmentDialogOpen(false);
          setAttachmentError(null);
        }}
        title={t('tenants.detail.attachments.dialog.title', { defaultValue: 'Add attachment' })}
        description={t('tenants.detail.attachments.dialog.description', {
          defaultValue: 'Link or upload documentation for the selected tenant.'
        })}
        submitLabel={
          attachmentMutation.isPending
            ? t('tenants.detail.attachments.dialog.saving', { defaultValue: 'Saving…' })
            : t('tenants.detail.attachments.dialog.submit', { defaultValue: 'Save attachment' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        disableSubmit={!selectedTenantId}
        isSubmitting={attachmentMutation.isPending}
        onSubmit={handleAttachmentSubmit}
      >
        {attachmentError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {attachmentError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.attachments.dialog.ownerType', { defaultValue: 'Owner type' })}
            </span>
            <select
              name="ownerType"
              defaultValue="TENANT"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="TENANT">
                {t('tenants.detail.attachments.ownerType.tenant', { defaultValue: 'Tenant' })}
              </option>
              <option value="COMPANY">
                {t('tenants.detail.attachments.ownerType.company', { defaultValue: 'Company' })}
              </option>
              <option value="COMPANY_PERMIT">
                {t('tenants.detail.attachments.ownerType.permit', { defaultValue: 'Company permit' })}
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.attachments.dialog.ownerId', { defaultValue: 'Owner ID' })}
            </span>
            <input
              name="ownerId"
              required
              defaultValue={selectedTenantId ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.attachments.dialog.type', { defaultValue: 'Attachment type' })}
            </span>
            <input
              name="attachmentType"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.attachments.dialog.fileRef', { defaultValue: 'File reference' })}
            </span>
            <input
              name="fileRef"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.attachments.dialog.issuedAt', { defaultValue: 'Issued at (optional)' })}
            </span>
            <input
              type="date"
              name="issuedAt"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.attachments.dialog.sourceUrl', { defaultValue: 'Source URL (optional)' })}
            </span>
            <input
              type="url"
              name="sourceUrl"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </FormDialog>

      <FormDialog
        isOpen={isApprovalDialogOpen && Boolean(selectedTenantId)}
        onClose={() => {
          setApprovalDialogOpen(false);
          setApprovalError(null);
        }}
        title={t('tenants.detail.approvals.dialog.title', { defaultValue: 'Submit approval' })}
        description={t('tenants.detail.approvals.dialog.description', {
          defaultValue: 'Create a manual approval request for the selected tenant.'
        })}
        submitLabel={
          approvalMutation.isPending
            ? t('tenants.detail.approvals.dialog.saving', { defaultValue: 'Saving…' })
            : t('tenants.detail.approvals.dialog.submit', { defaultValue: 'Save approval' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        disableSubmit={!selectedTenantId}
        isSubmitting={approvalMutation.isPending}
        onSubmit={handleApprovalSubmit}
        size="lg"
      >
        {approvalError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {approvalError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.approvals.dialog.scope', { defaultValue: 'Scope' })}
            </span>
            <input
              name="scope"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.approvals.dialog.op', { defaultValue: 'Operation' })}
            </span>
            <input
              name="op"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.approvals.dialog.objectId', { defaultValue: 'Object ID (optional)' })}
            </span>
            <input
              name="objectId"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.approvals.dialog.idempotencyKey', { defaultValue: 'Idempotency key (optional)' })}
            </span>
            <input
              name="idempotencyKey"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {t('tenants.detail.approvals.dialog.payload', { defaultValue: 'Payload (optional)' })}
          </span>
          <textarea
            name="payload"
            rows={4}
            spellCheck={false}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('tenants.detail.approvals.dialog.payloadHelp', {
              defaultValue: 'Provide valid JSON for structured payloads or leave blank.'
            })}
          </span>
        </label>
      </FormDialog>

      <FormDialog
        isOpen={isShareholdingDialogOpen && Boolean(selectedTenantId)}
        onClose={() => {
          setShareholdingDialogOpen(false);
          setShareholdingError(null);
        }}
        title={t('tenants.detail.shareholdings.dialog.title', { defaultValue: 'Add shareholding' })}
        description={t('tenants.detail.shareholdings.dialog.description', {
          defaultValue: 'Record a shareholder relationship for the selected tenant.'
        })}
        submitLabel={shareholdingMutation.isPending ? t('tenants.detail.shareholdings.dialog.saving', { defaultValue: 'Saving…' }) : t('tenants.detail.shareholdings.dialog.submit', { defaultValue: 'Save shareholding' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        disableSubmit={!selectedTenantId}
        isSubmitting={shareholdingMutation.isPending}
        onSubmit={handleShareholdingSubmit}
      >
        {shareholdingError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
            {shareholdingError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.shareholdings.dialog.role', { defaultValue: 'Role type' })}
            </span>
            <input
              name="roleType"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.shareholdings.dialog.partyId', { defaultValue: 'Party ID (optional)' })}
            </span>
            <input
              name="partyId"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.shareholdings.dialog.partyType', { defaultValue: 'Party type' })}
            </span>
            <input
              name="partyType"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.shareholdings.dialog.partyName', { defaultValue: 'Party name' })}
            </span>
            <input
              name="partyName"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.shareholdings.dialog.quota', { defaultValue: 'Quota %' })}
            </span>
            <input
              name="quotaPercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.shareholdings.dialog.capital', { defaultValue: 'Capital' })}
            </span>
            <input
              name="capital"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.shareholdings.dialog.liability', { defaultValue: 'Liability' })}
            </span>
            <input
              name="liability"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.identity.validFrom', { defaultValue: 'Valid from' })}
            </span>
            <input
              type="date"
              name="validFrom"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.identity.validTo', { defaultValue: 'Valid to' })}
            </span>
            <input
              type="date"
              name="validTo"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </FormDialog>
    </>
  );
};

export default TenantsPage;
