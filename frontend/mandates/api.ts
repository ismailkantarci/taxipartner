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

export type ListMandatesParams = {
  query?: string;
  status?: string;
  organizationId?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: string;
};

export async function listMandates(tenantId: string, params: ListMandatesParams = {}) {
  const url = new URL(`${API}/tenants/${encodeURIComponent(tenantId)}/mandates`);
  if (params.query) url.searchParams.set('q', params.query);
  if (params.status) url.searchParams.set('status', params.status);
  if (params.organizationId) url.searchParams.set('organizationId', params.organizationId);
  if (typeof params.page === 'number') url.searchParams.set('page', String(params.page));
  if (typeof params.pageSize === 'number') url.searchParams.set('pageSize', String(params.pageSize));
  if (params.sort) url.searchParams.set('sort', params.sort);
  if (params.order) url.searchParams.set('order', params.order);
  const response = await fetch(url.toString(), { headers: authHeaders() });
  return asJson<{
    items?: Array<{
      id: string;
      title: string;
      mandateType: string;
      status: string;
      validFrom?: string | null;
      validTo?: string | null;
      organization?: { id: string; name: string } | null;
      companyId?: string | null;
      updatedAt?: string;
    }>;
    total?: number;
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: string;
  }>(response);
}

export async function createMandate(tenantId: string, body: any) {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/mandates`, {
    method: 'POST',
    headers: jsonHeaders(authHeaders()),
    body: JSON.stringify(body)
  });
  return asJson<{ mandate?: Record<string, unknown> }>(response);
}

export async function getMandate(tenantId: string, mandateId: string) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/mandates/${encodeURIComponent(mandateId)}`,
    { headers: authHeaders() }
  );
  return asJson<{ mandate?: Record<string, unknown> }>(response);
}

export async function updateMandate(tenantId: string, mandateId: string, body: any) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/mandates/${encodeURIComponent(mandateId)}`,
    {
      method: 'PUT',
      headers: jsonHeaders(authHeaders()),
      body: JSON.stringify(body)
    }
  );
  return asJson<{ mandate?: Record<string, unknown> }>(response);
}

export async function deleteMandate(tenantId: string, mandateId: string) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/mandates/${encodeURIComponent(mandateId)}`,
    {
      method: 'DELETE',
      headers: authHeaders()
    }
  );
  return asJson<Record<string, unknown>>(response);
}
