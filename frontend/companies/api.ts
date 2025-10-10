import { t } from '../i18n/index';

const API_BASE = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const target = `${API_BASE}${normalizedPath}` || normalizedPath;
  if (!params) return target;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${target}?${query}` : target;
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function asJson(response: Response) {
  const json = await response.json().catch(() => ({ ok: false, error: t('errorGeneric') || 'Error' }));
  return { ok: response.ok && json?.ok !== false, status: response.status, ...json };
}

export async function listCompanies(tenantId: string, query = '') {
  const response = await fetch(buildUrl('/companies', { tenantId, q: query }), {
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}

export async function createCompany(tenantId: string, body: any) {
  const response = await fetch(buildUrl('/companies'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      'x-tenant-id': tenantId
    },
    body: JSON.stringify({ tenantId, ...body })
  });
  return asJson(response);
}

export async function getCompany(id: string, tenantId: string) {
  const response = await fetch(buildUrl(`/companies/${encodeURIComponent(id)}`, { tenantId }), {
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}

export async function updateCompany(id: string, tenantId: string, body: any) {
  const response = await fetch(buildUrl(`/companies/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      'x-tenant-id': tenantId
    },
    body: JSON.stringify(body)
  });
  return asJson(response);
}

export async function deleteCompany(id: string, tenantId: string) {
  const response = await fetch(buildUrl(`/companies/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}

export async function addOfficer(companyId: string, tenantId: string, payload: any) {
  const response = await fetch(buildUrl(`/companies/${encodeURIComponent(companyId)}/officers`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      'x-tenant-id': tenantId
    },
    body: JSON.stringify(payload)
  });
  return asJson(response);
}

export async function removeOfficer(companyId: string, officerId: string, tenantId: string) {
  const response = await fetch(buildUrl(`/companies/${encodeURIComponent(companyId)}/officers/${encodeURIComponent(officerId)}`), {
    method: 'DELETE',
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}

export async function addShareholder(companyId: string, tenantId: string, payload: any) {
  const response = await fetch(buildUrl(`/companies/${encodeURIComponent(companyId)}/shareholders`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      'x-tenant-id': tenantId
    },
    body: JSON.stringify(payload)
  });
  return asJson(response);
}

export async function removeShareholder(companyId: string, shareholderId: string, tenantId: string) {
  const response = await fetch(buildUrl(`/companies/${encodeURIComponent(companyId)}/shareholders/${encodeURIComponent(shareholderId)}`), {
    method: 'DELETE',
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}

export async function addCompanyDoc(companyId: string, tenantId: string, payload: any) {
  const response = await fetch(buildUrl(`/companies/${encodeURIComponent(companyId)}/documents`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      'x-tenant-id': tenantId
    },
    body: JSON.stringify(payload)
  });
  return asJson(response);
}

export async function removeCompanyDoc(companyId: string, docId: string, tenantId: string) {
  const response = await fetch(buildUrl(`/companies/${encodeURIComponent(companyId)}/documents/${encodeURIComponent(docId)}`), {
    method: 'DELETE',
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}
