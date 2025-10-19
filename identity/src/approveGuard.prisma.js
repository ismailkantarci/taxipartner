import { prisma } from './db.js';
function mapRow(row) {
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
export async function saveApproval(record) {
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
export async function updateApproval(record) {
    const updated = await prisma.approval.update({
        where: { id: record.id },
        data: {
            status: record.status,
            approvalsJson: JSON.stringify(record.approvals ?? [])
        }
    });
    return mapRow(updated);
}
export async function getApproval(id) {
    const row = await prisma.approval.findUnique({ where: { id } });
    return row ? mapRow(row) : null;
}
export async function listApprovals() {
    const rows = await prisma.approval.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(mapRow);
}
