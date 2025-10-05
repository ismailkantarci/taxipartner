import { randomUUID } from 'node:crypto';

export interface ApprovalDecisionRecord {
  userId: string;
  at: string;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED';

export interface ApprovalRequestRecord {
  id: string;
  op: string;
  tenantId: string;
  targetId?: string;
  initiatorUserId: string;
  status: ApprovalStatus;
  approvals: ApprovalDecisionRecord[];
  createdAt: string;
  updatedAt: string;
}

const approvals = new Map<string, ApprovalRequestRecord>();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function listRequests(): ApprovalRequestRecord[] {
  return Array.from(approvals.values()).map((item) => clone(item));
}

export function loadRequest(id: string): ApprovalRequestRecord | undefined {
  const record = approvals.get(id);
  return record ? clone(record) : undefined;
}

export function saveRequest(record: ApprovalRequestRecord): ApprovalRequestRecord {
  const id = record.id || randomUUID();
  const payload: ApprovalRequestRecord = {
    ...record,
    id,
    updatedAt: new Date().toISOString()
  };
  approvals.set(id, payload);
  return clone(payload);
}

export function upsertRequest(record: ApprovalRequestRecord): ApprovalRequestRecord {
  return saveRequest(record);
}

export function resetRequests(): void {
  approvals.clear();
}
