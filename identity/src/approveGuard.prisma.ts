import { prisma } from './db.js';
import type { ApprovalRequestRecord } from './approvalTypes.js';

function mapRow(row: any): ApprovalRequestRecord {
  return {
    id: row.id,
    op: row.op,
    tenantId: row.tenantId,
    targetId: row.targetId ?? undefined,
    initiatorUserId: row.initiatorUserId,
    status: row.status,
    approvals: row.approvalsJson ? JSON.parse(row.approvalsJson) : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function saveApproval(record: ApprovalRequestRecord): Promise<ApprovalRequestRecord> {
  const created = await prisma.approval.create({
    data: {
      id: record.id,
      op: record.op,
      tenantId: record.tenantId,
      targetId: record.targetId ?? null,
      initiatorUserId: record.initiatorUserId,
      status: record.status,
      approvalsJson: JSON.stringify(record.approvals ?? [])
    }
  });
  return mapRow(created);
}

export async function updateApproval(record: ApprovalRequestRecord): Promise<ApprovalRequestRecord> {
  const updated = await prisma.approval.update({
    where: { id: record.id },
    data: {
      status: record.status,
      approvalsJson: JSON.stringify(record.approvals ?? [])
    }
  });
  return mapRow(updated);
}

export async function getApproval(id: string): Promise<ApprovalRequestRecord | null> {
  const row = await prisma.approval.findUnique({ where: { id } });
  return row ? mapRow(row) : null;
}

export async function listApprovals(): Promise<ApprovalRequestRecord[]> {
  const rows = await prisma.approval.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(mapRow);
}
