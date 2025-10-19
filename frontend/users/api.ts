import { STORAGE_KEY_AUTH_TOKEN, STORAGE_KEY_TP_TOKEN_COOKIE } from '../ui/storageKeys';

let API_BASE = import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000';
while (API_BASE.endsWith('/')) {
  API_BASE = API_BASE.slice(0, -1);
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | (string & Record<never, never>);

export interface ApprovalApprover {
  userId: string;
}

export interface ApprovalItem {
  id: string;
  op: string;
  status: ApprovalStatus;
  initiatorUserId?: string | null;
  targetId?: string | null;
  approvals?: ApprovalApprover[];
}

type ApiRecord = Record<string, unknown>;

export type ApprovalListResponse = {
  approvals?: ApprovalItem[];
} & ApiRecord;

export type ApprovalMutationResponse = {
  ok: boolean;
  error?: string;
} & ApiRecord;

interface StartApprovalPayload {
  op: string;
  tenantId: string;
  initiatorUserId: string;
  targetId?: string;
}

interface ApplyApprovalPayload {
  approverId: string;
}

function readToken(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
  if (stored) return stored;
  const pattern = new RegExp(`(?:^|;\\s*)${STORAGE_KEY_TP_TOKEN_COOKIE}=([^;]+)`);
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

function requireAuthToken(): string {
  const token = readToken();
  if (!token) {
    throw new Error('Kimlik doğrulama gerekli: lütfen giriş yaptıktan sonra tekrar deneyin.');
  }
  return token;
}

function normalizeHeaders(init?: HeadersInit): Record<string, string> {
  if (!init) {
    return {};
  }
  if (init instanceof Headers) {
    const result: Record<string, string> = {};
    init.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  if (Array.isArray(init)) {
    return init.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }
  return { ...init };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = requireAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...normalizeHeaders(options.headers)
  };

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `API error ${response.status}`);
  }
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

export async function listApprovals(): Promise<ApprovalItem[]> {
  const data = await request<ApprovalListResponse>('/approval/list');
  return data.approvals ?? [];
}

export async function startApproval(
  op: string,
  tenantId: string,
  initiatorUserId: string,
  targetId?: string
): Promise<ApprovalMutationResponse> {
  const payload: StartApprovalPayload = { op, tenantId, targetId, initiatorUserId };
  return request<ApprovalMutationResponse>('/approval/start', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function applyApproval(id: string, approverId: string): Promise<ApprovalMutationResponse> {
  const payload: ApplyApprovalPayload = { approverId };
  return request<ApprovalMutationResponse>(`/approval/${id}/apply`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
