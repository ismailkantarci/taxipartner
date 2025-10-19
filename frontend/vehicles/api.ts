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

export type ListVehiclesParams = {
  query?: string;
  companyId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: string;
};

export async function listVehicles(tenantId: string, params: ListVehiclesParams = {}) {
  const url = new URL(`${API}/tenants/${encodeURIComponent(tenantId)}/vehicles`);
  if (params.query) url.searchParams.set('q', params.query);
  if (params.companyId) url.searchParams.set('companyId', params.companyId);
  if (params.status) url.searchParams.set('status', params.status);
  if (typeof params.page === 'number') url.searchParams.set('page', String(params.page));
  if (typeof params.pageSize === 'number') url.searchParams.set('pageSize', String(params.pageSize));
  if (params.sort) url.searchParams.set('sort', params.sort);
  if (params.order) url.searchParams.set('order', params.order);
  const response = await fetch(url.toString(), {
    headers: authHeaders()
  });
  return asJson<{
    items?: Array<{
      vehicleId: string;
      vin: string;
      plateNo?: string | null;
      seatCount?: number | null;
      usage?: string | null;
      status: string;
      companyId: string;
      companyName?: string | null;
      updatedAt?: string;
      validTo?: string | null;
    }>;
    total?: number;
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: string;
  }>(response);
}

export async function createVehicle(tenantId: string, body: any) {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/vehicles`, {
    method: 'POST',
    headers: jsonHeaders(authHeaders()),
    body: JSON.stringify(body)
  });
  return asJson<{ vehicle?: Record<string, unknown> }>(response);
}

export async function getVehicle(tenantId: string, vehicleId: string) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/vehicles/${encodeURIComponent(vehicleId)}`,
    { headers: authHeaders() }
  );
  return asJson<{ vehicle?: Record<string, unknown> }>(response);
}

export async function updateVehicle(tenantId: string, vehicleId: string, body: any) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/vehicles/${encodeURIComponent(vehicleId)}`,
    {
      method: 'PUT',
      headers: jsonHeaders(authHeaders()),
      body: JSON.stringify(body)
    }
  );
  return asJson<{ vehicle?: Record<string, unknown> }>(response);
}

export async function archiveVehicle(
  tenantId: string,
  vehicleId: string,
  body: { note?: string | null } = {}
) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/vehicles/${encodeURIComponent(vehicleId)}`,
    {
      method: 'DELETE',
      headers: jsonHeaders(authHeaders()),
      body: JSON.stringify(body)
    }
  );
  return asJson<Record<string, unknown>>(response);
}
