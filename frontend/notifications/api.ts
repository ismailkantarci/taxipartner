import { buildAuthHeaders, buildJsonHeaders } from '../api/http';

const API = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

export interface NotificationItem {
  id: string;
  channel: string;
  subject?: string | null;
  body?: string | null;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationsResponse {
  ok: boolean;
  items?: NotificationItem[];
  error?: string;
}

export interface NotificationMutationResponse {
  ok: boolean;
  error?: string;
}

export interface UnreadCountResponse {
  ok: boolean;
  count?: number;
  error?: string;
}

export interface MarkAllUnreadResponse {
  ok: boolean;
  updated?: number;
  error?: string;
}

async function asJson<T extends { ok?: boolean; error?: string }>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return { ok: false, error: 'Beklenmeyen yanıt' } as T;
  }
}

export async function listNotifications(params: Record<string, string | undefined> = {}): Promise<NotificationsResponse> {
  const url = new URL(`${API}/notifications`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), { headers: buildAuthHeaders() });
  return asJson<NotificationsResponse>(response);
}

export async function markNotificationRead(id: string): Promise<NotificationMutationResponse> {
  const response = await fetch(`${API}/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
    headers: buildAuthHeaders()
  });
  return asJson<NotificationMutationResponse>(response);
}

export async function getUnreadCount(params: Record<string, string | undefined> = {}): Promise<UnreadCountResponse> {
  const url = new URL(`${API}/notifications/unread/count`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), { headers: buildAuthHeaders() });
  return asJson<UnreadCountResponse>(response);
}

export async function markAllUnreadAsRead(params: Record<string, string | undefined> = {}): Promise<MarkAllUnreadResponse> {
  const response = await fetch(`${API}/notifications/unread/mark-all`, {
    method: 'POST',
    headers: buildJsonHeaders(buildAuthHeaders()),
    body: JSON.stringify(params ?? {})
  });
  return asJson<MarkAllUnreadResponse>(response);
}
