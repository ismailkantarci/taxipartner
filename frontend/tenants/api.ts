import { t } from '../i18n/index';

const API_BASE = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const base = API_BASE;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const target = `${base}${normalizedPath}` || normalizedPath;
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

export async function listTenants(query = '') {
  const response = await fetch(buildUrl('/tenants', { q: query }), {
    headers: authHeaders()
  });
  return asJson(response);
}

export async function createTenant(body: any) {
  const response = await fetch(buildUrl('/tenants'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  });
  return asJson(response);
}

export async function assignTenantUser(tenantId: string, body: any) {
  const response = await fetch(buildUrl(`/tenants/${encodeURIComponent(tenantId)}/users`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  });
  return asJson(response);
}
