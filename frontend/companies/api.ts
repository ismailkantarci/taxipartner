import { t } from '../i18n/index';

const API = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function asJson(response: Response) {
  const json = await response.json().catch(() => ({ ok: false, error: t('errorGeneric') || 'Error' }));
  return { ok: response.ok && json?.ok !== false, status: response.status, ...json };
}

export async function listCompanies(tenantId: string, query = '') {
  const url = new URL(`${API}/companies`);
  if (tenantId) url.searchParams.set('tenantId', tenantId);
  if (query) url.searchParams.set('q', query);
  const response = await fetch(url.toString(), {
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}

export async function createCompany(tenantId: string, body: any) {
  const response = await fetch(`${API}/companies`, {
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
  const url = new URL(`${API}/companies/${encodeURIComponent(id)}`);
  if (tenantId) url.searchParams.set('tenantId', tenantId);
  const response = await fetch(url.toString(), {
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}

export async function updateCompany(id: string, tenantId: string, body: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(id)}`, {
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
  const response = await fetch(`${API}/companies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}

export async function addOfficer(companyId: string, tenantId: string, payload: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/officers`, {
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
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/officers/${encodeURIComponent(officerId)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}

export async function addShareholder(companyId: string, tenantId: string, payload: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/shareholders`, {
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
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/shareholders/${encodeURIComponent(shareholderId)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}

export async function addCompanyDoc(companyId: string, tenantId: string, payload: any) {
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/documents`, {
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
  const response = await fetch(`${API}/companies/${encodeURIComponent(companyId)}/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'x-tenant-id': tenantId }
  });
  return asJson(response);
}
