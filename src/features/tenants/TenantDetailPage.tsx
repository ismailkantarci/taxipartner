import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  CreateTenantIdentityInput,
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
import { useToast } from '../../components/feedback/ToastProvider';
import ConfirmDialog from '../../components/overlay/ConfirmDialog';
import {
  ApprovalsSection,
  AttachmentsSection,
  DriversSection,
  IdentityHistorySection,
  IdentifiersSection,
  OfficersSection,
  ShareholdingsSection,
  TenantOverviewSection,
  VehiclesSection
} from './components/TenantDetailSections';
import { FormDialog } from '../common';
import { cx } from '../common/utils';
import { toTenantInputDate } from './utils';

type EditDialogState<T> = { mode: 'create' | 'edit'; record?: T } | null;

const useIsDesktop = () => {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  );

  useEffect(() => {
    const handleResize = () => setMatches(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return matches;
};

const resolveErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const TenantDetailPage: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isDesktop = useIsDesktop();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const stateTenant = (location.state as { tenant?: TenantItem } | undefined)?.tenant ?? null;
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
    if (tenantId) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantOverview) {
      headingRef.current?.focus();
    }
  }, [tenantOverview?.tenantId]);

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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.identifiers.error', { defaultValue: 'Failed to create identifier.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.attachments.error', { defaultValue: 'Failed to create attachment.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.attachments.error', { defaultValue: 'Failed to remove attachment.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.shareholdings.error', { defaultValue: 'Failed to create shareholding.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.approvals.error', { defaultValue: 'Failed to create approval.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.approvals.error', { defaultValue: 'Failed to delete approval.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.officers.error', { defaultValue: 'Failed to add officer.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.officers.error', { defaultValue: 'Failed to update officer.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.officers.error', { defaultValue: 'Failed to remove officer.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.vehicles.error', { defaultValue: 'Failed to assign vehicle.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.vehicles.error', { defaultValue: 'Failed to update vehicle assignment.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.vehicles.error', { defaultValue: 'Failed to remove vehicle assignment.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.drivers.error', { defaultValue: 'Failed to assign driver.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.drivers.error', { defaultValue: 'Failed to update driver assignment.' })
      );
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
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.drivers.error', { defaultValue: 'Failed to remove driver assignment.' })
      );
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
        description: t('tenants.toasts.assignmentCreated.detail', {
          defaultValue: 'Assignment saved.'
        }),
        tone: 'success'
      });
    },
    onError: error => {
      const message = resolveErrorMessage(
        error,
        t('tenants.detail.assign.error', { defaultValue: 'Failed to assign user.' })
      );
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
      const payload: CreateTenantIdentityInput = {
        idType,
        idValue,
        countryCode: (formData.get('countryCode') as string | null)?.trim() || undefined,
        validFrom: (formData.get('validFrom') as string | null) || undefined,
        validTo: (formData.get('validTo') as string | null) || undefined,
        target: (formData.get('target') as string | null)?.trim() || undefined,
        primaryFlag: formData.get('primaryFlag') === 'on'
      };
      await identityMutation.mutateAsync(payload);
      showToast({
        title: t('tenants.toasts.identifierCreated', { defaultValue: 'Identifier saved' }),
        description: idValue,
        tone: 'success'
      });
      form.reset();
    } catch {
      // handled in onError
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
      const payload: CreateShareholdingInput = {
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
      };
      await shareholdingMutation.mutateAsync(payload);
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
          input: payload
        });
        showToast({
          title: t('tenants.toasts.officerUpdated', { defaultValue: 'Officer updated' }),
          description:
            officerDialog.record.party?.displayName ??
            officerDialog.record.partyId ??
            officerDialog.record.officerType,
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
          input: payload
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

  const handleDriverSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tenantId) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const companyId = (formData.get('companyId') as string | null)?.trim() ?? '';
    const assignedFrom = (formData.get('assignedFrom') as string | null)?.trim() ?? '';
    const partyId = (formData.get('partyId') as string | null)?.trim() ?? '';
    const partyType = (formData.get('partyType') as string | null)?.trim() ?? '';
    const partyName = (formData.get('partyName') as string | null)?.trim() ?? '';

    if ((!partyId && (!partyType || !partyName)) || !companyId || !assignedFrom) {
      setDriverError(
        t('tenants.detail.drivers.validation', {
          defaultValue: 'Company, start date and party details are required.'
        })
      );
      return;
    }

    setDriverError(null);

    try {
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
      if (driverDialog?.mode === 'edit' && driverDialog.record) {
        await updateDriverMutation.mutateAsync({
          assignmentId: driverDialog.record.id,
          input: payload
        });
        showToast({
          title: t('tenants.toasts.driverAssigned', { defaultValue: 'Driver assignment saved' }),
          description:
            driverDialog.record.party?.displayName ?? driverDialog.record.partyId ?? companyId,
          tone: 'success'
        });
      } else {
        await driverMutation.mutateAsync(payload);
        showToast({
          title: t('tenants.toasts.driverAssigned', { defaultValue: 'Driver assignment saved' }),
          description: partyName || partyId || companyId,
          tone: 'success'
        });
      }
      form.reset();
    } catch {
      // handled via onError
    }
  };

  const handleApprovalSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tenantId) return;
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

    let payload: CreateApprovalInput['payload'];
    if (payloadRaw) {
      try {
        payload = JSON.parse(payloadRaw);
      } catch {
        setApprovalError(
          t('tenants.detail.approvals.invalidPayload', {
            defaultValue: 'Payload must be valid JSON.'
          })
        );
        return;
      }
    }

    setApprovalError(null);

    try {
      const input: CreateApprovalInput = {
        scope,
        op,
        objectId: objectId || undefined,
        idempotencyKey: idempotencyKey || undefined,
        payload
      };
      await approvalMutation.mutateAsync(input);
      showToast({
        title: t('tenants.toasts.approvalCreated', { defaultValue: 'Approval saved' }),
        description: scope,
        tone: 'success'
      });
      form.reset();
    } catch {
      // handled via onError
    }
  };

  const handleAssignUserSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tenantId) {
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

  const handleBack = () => {
    navigate('/tenants');
  };

  const identifierError = identifiers.isError
    ? resolveErrorMessage(
        identifiers.error,
        t('tenants.errors.generic', { defaultValue: 'Failed to load identifiers.' })
      )
    : null;
  const identityErrorMessage = identityHistory.isError
    ? resolveErrorMessage(
        identityHistory.error,
        t('tenants.errors.generic', { defaultValue: 'Failed to load identity history.' })
      )
    : null;
  const shareholdingErrorMessage = shareholdings.isError
    ? resolveErrorMessage(
        shareholdings.error,
        t('tenants.errors.generic', { defaultValue: 'Failed to load shareholdings.' })
      )
    : null;
  const attachmentsErrorMessage = attachments.isError
    ? resolveErrorMessage(
        attachments.error,
        t('tenants.errors.generic', { defaultValue: 'Failed to load attachments.' })
      )
    : null;
  const approvalsErrorMessage = approvals.isError
    ? resolveErrorMessage(
        approvals.error,
        t('tenants.errors.generic', { defaultValue: 'Failed to load approvals.' })
      )
    : null;
  const officersErrorMessage = officers.isError
    ? resolveErrorMessage(
        officers.error,
        t('tenants.errors.generic', { defaultValue: 'Failed to load officers.' })
      )
    : null;
  const vehiclesErrorMessage = vehicleAssignments.isError
    ? resolveErrorMessage(
        vehicleAssignments.error,
        t('tenants.errors.generic', { defaultValue: 'Failed to load vehicle assignments.' })
      )
    : null;
  const driversErrorMessage = driverAssignments.isError
    ? resolveErrorMessage(
        driverAssignments.error,
        t('tenants.errors.generic', { defaultValue: 'Failed to load driver assignments.' })
      )
    : null;

  if (!tenantId) {
    return (
      <section className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t('tenants.detail.missingTenant', {
              defaultValue: 'No tenant selected'
            })}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('tenants.detail.missingTenantDescription', {
              defaultValue: 'Return to the tenants list to choose a record.'
            })}
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-slate-100 dark:text-slate-900"
          >
            {t('tenants.detail.backToList', { defaultValue: 'Back to list' })}
          </button>
        </div>
      </section>
    );
  }

  if (tenantMissing) {
    return (
      <section className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t('tenants.detail.notFoundTitle', { defaultValue: 'Tenant not found' })}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('tenants.detail.notFoundDescription', {
              defaultValue: 'The requested tenant record could not be located.'
            })}
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-slate-100 dark:text-slate-900"
          >
            {t('tenants.detail.backToList', { defaultValue: 'Back to list' })}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cx(
        'relative flex flex-1 overflow-y-auto',
        isDesktop ? 'lg:bg-slate-950/10 dark:lg:bg-slate-950/40' : ''
      )}
    >
      <div className={cx('flex w-full justify-center lg:justify-end')}>
        <div
          className={cx(
            'flex w-full flex-col gap-6 px-4 py-6 sm:px-6',
            isDesktop
              ? 'lg:ml-auto lg:w-[min(800px,100%)] lg:rounded-l-3xl lg:border-l lg:border-slate-200 lg:bg-white lg:px-8 lg:py-10 lg:pb-16 lg:shadow-[0_10px_40px_-12px_rgba(15,23,42,0.35)] dark:lg:border-slate-800 dark:lg:bg-slate-900/95'
              : ''
          )}
        >
          <TenantOverviewSection
            tenant={tenantOverview}
            isLoading={fallbackQuery.isLoading && !tenantOverview}
            onBack={handleBack}
            headingRef={headingRef}
            onAssignUser={() => {
              setAssignUserError(null);
              setAssignUserDialogOpen(true);
            }}
            onCreateIdentity={() => {
              setIdentityDialogOpen(true);
              setIdentityError(null);
            }}
          />

          <IdentityHistorySection
            items={identityItems}
            isLoading={identityHistory.isLoading}
            error={identityErrorMessage}
          />
          <IdentifiersSection
            items={identifierItems}
            isLoading={identifiers.isLoading}
            error={identifierError}
            onAdd={() => {
              setIdentityDialogOpen(true);
              setIdentityError(null);
            }}
          />
          <ShareholdingsSection
            items={shareholdingItems}
            isLoading={shareholdings.isLoading}
            error={shareholdingErrorMessage}
            onAdd={() => {
              setShareholdingDialogOpen(true);
              setShareholdingError(null);
            }}
          />
          <AttachmentsSection
            items={attachmentItems}
            isLoading={attachments.isLoading}
            error={attachmentsErrorMessage}
            onAdd={() => {
              setAttachmentDialogOpen(true);
              setAttachmentError(null);
            }}
            onDelete={item => setAttachmentDeleteTarget(item)}
          />
          <ApprovalsSection
            items={approvalItems}
            isLoading={approvals.isLoading}
            error={approvalsErrorMessage}
            onAdd={() => {
              setApprovalDialogOpen(true);
              setApprovalError(null);
            }}
            onDelete={item => setApprovalDeleteTarget(item)}
          />
          <OfficersSection
            items={officerItems}
            isLoading={officers.isLoading}
            error={officersErrorMessage}
            onCreate={() => {
              setOfficerDialog({ mode: 'create' });
              setOfficerError(null);
            }}
            onEdit={item => {
              setOfficerDialog({ mode: 'edit', record: item });
              setOfficerError(null);
            }}
            onDelete={item => setOfficerDeleteTarget(item)}
          />
          <VehiclesSection
            items={vehicleItems}
            isLoading={vehicleAssignments.isLoading}
            error={vehiclesErrorMessage}
            onCreate={() => {
              setVehicleDialog({ mode: 'create' });
              setVehicleError(null);
            }}
            onEdit={item => {
              setVehicleDialog({ mode: 'edit', record: item });
              setVehicleError(null);
            }}
            onDelete={item => setVehicleDeleteTarget(item)}
          />
          <DriversSection
            items={driverItems}
            isLoading={driverAssignments.isLoading}
            error={driversErrorMessage}
            onCreate={() => {
              setDriverDialog({ mode: 'create' });
              setDriverError(null);
            }}
            onEdit={item => {
              setDriverDialog({ mode: 'edit', record: item });
              setDriverError(null);
            }}
            onDelete={item => setDriverDeleteTarget(item)}
          />
        </div>
      </div>

      <FormDialog
        isOpen={isIdentityDialogOpen}
        onClose={() => {
          setIdentityDialogOpen(false);
          setIdentityError(null);
        }}
        title={t('tenants.detail.identifiers.dialog.title', { defaultValue: 'Add identifier' })}
        description={t('tenants.detail.identifiers.dialog.description', {
          defaultValue: 'Create a new identifier for the selected tenant.'
        })}
        submitLabel={
          identityMutation.isPending
            ? t('tenants.detail.identifiers.dialog.saving', { defaultValue: 'Saving…' })
            : t('tenants.detail.identifiers.dialog.submit', { defaultValue: 'Save identifier' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
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
          <label className="flex flex-col gap-1 text-sm">
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
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm uppercase tracking-wide text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="primaryFlag"
              className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500 dark:border-slate-700 dark:text-slate-200"
            />
            <span className="text-slate-700 dark:text-slate-200">
              {t('tenants.detail.identifiers.dialog.primary', {
                defaultValue: 'Mark as primary'
              })}
            </span>
          </label>
        </div>
      </FormDialog>

      <FormDialog
        isOpen={isShareholdingDialogOpen}
        onClose={() => {
          setShareholdingDialogOpen(false);
          setShareholdingError(null);
        }}
        title={t('tenants.detail.shareholdings.dialog.title', { defaultValue: 'Add shareholding' })}
        description={t('tenants.detail.shareholdings.dialog.description', {
          defaultValue: 'Record a new shareholding for this tenant.'
        })}
        submitLabel={
          shareholdingMutation.isPending
            ? t('tenants.detail.shareholdings.dialog.saving', { defaultValue: 'Saving…' })
            : t('tenants.detail.shareholdings.dialog.submit', { defaultValue: 'Save shareholding' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
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
              {t('tenants.detail.shareholdings.dialog.role', { defaultValue: 'Role' })}
            </span>
            <input
              name="roleType"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.shareholdings.dialog.partyId', { defaultValue: 'Party ID' })}
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
      </FormDialog>

      <FormDialog
        isOpen={isAttachmentDialogOpen}
        onClose={() => {
          setAttachmentDialogOpen(false);
          setAttachmentError(null);
        }}
        title={t('tenants.detail.attachments.dialog.title', { defaultValue: 'Add attachment' })}
        description={t('tenants.detail.attachments.dialog.description', {
          defaultValue: 'Link or register documentation for this tenant.'
        })}
        submitLabel={
          attachmentMutation.isPending
            ? t('tenants.detail.attachments.dialog.saving', { defaultValue: 'Saving…' })
            : t('tenants.detail.attachments.dialog.submit', { defaultValue: 'Save attachment' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
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
                {t('tenants.detail.attachments.ownerType.permit', {
                  defaultValue: 'Company permit'
                })}
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
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.attachments.dialog.type', { defaultValue: 'Attachment type' })}
            </span>
            <input
              name="attachmentType"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
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
              {t('tenants.detail.attachments.dialog.issuedAt', { defaultValue: 'Issued at' })}
            </span>
            <input
              type="date"
              name="issuedAt"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.attachments.dialog.sourceUrl', { defaultValue: 'Source URL' })}
            </span>
            <input
              name="sourceUrl"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </FormDialog>

      <FormDialog
        isOpen={Boolean(officerDialog)}
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
          defaultValue: 'Record an officer responsible for this tenant.'
        })}
        submitLabel={
          officerFormBusy
            ? t('tenants.detail.dialog.saving', { defaultValue: 'Saving…' })
            : officerDialog?.mode === 'edit'
            ? t('tenants.detail.officers.dialog.update', { defaultValue: 'Save changes' })
            : t('tenants.detail.officers.dialog.submit', { defaultValue: 'Save officer' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
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
              {t('tenants.detail.officers.dialog.officerType', { defaultValue: 'Officer type' })}
            </span>
            <input
              name="officerType"
              defaultValue={editingOfficer?.officerType ?? ''}
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.officers.dialog.level', { defaultValue: 'Level' })}
            </span>
            <select
              name="level"
              defaultValue={editingOfficer?.level ?? 'TENANT'}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="TENANT">
                {t('tenants.detail.officers.level.tenant', { defaultValue: 'Tenant' })}
              </option>
              <option value="COMPANY">
                {t('tenants.detail.officers.level.company', { defaultValue: 'Company' })}
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.officers.dialog.company', {
                defaultValue: 'Company ID (required for company level)'
              })}
            </span>
            <input
              name="companyId"
              defaultValue={editingOfficer?.companyId ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.officers.dialog.partyId', { defaultValue: 'Party ID' })}
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
          <label className="flex flex-col gap-1 text-sm">
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
              {t('tenants.detail.officers.dialog.validFrom', { defaultValue: 'Valid from' })}
            </span>
            <input
              type="date"
              name="validFrom"
              defaultValue={toTenantInputDate(editingOfficer?.validFrom)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.officers.dialog.validTo', { defaultValue: 'Valid to' })}
            </span>
            <input
              type="date"
              name="validTo"
              defaultValue={toTenantInputDate(editingOfficer?.validTo)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </FormDialog>

      <FormDialog
        isOpen={Boolean(vehicleDialog)}
        onClose={() => {
          setVehicleDialog(null);
          setVehicleError(null);
        }}
        title={
          vehicleDialog?.mode === 'edit'
            ? t('tenants.detail.vehicles.dialog.editTitle', { defaultValue: 'Edit assignment' })
            : t('tenants.detail.vehicles.dialog.title', { defaultValue: 'Assign vehicle' })
        }
        description={t('tenants.detail.vehicles.dialog.description', {
          defaultValue: 'Assign a vehicle to this tenant.'
        })}
        submitLabel={
          vehicleFormBusy
            ? t('tenants.detail.dialog.saving', { defaultValue: 'Saving…' })
            : vehicleDialog?.mode === 'edit'
            ? t('tenants.detail.vehicles.dialog.update', { defaultValue: 'Save changes' })
            : t('tenants.detail.vehicles.dialog.submit', { defaultValue: 'Save assignment' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
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
              defaultValue={editingVehicle?.vehicleId ?? ''}
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.vehicles.dialog.company', { defaultValue: 'Company ID' })}
            </span>
            <input
              name="companyId"
              defaultValue={editingVehicle?.companyId ?? ''}
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.vehicles.dialog.start', { defaultValue: 'Start date' })}
            </span>
            <input
              type="date"
              name="assignedFrom"
              defaultValue={toTenantInputDate(editingVehicle?.assignedFrom)}
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.vehicles.dialog.end', { defaultValue: 'End date' })}
            </span>
            <input
              type="date"
              name="assignedTo"
              defaultValue={toTenantInputDate(editingVehicle?.assignedTo)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.vehicles.dialog.approval', { defaultValue: 'Approval ID' })}
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
        isOpen={Boolean(driverDialog)}
        onClose={() => {
          setDriverDialog(null);
          setDriverError(null);
        }}
        title={
          driverDialog?.mode === 'edit'
            ? t('tenants.detail.drivers.dialog.editTitle', { defaultValue: 'Edit assignment' })
            : t('tenants.detail.drivers.dialog.title', { defaultValue: 'Assign driver' })
        }
        description={t('tenants.detail.drivers.dialog.description', {
          defaultValue: 'Assign a driver to this tenant.'
        })}
        submitLabel={
          driverFormBusy
            ? t('tenants.detail.dialog.saving', { defaultValue: 'Saving…' })
            : driverDialog?.mode === 'edit'
            ? t('tenants.detail.drivers.dialog.update', { defaultValue: 'Save changes' })
            : t('tenants.detail.drivers.dialog.submit', { defaultValue: 'Save assignment' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
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
              {t('tenants.detail.drivers.dialog.partyId', { defaultValue: 'Party ID' })}
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.drivers.dialog.company', { defaultValue: 'Company ID' })}
            </span>
            <input
              name="companyId"
              defaultValue={editingDriver?.companyId ?? ''}
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.drivers.dialog.start', { defaultValue: 'Start date' })}
            </span>
            <input
              type="date"
              name="assignedFrom"
              defaultValue={toTenantInputDate(editingDriver?.assignedFrom)}
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.drivers.dialog.end', { defaultValue: 'End date' })}
            </span>
            <input
              type="date"
              name="assignedTo"
              defaultValue={toTenantInputDate(editingDriver?.assignedTo)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.drivers.dialog.approval', { defaultValue: 'Approval ID' })}
            </span>
            <input
              name="approvalId"
              defaultValue={editingDriver?.approvalId ?? ''}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </FormDialog>

      <FormDialog
        isOpen={isApprovalDialogOpen}
        onClose={() => {
          setApprovalDialogOpen(false);
          setApprovalError(null);
        }}
        title={t('tenants.detail.approvals.dialog.title', { defaultValue: 'Create approval' })}
        description={t('tenants.detail.approvals.dialog.description', {
          defaultValue: 'Record a manual approval request for this tenant.'
        })}
        submitLabel={
          approvalMutation.isPending
            ? t('tenants.detail.approvals.dialog.saving', { defaultValue: 'Saving…' })
            : t('tenants.detail.approvals.dialog.submit', { defaultValue: 'Save approval' })
        }
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        isSubmitting={approvalMutation.isPending}
        onSubmit={handleApprovalSubmit}
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
              {t('tenants.detail.approvals.dialog.objectId', { defaultValue: 'Object ID' })}
            </span>
            <input
              name="objectId"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.approvals.dialog.idempotencyKey', {
                defaultValue: 'Idempotency key'
              })}
            </span>
            <input
              name="idempotencyKey"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {t('tenants.detail.approvals.dialog.payload', { defaultValue: 'Payload (JSON)' })}
            </span>
            <textarea
              name="payload"
              rows={4}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder={t('tenants.detail.approvals.dialog.payloadHelp', {
                defaultValue: 'Provide valid JSON or leave blank.'
              })}
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
        disableSubmit={!tenantId}
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
              value={tenantId}
              readOnly
              className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
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

      <ConfirmDialog
        isOpen={Boolean(attachmentDeleteTarget)}
        title={t('tenants.detail.attachments.deleteTitle', { defaultValue: 'Remove attachment' })}
        description={
          attachmentDeleteTarget
            ? t('tenants.detail.attachments.deleteDescription', {
                defaultValue: 'This removes {{type}} from the attachment list.',
                values: { type: attachmentDeleteTarget.attachmentType }
              })
            : ''
        }
        confirmLabel={t('tenants.detail.actions.confirmRemove', { defaultValue: 'Remove' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        loading={deleteAttachmentMutation.isPending}
        onConfirm={() => {
          if (!attachmentDeleteTarget || !tenantId) return;
          const target = attachmentDeleteTarget;
          void (async () => {
            try {
              await deleteAttachmentMutation.mutateAsync({ attachmentId: target.id });
              showToast({
                title: t('tenants.toasts.attachmentRemoved', { defaultValue: 'Attachment removed' }),
                description: target.attachmentType,
                tone: 'success'
              });
            } catch {
              // handled via onError
            }
          })();
        }}
        onCancel={() => setAttachmentDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(approvalDeleteTarget)}
        title={t('tenants.detail.approvals.deleteTitle', { defaultValue: 'Remove approval' })}
        description={
          approvalDeleteTarget
            ? t('tenants.detail.approvals.deleteDescription', {
                defaultValue: 'This removes approval {{scope}}.',
                values: { scope: approvalDeleteTarget.scope }
              })
            : ''
        }
        confirmLabel={t('tenants.detail.actions.confirmRemove', { defaultValue: 'Remove' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        loading={deleteApprovalMutation.isPending}
        onConfirm={() => {
          if (!approvalDeleteTarget || !tenantId) return;
          const target = approvalDeleteTarget;
          void (async () => {
            try {
              await deleteApprovalMutation.mutateAsync({ approvalId: target.id });
              showToast({
                title: t('tenants.toasts.approvalRemoved', { defaultValue: 'Approval removed' }),
                description: target.scope,
                tone: 'success'
              });
            } catch {
              // handled via onError
            }
          })();
        }}
        onCancel={() => setApprovalDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(officerDeleteTarget)}
        title={t('tenants.detail.officers.deleteTitle', { defaultValue: 'Remove officer' })}
        description={
          officerDeleteTarget
            ? t('tenants.detail.officers.deleteDescription', {
                defaultValue: 'This removes {{name}} from the officer list.',
                values: {
                  name:
                    officerDeleteTarget.party?.displayName ??
                    officerDeleteTarget.partyId ??
                    officerDeleteTarget.officerType
                }
              })
            : ''
        }
        confirmLabel={t('tenants.detail.actions.confirmRemove', { defaultValue: 'Remove' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        loading={deleteOfficerMutation.isPending}
        onConfirm={() => {
          if (!officerDeleteTarget || !tenantId) return;
          const target = officerDeleteTarget;
          void (async () => {
            try {
              await deleteOfficerMutation.mutateAsync({ officerId: target.id });
              showToast({
                title: t('tenants.toasts.officerRemoved', { defaultValue: 'Officer removed' }),
                description:
                  target.party?.displayName ?? target.partyId ?? target.officerType,
                tone: 'success'
              });
            } catch {
              // handled via onError
            }
          })();
        }}
        onCancel={() => setOfficerDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(vehicleDeleteTarget)}
        title={t('tenants.detail.vehicles.deleteTitle', {
          defaultValue: 'Remove vehicle assignment'
        })}
        description={
          vehicleDeleteTarget
            ? t('tenants.detail.vehicles.deleteDescription', {
                defaultValue: 'This removes vehicle {{vehicleId}} from this tenant.',
                values: { vehicleId: vehicleDeleteTarget.vehicleId }
              })
            : ''
        }
        confirmLabel={t('tenants.detail.actions.confirmRemove', { defaultValue: 'Remove' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        loading={deleteVehicleMutation.isPending}
        onConfirm={() => {
          if (!vehicleDeleteTarget || !tenantId) return;
          const target = vehicleDeleteTarget;
          void (async () => {
            try {
              await deleteVehicleMutation.mutateAsync({ assignmentId: target.id });
              showToast({
                title: t('tenants.toasts.vehicleRemoved', { defaultValue: 'Vehicle removed' }),
                description: target.vehicleId,
                tone: 'success'
              });
            } catch {
              // handled via onError
            }
          })();
        }}
        onCancel={() => setVehicleDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(driverDeleteTarget)}
        title={t('tenants.detail.drivers.deleteTitle', { defaultValue: 'Remove driver assignment' })}
        description={
          driverDeleteTarget
            ? t('tenants.detail.drivers.deleteDescription', {
                defaultValue: 'This removes {{name}} from this tenant.',
                values: {
                  name:
                    driverDeleteTarget.party?.displayName ??
                    driverDeleteTarget.partyId ??
                    driverDeleteTarget.companyId
                }
              })
            : ''
        }
        confirmLabel={t('tenants.detail.actions.confirmRemove', { defaultValue: 'Remove' })}
        cancelLabel={t('tenants.detail.dialog.cancel', { defaultValue: 'Cancel' })}
        loading={deleteDriverMutation.isPending}
        onConfirm={() => {
          if (!driverDeleteTarget || !tenantId) return;
          const target = driverDeleteTarget;
          void (async () => {
            try {
              await deleteDriverMutation.mutateAsync({ assignmentId: target.id });
              showToast({
                title: t('tenants.toasts.driverRemoved', { defaultValue: 'Driver removed' }),
                description:
                  target.party?.displayName ?? target.partyId ?? target.companyId,
                tone: 'success'
              });
            } catch {
              // handled via onError
            }
          })();
        }}
        onCancel={() => setDriverDeleteTarget(null)}
      />
    </section>
  );
};

export default TenantDetailPage;
