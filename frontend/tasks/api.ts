const API = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function asJson(response: Response) {
  const data = await response.json().catch(() => ({ ok: false, error: 'Beklenmeyen yanıt' }));
  return data;
}

export async function listTasks() {
  const response = await fetch(`${API}/tasks`, { headers: authHeaders() });
  return asJson(response);
}

export async function createTask(body: unknown) {
  const response = await fetch(`${API}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body ?? {})
  });
  return asJson(response);
}

export async function updateTask(id: string, body: unknown) {
  const response = await fetch(`${API}/tasks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body ?? {})
  });
  return asJson(response);
}

export async function deleteTask(id: string) {
  const response = await fetch(`${API}/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return asJson(response);
}

export async function runTask(id: string) {
  const response = await fetch(`${API}/tasks/${encodeURIComponent(id)}/run`, {
    method: 'POST',
    headers: authHeaders()
  });
  return asJson(response);
}
