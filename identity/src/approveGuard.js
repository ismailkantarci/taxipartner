import { randomUUID } from 'node:crypto';
import { getApproval, saveApproval, updateApproval } from './approveGuard.prisma.js';
function ensureCanInitiate(user) {
    if (!user.roles?.length) {
        throw new Error('Onay talebi oluşturmak için yetkili bir rol bulunamadı.');
    }
}
function ensureCanApprove(user, request) {
    if (request.initiatorUserId === user.id) {
        throw new Error('Başlatıcı kendi talebini onaylayamaz.');
    }
    if (!user.roles?.includes('Superadmin')) {
        throw new Error('Onaylamak için uygun yetkiye sahip değilsiniz.');
    }
}
export async function createApprovalRequest(params) {
    ensureCanInitiate(params.initiator);
    const record = {
        id: randomUUID(),
        op: params.op,
        tenantId: params.tenantId,
        targetId: params.targetId,
        initiatorUserId: params.initiator.id,
        status: 'PENDING',
        approvals: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    return saveApproval(record);
}
export function isApproved(request) {
    return request.status === 'APPROVED';
}
export async function applyApproval(id, approver) {
    const request = await getApproval(id);
    if (!request) {
        throw new Error('Onay kaydı bulunamadı.');
    }
    ensureCanApprove(approver, request);
    if (request.status !== 'PENDING') {
        return request;
    }
    const decisions = request.approvals || [];
    if (decisions.some((item) => item.userId === approver.id)) {
        throw new Error('Bu kullanıcı zaten onaylamış.');
    }
    decisions.push({ userId: approver.id, at: new Date().toISOString() });
    if (decisions.length >= 2) {
        request.status = 'APPROVED';
    }
    request.approvals = decisions;
    request.updatedAt = new Date().toISOString();
    return updateApproval(request);
}
