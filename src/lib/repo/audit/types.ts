export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditActor {
  id: string;
  name: string;
  email?: string;
  tenantId?: string;
}

export interface AuditTarget {
  id: string;
  type: string;
  name?: string;
  path?: string;
}

export interface AuditEvent {
  id: string;
  ts: string;
  action: string;
  summary: string;
  actor: AuditActor;
  target: AuditTarget;
  source?: 'ui' | 'api' | 'scheduler';
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
  tenantId?: string;
}

export interface AuditListQuery {
  q?: string;
  user?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: 'ts' | 'action' | 'actor';
  order?: 'asc' | 'desc';
}

export interface AuditListResult {
  items: AuditEvent[];
  total: number;
}

export interface AuditAdapter {
  list(query: AuditListQuery): Promise<AuditListResult>;
  get(id: string): Promise<AuditEvent | null>;
}
