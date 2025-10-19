import { STORAGE_KEY_AUTH_TOKEN } from '../ui/storageKeys';

export type HeaderMap = Record<string, string>;

export function getAuthToken(): string | null {
  return localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
}

export function buildAuthHeaders(): HeaderMap {
  const token = getAuthToken();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export function buildJsonHeaders(additional: HeaderMap = {}): HeaderMap {
  return { 'Content-Type': 'application/json', ...additional };
}
