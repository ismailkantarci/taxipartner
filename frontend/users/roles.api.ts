const API_BASE = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

import type { RoleItem } from './types';

type RolesResponse = { roles?: RoleItem[] };

export async function getRoles(): Promise<RoleItem[]> {
  const response = await fetch(`${API_BASE}/seed/roles`);
  try {
    const data: RolesResponse = await response.json();
    return Array.isArray(data.roles) ? data.roles : [];
  } catch {
    return [];
  }
}
