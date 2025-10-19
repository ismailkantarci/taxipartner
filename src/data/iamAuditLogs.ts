import type { IamAuditEvent } from './iamTypes';

export const iamSeedAuditEvents = [
  {
    id: 'evt-901',
    actor: 'nina.kraus@taxipartner.test',
    action: 'role.assign',
    target: 'marco.huber@taxipartner.test → Compliance Officer',
    ts: '2024-10-15T08:43:00Z',
    status: 'success'
  },
  {
    id: 'evt-902',
    actor: 'oliver.brandt@taxipartner.test',
    action: 'mfa.enforce',
    target: 'Fleet scoped users',
    ts: '2024-10-14T19:12:00Z',
    status: 'success'
  },
  {
    id: 'evt-903',
    actor: 'system@taxipartner',
    action: 'sync.failure',
    target: 'Tenant provisioning',
    ts: '2024-10-13T05:55:00Z',
    status: 'error'
  },
  {
    id: 'evt-904',
    actor: 'eva.leitner@taxipartner.test',
    action: 'permission.update',
    target: 'risk.review → Risk Analyst',
    ts: '2024-10-15T12:27:00Z',
    status: 'success'
  }
] satisfies IamAuditEvent[];
