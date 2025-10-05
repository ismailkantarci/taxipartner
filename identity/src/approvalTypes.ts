export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApprovalDecisionRecord {
  userId: string;
  role?: string;
  at: string;
}

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
