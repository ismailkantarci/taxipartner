const API_BASE = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

function authz(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listAudit(params: Record<string, string | number | undefined>) {
  const url = new URL(`${API_BASE}/audit`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  const response = await fetch(url.toString(), { headers: authz() });
  return response.json();
}

export async function getAudit(id: string) {
  const response = await fetch(`${API_BASE}/audit/${encodeURIComponent(id)}`, {
    headers: authz()
  });
  return response.json();
}

export function exportCSV(params: Record<string, string | number | undefined>) {
  const url = new URL(`${API_BASE}/audit/export/csv`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  window.open(url.toString(), '_blank');
}
