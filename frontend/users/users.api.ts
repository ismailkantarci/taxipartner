const API_BASE = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

import type { Paging, UserDetail, UserSummary } from './types';

export type ListResponse = { ok: boolean; users: UserSummary[]; paging: Paging; error?: string };
export type DetailResponse = { ok: boolean; user: UserDetail; error?: string };
export type CreateResponse = { ok: boolean; user: UserDetail; error?: string };
export type AssignResponse = { ok: boolean; user: UserDetail; error?: string };
export type RevokeResponse = { ok: boolean; user: UserDetail; error?: string };
export type PermissionsResponse = { ok: boolean; allow: string[]; error?: string };
export type RemoveRoleResponse = { ok: boolean; user?: UserDetail; error?: string };

function buildUrl(path: string, params?: Record<string, string | number | undefined | null>) {
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function readToken(): string | null {
  const stored = localStorage.getItem('token');
  if (stored) return stored;
  const cookieMatch = document.cookie.match(/(?:^|;\s*)tp_token=([^;]+)/);
  return cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
}

function authz() {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jsonFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Geçersiz sunucu yanıtı');
  }
}

export async function listUsers(q = '', skip = 0, take = 50): Promise<ListResponse> {
  const url = buildUrl('/api/users', { q, skip, take });
  return jsonFetch<ListResponse>(url, { headers: authz() });
}

export async function getUser(id: string): Promise<DetailResponse> {
  return jsonFetch<DetailResponse>(`${API_BASE}/api/users/${id}`, { headers: authz() });
}

export async function createUser(email?: string): Promise<CreateResponse> {
  return jsonFetch<CreateResponse>(`${API_BASE}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authz() },
    body: JSON.stringify({ email })
  });
}

export async function assignRole(
  userId: string,
  body: { role: string; claims?: unknown | null }
): Promise<AssignResponse> {
  return jsonFetch<AssignResponse>(`${API_BASE}/api/users/${userId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authz() },
    body: JSON.stringify(body)
  });
}

export async function revokeSessions(userId: string): Promise<RevokeResponse> {
  return jsonFetch<RevokeResponse>(`${API_BASE}/api/users/${userId}/revoke`, {
    method: 'POST',
    headers: { ...authz() }
  });
}

export async function getUserPermissions(userId: string): Promise<PermissionsResponse> {
  return jsonFetch<PermissionsResponse>(`${API_BASE}/api/users/${userId}/permissions`, {
    headers: authz()
  });
}

export async function removeRole(userId: string, role: string): Promise<RemoveRoleResponse> {
  return jsonFetch<RemoveRoleResponse>(
    `${API_BASE}/api/users/${userId}/roles/${encodeURIComponent(role)}`,
    {
      method: 'DELETE',
      headers: authz()
    }
  );
}
