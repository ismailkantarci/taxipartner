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

function authz(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listAudit(params: Record<string, string | number | undefined>) {
  const response = await fetch(buildUrl('/audit', params), { headers: authz() });
  return response.json();
}

export async function getAudit(id: string) {
  const response = await fetch(`${API_BASE}/audit/${encodeURIComponent(id)}`, {
    headers: authz()
  });
  return response.json();
}

export function exportCSV(params: Record<string, string | number | undefined>) {
  window.open(buildUrl('/audit/export/csv', params), '_blank');
}
