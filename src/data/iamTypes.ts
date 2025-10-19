export type IamRole = {
  name: string;
  description: string;
  permissions: string[];
};

export type IamPermission = {
  key: string;
  scope: string;
  description: string;
};

export type IamSessionStatus = 'active' | 'revoked';

export type IamSession = {
  id: string;
  userEmail: string;
  device: string;
  location: string;
  lastSeen: string;
  status: IamSessionStatus;
};

export type IamUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

export type IamAuditEventStatus = 'success' | 'error';

export type IamAuditEvent = {
  id: string;
  actor: string;
  action: string;
  target: string;
  ts: string;
  status: IamAuditEventStatus;
};
