import {
  legacyFetch,
  useLegacyMutation,
  useLegacyQuery,
  type LegacyMutationOptions,
  type LegacyQueryOptions,
  type LegacyQueryParams
} from '../legacy';
import type {
  AssignTenantUserInput,
  CreateAttachmentInput,
  CreateApprovalInput,
  CreateCorporateActionInput,
  CreateDriverAssignmentInput,
  CreateOfficerInput,
  CreateShareholdingInput,
  CreateTenantIdentityInput,
  CreateTenantInput,
  CreateVehicleAssignmentInput,
  TenantApprovalItem,
  TenantIdentifierItem,
  TenantIdentityItem,
  TenantItem,
  TenantListParams,
  TenantListResponse,
  TenantMutateResponse,
  TenantRelatedListResponse,
  ShareholdingItem,
  AttachmentItem,
  OfficerItem,
  VehicleAssignmentItem,
  DriverAssignmentItem,
  CorporateActionItem
} from './types';

const encodeId = (value: string) => encodeURIComponent(value);

const toLegacyParams = (params: TenantListParams): LegacyQueryParams => ({
  query: params.query,
  status: params.status,
  page: params.page,
  pageSize: params.pageSize,
  sort: params.sort,
  order: params.order
});

type LegacyQueryOpts<T> = Partial<Omit<LegacyQueryOptions<T>, 'path' | 'queryKey'>>;

export const tenantKeys = {
  all: ['tenants'] as const,
  list: (params: TenantListParams) =>
    [
      'tenants',
      'list',
      params.query ?? '',
      params.status ?? 'all',
      params.page ?? 0,
      params.pageSize ?? 20,
      params.sort ?? 'created',
      params.order ?? 'desc'
    ] as const,
  detail: (tenantId: string) => ['tenants', 'detail', tenantId] as const,
  identities: (tenantId: string) => ['tenants', 'identities', tenantId] as const,
  identityHistory: (tenantId: string) => ['tenants', 'identity-history', tenantId] as const,
  shareholdings: (tenantId: string) => ['tenants', 'shareholdings', tenantId] as const,
  attachments: (tenantId: string) => ['tenants', 'attachments', tenantId] as const,
  officers: (tenantId: string) => ['tenants', 'officers', tenantId] as const,
  vehicleAssignments: (tenantId: string) => ['tenants', 'vehicle-assignments', tenantId] as const,
  driverAssignments: (tenantId: string) => ['tenants', 'driver-assignments', tenantId] as const,
  approvals: (tenantId: string) => ['tenants', 'approvals', tenantId] as const,
  corporateActions: (tenantId?: string) => ['tenants', 'corporate-actions', tenantId ?? 'all'] as const
};

const withListDefaults = (data?: TenantListResponse): TenantListResponse => ({
  ok: data?.ok ?? false,
  status: data?.status ?? 200,
  items: data?.items ?? [],
  total: data?.total ?? (data?.items ? data.items.length : 0),
  page: data?.page ?? 0,
  pageSize: data?.pageSize ?? data?.items?.length ?? 0,
  sort: data?.sort,
  order: data?.order,
  error: data?.error
});

export const fetchTenants = (params: TenantListParams) =>
  legacyFetch<TenantListResponse>({
    path: '/tenants',
    params: toLegacyParams(params)
  }).then(withListDefaults);

export const useTenantsQuery = (
  params: TenantListParams,
  options?: LegacyQueryOpts<TenantListResponse>
) =>
  useLegacyQuery<TenantListResponse>({
    path: '/tenants',
    params: toLegacyParams(params),
    queryKey: tenantKeys.list(params),
    ...options
  });

export const useTenantIdentityHistory = (
  tenantId: string | null,
  options?: LegacyQueryOpts<TenantRelatedListResponse<TenantIdentityItem>>
) =>
  useLegacyQuery<TenantRelatedListResponse<TenantIdentityItem>>({
    enabled: Boolean(tenantId),
    path: `/tenants/${encodeId(tenantId ?? '')}/identity-history`,
    queryKey: tenantId ? tenantKeys.identityHistory(tenantId) : tenantKeys.identityHistory(''),
    ...options
  });

export const useTenantIdentifiers = (
  tenantId: string | null,
  options?: LegacyQueryOpts<TenantRelatedListResponse<TenantIdentifierItem>>
) =>
  useLegacyQuery<TenantRelatedListResponse<TenantIdentifierItem>>({
    enabled: Boolean(tenantId),
    path: `/tenants/${encodeId(tenantId ?? '')}/identities`,
    queryKey: tenantId ? tenantKeys.identities(tenantId) : tenantKeys.identities(''),
    ...options
  });

export const useTenantShareholdings = (
  tenantId: string | null,
  options?: LegacyQueryOpts<TenantRelatedListResponse<ShareholdingItem>>
) =>
  useLegacyQuery<TenantRelatedListResponse<ShareholdingItem>>({
    enabled: Boolean(tenantId),
    path: `/tenants/${encodeId(tenantId ?? '')}/shareholdings`,
    queryKey: tenantId ? tenantKeys.shareholdings(tenantId) : tenantKeys.shareholdings(''),
    ...options
  });

export const useTenantAttachments = (
  tenantId: string | null,
  options?: LegacyQueryOpts<TenantRelatedListResponse<AttachmentItem>>
) =>
  useLegacyQuery<TenantRelatedListResponse<AttachmentItem>>({
    enabled: Boolean(tenantId),
    path: `/tenants/${encodeId(tenantId ?? '')}/attachments`,
    queryKey: tenantId ? tenantKeys.attachments(tenantId) : tenantKeys.attachments(''),
    ...options
  });

export const useTenantOfficers = (
  tenantId: string | null,
  options?: LegacyQueryOpts<TenantRelatedListResponse<OfficerItem>>
) =>
  useLegacyQuery<TenantRelatedListResponse<OfficerItem>>({
    enabled: Boolean(tenantId),
    path: `/tenants/${encodeId(tenantId ?? '')}/officers`,
    queryKey: tenantId ? tenantKeys.officers(tenantId) : tenantKeys.officers(''),
    ...options
  });

export const useTenantVehicleAssignments = (
  tenantId: string | null,
  options?: LegacyQueryOpts<TenantRelatedListResponse<VehicleAssignmentItem>>
) =>
  useLegacyQuery<TenantRelatedListResponse<VehicleAssignmentItem>>({
    enabled: Boolean(tenantId),
    path: `/tenants/${encodeId(tenantId ?? '')}/vehicle-assignments`,
    queryKey: tenantId
      ? tenantKeys.vehicleAssignments(tenantId)
      : tenantKeys.vehicleAssignments(''),
    ...options
  });

export const useTenantDriverAssignments = (
  tenantId: string | null,
  options?: LegacyQueryOpts<TenantRelatedListResponse<DriverAssignmentItem>>
) =>
  useLegacyQuery<TenantRelatedListResponse<DriverAssignmentItem>>({
    enabled: Boolean(tenantId),
    path: `/tenants/${encodeId(tenantId ?? '')}/driver-assignments`,
    queryKey: tenantId
      ? tenantKeys.driverAssignments(tenantId)
      : tenantKeys.driverAssignments(''),
    ...options
  });

export const useTenantApprovals = (
  tenantId: string | null,
  options?: LegacyQueryOpts<TenantRelatedListResponse<TenantApprovalItem>>
) =>
  useLegacyQuery<TenantRelatedListResponse<TenantApprovalItem>>({
    enabled: Boolean(tenantId),
    path: `/tenants/${encodeId(tenantId ?? '')}/approvals`,
    queryKey: tenantId ? tenantKeys.approvals(tenantId) : tenantKeys.approvals(''),
    ...options
  });

export const useCorporateActions = (
  tenantId?: string,
  options?: LegacyQueryOpts<TenantRelatedListResponse<CorporateActionItem>>
) =>
  useLegacyQuery<TenantRelatedListResponse<CorporateActionItem>>({
    enabled: tenantId ? tenantId.length > 0 : true,
    path: '/corporate-actions',
    params: tenantId ? { tenantId } : undefined,
    queryKey: tenantKeys.corporateActions(tenantId),
    ...options
  });

export const useCreateTenant = (
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, CreateTenantInput>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, CreateTenantInput>({
    request: {
      path: '/tenants',
      method: 'POST',
      body: (input: CreateTenantInput) => input
    },
    ...options
  });

export const useUpdateTenant = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, CreateTenantInput>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, CreateTenantInput>({
    request: {
      path: `/tenants/${encodeId(tenantId)}`,
      method: 'PUT',
      body: (input: CreateTenantInput) => input
    },
    ...options
  });

export const useAssignTenantUser = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, AssignTenantUserInput>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, AssignTenantUserInput>({
    request: {
      path: `/tenants/${encodeId(tenantId)}/users`,
      method: 'POST',
      body: (input: AssignTenantUserInput) => input
    },
    ...options
  });

export const useCreateTenantIdentity = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, CreateTenantIdentityInput>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, CreateTenantIdentityInput>({
    request: {
      path: `/tenants/${encodeId(tenantId)}/identities`,
      method: 'POST',
      body: (input: CreateTenantIdentityInput) => input
    },
    ...options
  });

export const useCreateCorporateAction = (
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, CreateCorporateActionInput>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, CreateCorporateActionInput>({
    request: {
      path: '/corporate-actions',
      method: 'POST',
      body: (input: CreateCorporateActionInput) => input
    },
    ...options
  });

export const useCreateShareholding = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, CreateShareholdingInput>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, CreateShareholdingInput>({
    request: {
      path: `/tenants/${encodeId(tenantId)}/shareholdings`,
      method: 'POST',
      body: (input: CreateShareholdingInput) => input
    },
    ...options
  });

export const useCreateAttachment = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, CreateAttachmentInput>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, CreateAttachmentInput>({
    request: {
      path: `/tenants/${encodeId(tenantId)}/attachments`,
      method: 'POST',
      body: (input: CreateAttachmentInput) => input
    },
    ...options
  });

export const useDeleteAttachment = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, { attachmentId: string }>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, { attachmentId: string }>({
    request: {
      path: (variables: { attachmentId: string }) =>
        `/tenants/${encodeId(tenantId)}/attachments/${encodeId(variables.attachmentId)}`,
      method: 'DELETE'
    },
    ...options
  });

export const useCreateOfficer = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, CreateOfficerInput>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, CreateOfficerInput>({
    request: {
      path: `/tenants/${encodeId(tenantId)}/officers`,
      method: 'POST',
      body: (input: CreateOfficerInput) => input
    },
    ...options
  });

export const useUpdateOfficer = (
  tenantId: string,
  options?: Omit<
    LegacyMutationOptions<
      TenantMutateResponse,
      { officerId: string; input: CreateOfficerInput }
    >,
    'request'
  >
) =>
  useLegacyMutation<TenantMutateResponse, { officerId: string; input: CreateOfficerInput }>({
    request: {
      path: (variables: { officerId: string; input: CreateOfficerInput }) =>
        `/tenants/${encodeId(tenantId)}/officers/${encodeId(variables.officerId)}`,
      method: 'PUT',
      body: (variables: { officerId: string; input: CreateOfficerInput }) => variables.input
    },
    ...options
  });

export const useDeleteOfficer = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, { officerId: string }>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, { officerId: string }>({
    request: {
      path: (variables: { officerId: string }) =>
        `/tenants/${encodeId(tenantId)}/officers/${encodeId(variables.officerId)}`,
      method: 'DELETE'
    },
    ...options
  });

export const useCreateVehicleAssignment = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, CreateVehicleAssignmentInput>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, CreateVehicleAssignmentInput>({
    request: {
      path: `/tenants/${encodeId(tenantId)}/vehicle-assignments`,
      method: 'POST',
      body: (input: CreateVehicleAssignmentInput) => input
    },
    ...options
  });

export const useUpdateVehicleAssignment = (
  tenantId: string,
  options?: Omit<
    LegacyMutationOptions<
      TenantMutateResponse,
      { assignmentId: string; input: CreateVehicleAssignmentInput }
    >,
    'request'
  >
) =>
  useLegacyMutation<
    TenantMutateResponse,
    { assignmentId: string; input: CreateVehicleAssignmentInput }
  >({
    request: {
      path: (variables: { assignmentId: string; input: CreateVehicleAssignmentInput }) =>
        `/tenants/${encodeId(tenantId)}/vehicle-assignments/${encodeId(variables.assignmentId)}`,
      method: 'PUT',
      body: (variables: { assignmentId: string; input: CreateVehicleAssignmentInput }) =>
        variables.input
    },
    ...options
  });

export const useDeleteVehicleAssignment = (
  tenantId: string,
  options?: Omit<
    LegacyMutationOptions<TenantMutateResponse, { assignmentId: string }>,
    'request'
  >
) =>
  useLegacyMutation<TenantMutateResponse, { assignmentId: string }>({
    request: {
      path: (variables: { assignmentId: string }) =>
        `/tenants/${encodeId(tenantId)}/vehicle-assignments/${encodeId(variables.assignmentId)}`,
      method: 'DELETE'
    },
    ...options
  });

export const useCreateDriverAssignment = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, CreateDriverAssignmentInput>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, CreateDriverAssignmentInput>({
    request: {
      path: `/tenants/${encodeId(tenantId)}/driver-assignments`,
      method: 'POST',
      body: (input: CreateDriverAssignmentInput) => input
    },
    ...options
  });

export const useUpdateDriverAssignment = (
  tenantId: string,
  options?: Omit<
    LegacyMutationOptions<
      TenantMutateResponse,
      { assignmentId: string; input: CreateDriverAssignmentInput }
    >,
    'request'
  >
) =>
  useLegacyMutation<
    TenantMutateResponse,
    { assignmentId: string; input: CreateDriverAssignmentInput }
  >({
    request: {
      path: (variables: { assignmentId: string; input: CreateDriverAssignmentInput }) =>
        `/tenants/${encodeId(tenantId)}/driver-assignments/${encodeId(variables.assignmentId)}`,
      method: 'PUT',
      body: (variables: { assignmentId: string; input: CreateDriverAssignmentInput }) =>
        variables.input
    },
    ...options
  });

export const useDeleteDriverAssignment = (
  tenantId: string,
  options?: Omit<
    LegacyMutationOptions<TenantMutateResponse, { assignmentId: string }>,
    'request'
  >
) =>
  useLegacyMutation<TenantMutateResponse, { assignmentId: string }>({
    request: {
      path: (variables: { assignmentId: string }) =>
        `/tenants/${encodeId(tenantId)}/driver-assignments/${encodeId(variables.assignmentId)}`,
      method: 'DELETE'
    },
    ...options
  });

export const useCreateTenantApproval = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, CreateApprovalInput>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, CreateApprovalInput>({
    request: {
      path: `/tenants/${encodeId(tenantId)}/approvals`,
      method: 'POST',
      body: (input: CreateApprovalInput) => input
    },
    ...options
  });

export const useDeleteTenantApproval = (
  tenantId: string,
  options?: Omit<LegacyMutationOptions<TenantMutateResponse, { approvalId: string }>, 'request'>
) =>
  useLegacyMutation<TenantMutateResponse, { approvalId: string }>({
    request: {
      path: (variables: { approvalId: string }) =>
        `/tenants/${encodeId(tenantId)}/approvals/${encodeId(variables.approvalId)}`,
      method: 'DELETE'
    },
    ...options
  });
