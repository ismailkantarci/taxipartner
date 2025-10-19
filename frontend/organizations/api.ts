import { buildAuthHeaders, buildJsonHeaders } from '../api/http';
import { t } from '../i18n/index';

const API = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

type HeaderMap = Record<string, string>;

const authHeaders = (): HeaderMap => buildAuthHeaders();
const jsonHeaders = (headers: HeaderMap = {}): HeaderMap => buildJsonHeaders(headers);

type ApiResponse<T = Record<string, unknown>> = T & {
  ok: boolean;
  status: number;
  error?: string;
};

async function asJson<T extends Record<string, unknown>>(response: Response): Promise<ApiResponse<T>> {
  const fallback = t('errorGeneric') || 'Error';
  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const ok = response.ok && raw?.ok !== false;
  const error =
    typeof raw.error === 'string'
      ? raw.error
      : !ok
      ? fallback
      : undefined;
  const { ok: _ignoredOk, error: _ignoredError, ...rest } = raw;
  return {
    ...(rest as T),
    ok,
    status: response.status,
    ...(error ? { error } : {})
  };
}

export type ListOrganizationsParams = {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: string;
};

export async function listOrganizations(tenantId: string, params: ListOrganizationsParams = {}) {
  const url = new URL(`${API}/tenants/${encodeURIComponent(tenantId)}/organizations`);
  if (params.query) url.searchParams.set('q', params.query);
  if (params.status) url.searchParams.set('status', params.status);
  if (typeof params.page === 'number') url.searchParams.set('page', String(params.page));
  if (typeof params.pageSize === 'number') url.searchParams.set('pageSize', String(params.pageSize));
  if (params.sort) url.searchParams.set('sort', params.sort);
  if (params.order) url.searchParams.set('order', params.order);
  const response = await fetch(url.toString(), { headers: authHeaders() });
  return asJson<{
    items?: Array<{
      id: string;
      name: string;
      orgType?: string | null;
      status: string;
      parentId?: string | null;
      companyId?: string | null;
      mandates?: number;
      updatedAt?: string;
    }>;
    total?: number;
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: string;
  }>(response);
}

export async function createOrganization(tenantId: string, body: any) {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/organizations`, {
    method: 'POST',
    headers: jsonHeaders(authHeaders()),
    body: JSON.stringify(body)
  });
  return asJson<{ organization?: Record<string, unknown> }>(response);
}

export async function getOrganization(tenantId: string, organizationId: string) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/organizations/${encodeURIComponent(organizationId)}`,
    { headers: authHeaders() }
  );
  return asJson<{ organization?: Record<string, unknown> }>(response);
}

export async function updateOrganization(tenantId: string, organizationId: string, body: any) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/organizations/${encodeURIComponent(organizationId)}`,
    {
      method: 'PUT',
      headers: jsonHeaders(authHeaders()),
      body: JSON.stringify(body)
    }
  );
  return asJson<{ organization?: Record<string, unknown> }>(response);
}

export async function deleteOrganization(tenantId: string, organizationId: string) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/organizations/${encodeURIComponent(organizationId)}`,
    {
      method: 'DELETE',
      headers: authHeaders()
    }
  );
  return asJson<Record<string, unknown>>(response);
}
