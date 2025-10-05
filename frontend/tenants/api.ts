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

export async function listTenants(query = '') {
  const url = new URL(`${API}/tenants`);
  if (query) url.searchParams.set('q', query);
  const response = await fetch(url.toString(), {
    headers: authHeaders()
  });
  return asJson(response);
}

export async function createTenant(body: any) {
  const response = await fetch(`${API}/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  });
  return asJson(response);
}

export async function assignTenantUser(tenantId: string, body: any) {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  });
  return asJson(response);
}
