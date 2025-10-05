let API_BASE = import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000';
while (API_BASE.endsWith('/')) {
  API_BASE = API_BASE.slice(0, -1);
}

function readToken(): string | null {
  const stored = localStorage.getItem('token');
  if (stored) return stored;
  const match = document.cookie.match(/(?:^|;\s*)tp_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function requireAuthToken(): string {
  const token = readToken();
  if (!token) {
    throw new Error('Kimlik doğrulama gerekli: lütfen giriş yaptıktan sonra tekrar deneyin.');
  }
  return token;
}

async function request(path: string, options: RequestInit = {}) {
  const token = requireAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  } as Record<string, string>;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `API error ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function listApprovals() {
  const data = await request('/approval/list');
  return data?.approvals ?? [];
}

export async function startApproval(op: string, tenantId: string, initiatorUserId: string, targetId?: string) {
  return request('/approval/start', {
    method: 'POST',
    body: JSON.stringify({ op, tenantId, targetId, initiatorUserId })
  });
}

export async function applyApproval(id: string, approverId: string) {
  return request(`/approval/${id}/apply`, {
    method: 'POST',
    body: JSON.stringify({ approverId })
  });
}
