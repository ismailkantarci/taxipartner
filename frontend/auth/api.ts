import { buildAuthHeaders, buildJsonHeaders } from '../api/http';
import type { JsonValue } from '../types/json';

const API = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

type JsonRecord = Record<string, JsonValue>;

export interface LoginResponse {
  ok: boolean;
  token?: string;
  userId?: string;
  mfa_required?: boolean;
  error?: string;
  [key: string]: JsonValue | undefined;
}

export interface InviteAcceptPayload {
  token: string;
  password: string;
  totp?: {
    setup?: boolean;
    code?: string;
  };
}

export interface InviteAcceptResponse {
  ok: boolean;
  qrDataUrl?: string;
  error?: string;
  [key: string]: JsonValue | undefined;
}

export interface InviteCreatePayload {
  email: string;
  roles?: string[];
  locale?: string;
  [key: string]: JsonValue | undefined;
}

export interface InviteCreateResponse {
  ok: boolean;
  error?: string;
  [key: string]: JsonValue | undefined;
}

export async function me(): Promise<JsonRecord> {
  const headers = buildAuthHeaders();
  const response = await fetch(`${API}/auth/me`, {
    headers: Object.keys(headers).length ? headers : undefined
  });
  return (await response.json()) as JsonRecord;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ email, password })
  });
  return (await response.json()) as LoginResponse;
}

export async function inviteAccept(payload: InviteAcceptPayload): Promise<InviteAcceptResponse> {
  const response = await fetch(`${API}/invite/accept`, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload)
  });
  return (await response.json()) as InviteAcceptResponse;
}

export async function inviteCreate(payload: InviteCreatePayload): Promise<InviteCreateResponse> {
  const response = await fetch(`${API}/invite/create`, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload)
  });
  return (await response.json()) as InviteCreateResponse;
}
