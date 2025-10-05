const API = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function asJson(response: Response) {
  const data = await response.json().catch(() => ({ ok: false, error: 'Beklenmeyen yanıt' }));
  return data;
}

export async function listNotifications(params: Record<string, string | undefined> = {}) {
  const url = new URL(`${API}/notifications`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), { headers: authHeaders() });
  return asJson(response);
}

export async function markNotificationRead(id: string) {
  const response = await fetch(`${API}/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
    headers: authHeaders()
  });
  return asJson(response);
}

export async function getUnreadCount(params: Record<string, string | undefined> = {}) {
  const url = new URL(`${API}/notifications/unread/count`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), { headers: authHeaders() });
  return asJson(response) as Promise<{ ok: boolean; count?: number; error?: string }>;
}

export async function markAllUnreadAsRead(params: Record<string, string | undefined> = {}) {
  const response = await fetch(`${API}/notifications/unread/mark-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(params ?? {})
  });
  return asJson(response) as Promise<{ ok: boolean; updated?: number; error?: string }>;
}
