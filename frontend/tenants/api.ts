import { buildAuthHeaders, buildJsonHeaders } from '../api/http';
import { t } from '../i18n/index';
import type {
  ApiListResponse,
  ApiMutationResponse,
  ApiResponseBase,
  AssignTenantUserInput,
  AttachmentItem,
  CorporateActionItem,
  CreateApprovalInput,
  CreateAttachmentInput,
  CreateCorporateActionInput,
  CreateDriverAssignmentInput,
  CreateOfficerInput,
  CreateShareholdingInput,
  CreateTenantIdentityInput,
  CreateTenantInput,
  CreateVehicleAssignmentInput,
  ListTenantsParams,
  DriverAssignmentItem,
  OfficerItem,
  ShareholdingItem,
  TenantApprovalItem,
  TenantIdentityItem,
  TenantIdentifierItem,
  TenantItem,
  VehicleAssignmentItem
} from './types';

const API = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

type HeadersMap = Record<string, string>;

function authHeaders(): HeadersMap {
  return buildAuthHeaders();
}

function jsonHeaders(): HeadersMap {
  return buildJsonHeaders(authHeaders());
}

type ApiData = Record<string, unknown>;

async function asJson<T extends ApiData>(response: Response): Promise<ApiResponseBase & T> {
  const fallbackError = t('errorGeneric') || 'Error';
  const raw = (await response.json().catch(() => ({}))) as ApiData & {
    ok?: boolean;
    error?: unknown;
  };
  const ok = response.ok && raw.ok !== false;
  const errorValue = typeof raw.error === 'string' ? raw.error : undefined;
  const { ok: _ignoredOk, error: _ignoredError, ...rest } = raw;
  const result: ApiResponseBase & T = {
    ...(rest as T),
    ok,
    status: response.status
  };
  if (!ok) {
    result.error = errorValue ?? fallbackError;
  } else if (errorValue) {
    result.error = errorValue;
  }
  return result;
}

export async function listTenants(params: ListTenantsParams = {}): Promise<ApiListResponse<TenantItem>> {
  const url = new URL(`${API}/tenants`);
  if (params.query) url.searchParams.set('q', params.query);
  if (params.status) url.searchParams.set('status', params.status);
  if (typeof params.page === 'number') url.searchParams.set('page', String(params.page));
  if (typeof params.pageSize === 'number') url.searchParams.set('pageSize', String(params.pageSize));
  if (params.sort) url.searchParams.set('sort', params.sort);
  if (params.order) url.searchParams.set('order', params.order);
  const response = await fetch(url.toString(), {
    headers: authHeaders()
  });
  return asJson<{ items?: TenantItem[] }>(response);
}

export async function createTenant(body: CreateTenantInput): Promise<ApiMutationResponse> {
  const response = await fetch(`${API}/tenants`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return asJson<Record<string, unknown>>(response);
}

export async function assignTenantUser(
  tenantId: string,
  body: AssignTenantUserInput
): Promise<ApiMutationResponse> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/users`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return asJson<Record<string, unknown>>(response);
}

export async function updateTenant(tenantId: string, body: CreateTenantInput): Promise<ApiMutationResponse> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return asJson<Record<string, unknown>>(response);
}

export async function getTenantIdentityHistory(
  tenantId: string
): Promise<ApiListResponse<TenantIdentityItem>> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/identity-history`, {
    headers: authHeaders()
  });
  return asJson<{ items?: TenantIdentityItem[] }>(response);
}

export async function listCorporateActions(
  tenantId?: string
): Promise<ApiListResponse<CorporateActionItem>> {
  const url = new URL(`${API}/corporate-actions`);
  if (tenantId) {
    url.searchParams.set('tenantId', tenantId);
  }
  const response = await fetch(url.toString(), {
    headers: authHeaders()
  });
  return asJson<{ items?: CorporateActionItem[] }>(response);
}

export async function createCorporateAction(
  body: CreateCorporateActionInput
): Promise<ApiMutationResponse> {
  const response = await fetch(`${API}/corporate-actions`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return asJson<Record<string, unknown>>(response);
}

export async function listShareholdings(tenantId: string): Promise<ApiListResponse<ShareholdingItem>> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/shareholdings`, {
    headers: authHeaders()
  });
  return asJson<{ items?: ShareholdingItem[] }>(response);
}

export async function createShareholding(
  tenantId: string,
  body: CreateShareholdingInput
): Promise<ApiMutationResponse> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/shareholdings`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return asJson<Record<string, unknown>>(response);
}

export async function listAttachments(tenantId: string): Promise<ApiListResponse<AttachmentItem>> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/attachments`, {
    headers: authHeaders()
  });
  return asJson<{ items?: AttachmentItem[] }>(response);
}

export async function createAttachment(
  tenantId: string,
  body: CreateAttachmentInput
): Promise<ApiMutationResponse> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/attachments`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return asJson<Record<string, unknown>>(response);
}

export async function listTenantIdentities(
  tenantId: string
): Promise<ApiListResponse<TenantIdentifierItem>> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/identities`, {
    headers: authHeaders()
  });
  return asJson<{ items?: TenantIdentifierItem[] }>(response);
}

export async function createTenantIdentity(
  tenantId: string,
  body: CreateTenantIdentityInput
): Promise<ApiMutationResponse> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/identities`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return asJson<Record<string, unknown>>(response);
}

export async function listOfficers(tenantId: string): Promise<ApiListResponse<OfficerItem>> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/officers`, {
    headers: authHeaders()
  });
  return asJson<{ items?: OfficerItem[] }>(response);
}

export async function createOfficer(
  tenantId: string,
  body: CreateOfficerInput
): Promise<ApiMutationResponse> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/officers`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return asJson<Record<string, unknown>>(response);
}

export async function listVehicleAssignments(
  tenantId: string
): Promise<ApiListResponse<VehicleAssignmentItem>> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/vehicle-assignments`, {
    headers: authHeaders()
  });
  return asJson<{ items?: VehicleAssignmentItem[] }>(response);
}

export async function createVehicleAssignment(
  tenantId: string,
  body: CreateVehicleAssignmentInput
): Promise<ApiMutationResponse> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/vehicle-assignments`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return asJson<Record<string, unknown>>(response);
}

export async function listDriverAssignments(
  tenantId: string
): Promise<ApiListResponse<DriverAssignmentItem>> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/driver-assignments`, {
    headers: authHeaders()
  });
  return asJson<{ items?: DriverAssignmentItem[] }>(response);
}

export async function createDriverAssignment(
  tenantId: string,
  body: CreateDriverAssignmentInput
): Promise<ApiMutationResponse> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/driver-assignments`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return asJson<Record<string, unknown>>(response);
}

export async function listApprovals(tenantId: string): Promise<ApiListResponse<TenantApprovalItem>> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/approvals`, {
    headers: authHeaders()
  });
  return asJson<{ items?: TenantApprovalItem[] }>(response);
}

export async function createApproval(
  tenantId: string,
  body: CreateApprovalInput
): Promise<ApiMutationResponse> {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/approvals`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return asJson<Record<string, unknown>>(response);
}
