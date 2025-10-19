import { buildAuthHeaders, buildJsonHeaders } from '../api/http';
import { t } from '../i18n/index';

const API = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

type HeaderMap = Record<string, string>;

const authHeaders = (): HeaderMap => {
  return buildAuthHeaders();
};

const tenantHeaders = (tenantId: string): HeaderMap => ({
  ...authHeaders(),
  'x-tenant-id': tenantId
});

const companyHeaders = (tenantId: string, companyId: string): HeaderMap => ({
  ...authHeaders(),
  'x-tenant-id': tenantId,
  'x-company-id': companyId
});

const jsonHeaders = (headers: HeaderMap = {}): HeaderMap => buildJsonHeaders(headers);
const tenantJsonHeaders = (tenantId: string): HeaderMap => jsonHeaders(tenantHeaders(tenantId));
const companyJsonHeaders = (tenantId: string, companyId: string): HeaderMap =>
  jsonHeaders(companyHeaders(tenantId, companyId));

async function asJson(response: Response) {
  const json = await response.json().catch(() => ({ ok: false, error: t('errorGeneric') || 'Error' }));
  return { ok: response.ok && json?.ok !== false, status: response.status, ...json };
}

export type CompanySortKey = 'name' | 'status' | 'companyid';
export type CompanyOrder = 'asc' | 'desc';

export type ListCompaniesParams = {
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: CompanySortKey;
  order?: CompanyOrder;
};

export async function listCompanies(tenantId: string, params: ListCompaniesParams = {}) {
  const url = new URL(`${API}/tenants/${encodeURIComponent(tenantId)}/companies`);
  if (params.query) url.searchParams.set('q', params.query);
  if (typeof params.page === 'number') url.searchParams.set('page', String(params.page));
  if (typeof params.pageSize === 'number') url.searchParams.set('pageSize', String(params.pageSize));
  if (params.sort) url.searchParams.set('sort', params.sort);
  if (params.order) url.searchParams.set('order', params.order);
  const response = await fetch(url.toString(), {
    headers: tenantHeaders(tenantId)
  });
  return asJson(response);
}

export async function createCompany(tenantId: string, body: any) {
  const response = await fetch(`${API}/companies`, {
    method: 'POST',
    headers: tenantJsonHeaders(tenantId),
    body: JSON.stringify(body)
  });
  return asJson(response);
}

export async function getCompany(id: string, tenantId: string) {
  const url = new URL(`${API}/companies/${encodeURIComponent(id)}`);
  const response = await fetch(url.toString(), {
    headers: companyHeaders(tenantId, id)
  });
  return asJson(response);
}

export async function updateCompany(id: string, tenantId: string, body: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: companyJsonHeaders(tenantId, id),
    body: JSON.stringify(body)
  });
  return asJson(response);
}

export async function deleteCompany(id: string, tenantId: string) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: companyHeaders(tenantId, id)
  });
  return asJson(response);
}

export async function addOfficer(companyId: string, tenantId: string, payload: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/officers`, {
    method: 'POST',
    headers: companyJsonHeaders(tenantId, companyId),
    body: JSON.stringify(payload)
  });
  return asJson(response);
}

export async function removeOfficer(companyId: string, officerId: string, tenantId: string) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/officers/${encodeURIComponent(officerId)}`, {
    method: 'DELETE',
    headers: companyHeaders(tenantId, companyId)
  });
  return asJson(response);
}

export async function addShareholder(companyId: string, tenantId: string, payload: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/shareholders`, {
    method: 'POST',
    headers: companyJsonHeaders(tenantId, companyId),
    body: JSON.stringify(payload)
  });
  return asJson(response);
}

export async function removeShareholder(companyId: string, shareholderId: string, tenantId: string) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/shareholders/${encodeURIComponent(shareholderId)}`, {
    method: 'DELETE',
    headers: companyHeaders(tenantId, companyId)
  });
  return asJson(response);
}

export async function addCompanyDoc(companyId: string, tenantId: string, payload: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/documents`, {
    method: 'POST',
    headers: companyJsonHeaders(tenantId, companyId),
    body: JSON.stringify(payload)
  });
  return asJson(response);
}

export async function removeCompanyDoc(companyId: string, docId: string, tenantId: string) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: companyHeaders(tenantId, companyId)
  });
  return asJson(response);
}

export async function createPermitVehicle(companyId: string, permitId: string, tenantId: string, payload: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/permits/${encodeURIComponent(permitId)}/vehicles`, {
    method: 'POST',
    headers: companyJsonHeaders(tenantId, companyId),
    body: JSON.stringify(payload)
  });
  return asJson(response);
}

export async function revokePermitVehicle(companyId: string, permitId: string, authorizationId: string, tenantId: string, payload: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/permits/${encodeURIComponent(permitId)}/vehicles/${encodeURIComponent(authorizationId)}/revoke`, {
    method: 'POST',
    headers: companyJsonHeaders(tenantId, companyId),
    body: JSON.stringify(payload)
  });
  return asJson(response);
}

export async function listPermits(companyId: string, tenantId: string) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/permits`, {
    headers: companyHeaders(tenantId, companyId)
  });
  return asJson(response);
}

export async function createPermit(companyId: string, tenantId: string, body: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/permits`, {
    method: 'POST',
    headers: companyJsonHeaders(tenantId, companyId),
    body: JSON.stringify({ ...body, companyId })
  });
  return asJson(response);
}

export async function updatePermit(companyId: string, permitId: string, tenantId: string, body: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/permits/${encodeURIComponent(permitId)}`, {
    method: 'PUT',
    headers: companyJsonHeaders(tenantId, companyId),
    body: JSON.stringify({ ...body, companyId })
  });
  return asJson(response);
}

export async function addPermitEvent(companyId: string, permitId: string, tenantId: string, body: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/permits/${encodeURIComponent(permitId)}/events`, {
    method: 'POST',
    headers: companyJsonHeaders(tenantId, companyId),
    body: JSON.stringify({ ...body, companyId })
  });
  return asJson(response);
}
