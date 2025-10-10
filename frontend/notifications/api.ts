const API_BASE = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

function buildUrl(path: string, params?: Record<string, string | undefined>) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const target = `${API_BASE}${normalizedPath}` || normalizedPath;
  if (!params) return target;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    search.set(key, value);
  }
  const query = search.toString();
  return query ? `${target}?${query}` : target;
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function asJson(response: Response) {
  const data = await response.json().catch(() => ({ ok: false, error: 'Beklenmeyen yanıt' }));
  return data;
}

export async function listNotifications(params: Record<string, string | undefined> = {}) {
  const response = await fetch(buildUrl('/notifications', params), { headers: authHeaders() });
  return asJson(response);
}

export async function markNotificationRead(id: string) {
  const response = await fetch(buildUrl(`/notifications/${encodeURIComponent(id)}/read`), {
    method: 'POST',
    headers: authHeaders()
  });
  return asJson(response);
}

export async function getUnreadCount(params: Record<string, string | undefined> = {}) {
  const response = await fetch(buildUrl('/notifications/unread/count', params), { headers: authHeaders() });
  return asJson(response) as Promise<{ ok: boolean; count?: number; error?: string }>;
}

export async function markAllUnreadAsRead(params: Record<string, string | undefined> = {}) {
  const response = await fetch(buildUrl('/notifications/unread/mark-all'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(params ?? {})
  });
  return asJson(response) as Promise<{ ok: boolean; updated?: number; error?: string }>;
}
