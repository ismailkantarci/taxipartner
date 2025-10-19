import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../lib/i18n';
import {
  useAssignTenantUser,
  useCreateAttachment,
  useCreateDriverAssignment,
  useCreateOfficer,
  useCreateShareholding,
  useCreateTenantApproval,
  useCreateTenantIdentity,
  useCreateVehicleAssignment,
  useDeleteAttachment,
  useDeleteDriverAssignment,
  useDeleteOfficer,
  useDeleteTenantApproval,
  useDeleteVehicleAssignment,
  useTenantApprovals,
  useTenantAttachments,
  useTenantDriverAssignments,
  useTenantIdentityHistory,
  useTenantIdentifiers,
  useTenantOfficers,
  useTenantShareholdings,
  useTenantVehicleAssignments,
  useTenantsQuery,
  useUpdateDriverAssignment,
  useUpdateOfficer,
  useUpdateVehicleAssignment,
  tenantKeys
} from '../../api/tenants';
import type {
  AssignTenantUserInput,
  AttachmentItem,
  CreateApprovalInput,
  CreateAttachmentInput,
  CreateDriverAssignmentInput,
  CreateOfficerInput,
  CreateShareholdingInput,
  CreateVehicleAssignmentInput,
  DriverAssignmentItem,
  OfficerItem,
  ShareholdingItem,
  TenantApprovalItem,
  TenantIdentifierItem,
  TenantIdentityItem,
  TenantItem,
  TenantListParams,
  VehicleAssignmentItem
} from '../../api/tenants/types';
import { FormDialog } from '../common';
import ConfirmDialog from '../../components/overlay/ConfirmDialog';
import { useToast } from '../../components/feedback/ToastProvider';
import TenantStatusBadge from './components/TenantStatusBadge';

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

type EditDialogState<T> = { mode: 'create' | 'edit'; record?: T } | null;

const TenantDetailPage: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const stateTenant = (location.state as { tenant?: TenantItem } | undefined)?.tenant;
  const [tenantOverview, setTenantOverview] = useState<TenantItem | null>(
    stateTenant && stateTenant.tenantId === tenantId ? stateTenant : null
  );

  const fallbackParams = useMemo<TenantListParams>(
    () => ({
      query: tenantId ?? '',
      status: undefined,
      sort: 'tenantid',
      order: 'asc',
      page: 0,
      pageSize: 1
    }),
    [tenantId]
  );

  const fallbackQuery = useTenantsQuery(fallbackParams, {
    enabled: Boolean(tenantId),
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    if (stateTenant && stateTenant.tenantId === tenantId) {
      setTenantOverview(stateTenant);
    }
  }, [stateTenant, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const match = fallbackQuery.data?.items?.find(item => item.tenantId === tenantId);
    if (match) {
      setTenantOverview(match);
    }
  }, [fallbackQuery.data, tenantId]);

  const tenantMissing = Boolean(tenantId) && !tenantOverview && !fallbackQuery.isLoading;

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
  const [isAssignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [assignUserError, setAssignUserError] = useState<string | null>(null);

  const identityHistory = useTenantIdentityHistory(tenantId ?? null, {
    enabled: Boolean(tenantId),
    placeholderData: keepPreviousData
  });
  const identifiers = useTenantIdentifiers(tenantId ?? null, {
    enabled: Boolean(tenantId),
    placeholderData: keepPreviousData
  });
  const attachments = useTenantAttachments(tenantId ?? null, {
    enabled: Boolean(tenantId),
    placeholderData: keepPreviousData
  });
  const shareholdings = useTenantShareholdings(tenantId ?? null, {
    enabled: Boolean(tenantId),
    placeholderData: keepPreviousData
  });
  const approvals = useTenantApprovals(tenantId ?? null, {
    enabled: Boolean(tenantId),
    placeholderData: keepPreviousData
  });
  const officers = useTenantOfficers(tenantId ?? null, {
    enabled: Boolean(tenantId),
    placeholderData: keepPreviousData
  });
  const vehicleAssignments = useTenantVehicleAssignments(tenantId ?? null, {
    enabled: Boolean(tenantId),
    placeholderData: keepPreviousData
  });
  const driverAssignments = useTenantDriverAssignments(tenantId ?? null, {
    enabled: Boolean(tenantId),
    placeholderData: keepPreviousData
  });

  const identityItems: TenantIdentityItem[] = identityHistory.data?.items ?? [];
  const identifierItems: TenantIdentifierItem[] = identifiers.data?.items ?? [];
  const attachmentItems: AttachmentItem[] = attachments.data?.items ?? [];
  const shareholdingItems: ShareholdingItem[] = shareholdings.data?.items ?? [];
  const approvalItems: TenantApprovalItem[] = approvals.data?.items ?? [];
  const officerItems: OfficerItem[] = officers.data?.items ?? [];
  const vehicleItems: VehicleAssignmentItem[] = vehicleAssignments.data?.items ?? [];
  const driverItems: DriverAssignmentItem[] = driverAssignments.data?.items ?? [];

  const identityMutation = useCreateTenantIdentity(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setIdentityDialogOpen(false);
      setIdentityError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.identities(tenantId) });
      await queryClient.invalidateQueries({ queryKey: tenantKeys.identityHistory(tenantId) });
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

  const attachmentMutation = useCreateAttachment(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setAttachmentDialogOpen(false);
      setAttachmentError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.attachments(tenantId) });
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

  const deleteAttachmentMutation = useDeleteAttachment(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setAttachmentDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.attachments(tenantId) });
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

  const shareholdingMutation = useCreateShareholding(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setShareholdingDialogOpen(false);
      setShareholdingError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.shareholdings(tenantId) });
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

  const approvalMutation = useCreateTenantApproval(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setApprovalDialogOpen(false);
      setApprovalError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.approvals(tenantId) });
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

  const deleteApprovalMutation = useDeleteTenantApproval(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setApprovalDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.approvals(tenantId) });
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

  const officerMutation = useCreateOfficer(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setOfficerDialog(null);
      setOfficerError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.officers(tenantId) });
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

  const updateOfficerMutation = useUpdateOfficer(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setOfficerDialog(null);
      setOfficerError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.officers(tenantId) });
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

  const deleteOfficerMutation = useDeleteOfficer(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setOfficerDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.officers(tenantId) });
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

  const vehicleMutation = useCreateVehicleAssignment(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setVehicleDialog(null);
      setVehicleError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.vehicleAssignments(tenantId) });
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

  const updateVehicleMutation = useUpdateVehicleAssignment(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setVehicleDialog(null);
      setVehicleError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.vehicleAssignments(tenantId) });
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

  const deleteVehicleMutation = useDeleteVehicleAssignment(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setVehicleDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.vehicleAssignments(tenantId) });
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

  const driverMutation = useCreateDriverAssignment(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setDriverDialog(null);
      setDriverError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.driverAssignments(tenantId) });
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

  const updateDriverMutation = useUpdateDriverAssignment(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setDriverDialog(null);
      setDriverError(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.driverAssignments(tenantId) });
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

  const deleteDriverMutation = useDeleteDriverAssignment(tenantId ?? '', {
    onSuccess: async () => {
      if (!tenantId) return;
      setDriverDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: tenantKeys.driverAssignments(tenantId) });
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

  const assignUserMutation = useAssignTenantUser(tenantId ?? '', {
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
    if (!tenantId) return;
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
    if (!tenantId) return;
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
    if (!tenantId) return;
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
    if (!tenantId) return;
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
        ...(partyIdValue
          ? {}
          : {
              party: {
                type: partyTypeValue,
                displayName: partyNameValue
              }
            })
      };

      if (officerDialog?.mode === 'edit' && officerDialog.record) {
        await updateOfficerMutation.mutateAsync({
          officerId: officerDialog.record.id,
          ...payload
        });
        showToast({
          title: t('tenants.toasts.officerUpdated', { defaultValue: 'Officer updated' }),
          description:
            officerDialog.record.party?.displayName ?? officerDialog.record.partyId ?? officerDialog.record.officerType,
          tone: 'success'
        });
      } else {
        await officerMutation.mutateAsync(payload);
        showToast({
          title: t('tenants.toasts.officerAdded', { defaultValue: 'Officer added' }),
          description: partyNameValue || partyIdValue || officerType,
          tone: 'success'
        });
      }
      form.reset();
    } catch {
      // handled via onError
    }
  };

  const handleVehicleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tenantId) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const vehicleId = (formData.get('vehicleId') as string | null)?.trim() ?? '';
    const companyId = (formData.get('companyId') as string | null)?.trim() ?? '';
    const assignedFrom = (formData.get('assignedFrom') as string | null)?.trim() ?? '';
    if (!vehicleId || !companyId || !assignedFrom) {
      setVehicleError(
        t('tenants.detail.vehicles.validation', {
          defaultValue: 'Vehicle, company and start date are required.'
        })
      );
      return;
    }

    setVehicleError(null);

    try {
      const payload: CreateVehicleAssignmentInput = {
        vehicleId,
        companyId,
        assignedFrom,
        assignedTo: (formData.get('assignedTo') as string | null)?.trim() || undefined,
        approvalId: (formData.get('approvalId') as string | null)?.trim() || undefined
      };
      if (vehicleDialog?.mode === 'edit' && vehicleDialog.record) {
        await updateVehicleMutation.mutateAsync({
          assignmentId: vehicleDialog.record.id,
          ...payload
        });
        showToast({
          title: t('tenants.toasts.vehicleAssigned', { defaultValue: 'Vehicle assignment saved' }),
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
      }
      form.reset();
    } catch {
      // handled via onError
    }
  };

*** End Patch
