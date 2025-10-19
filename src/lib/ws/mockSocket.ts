import { appendAuditEvent } from '../repo/audit';
import type { AuditEvent } from '../repo/audit';
import { push } from '../notifications/store';

type AuditListener = (event: AuditEvent) => void;

const listeners = new Set<AuditListener>();
let timer: ReturnType<typeof setInterval> | null = null;

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const ACTORS = [
  { id: 'user-demo', name: 'Admin Demo', email: 'admin@test.dev' },
  { id: 'user-lisa', name: 'Lisa Graf', email: 'lisa.graf@taxipartner.dev' },
  { id: 'user-kai', name: 'Kai Öztürk', email: 'kai.ozturk@taxipartner.dev' }
];

const ACTIONS = [
  {
    action: 'auth.session.login',
    summary: 'Successful login'
  },
  {
    action: 'program.goal.updated',
    summary: 'Goal updated'
  },
  {
    action: 'risk.record.updated',
    summary: 'Risk severity changed'
  },
  {
    action: 'jobs.csv.completed',
    summary: 'CSV export completed'
  },
  {
    action: 'rbac.permission.denied',
    summary: 'Permission denied'
  }
];

const TARGETS = [
  { id: 'GOAL-014', type: 'goal', name: 'Expand EV Fleet' },
  { id: 'RISK-003', type: 'risk', name: 'Third-party Data Breach' },
  { id: 'COMP-008', type: 'compliance-package', name: 'Vienna KPI' },
  { id: 'session-auto', type: 'session' },
  { id: 'job-latest', type: 'job', name: 'Background export' }
];

const severities: Array<AuditEvent['severity']> = ['info', 'warning', 'critical'];

const emit = (event: AuditEvent) => {
  listeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error('[audit-mock] listener error', error);
    }
  });
};

const createEvent = (): AuditEvent => {
  const actor = pick(ACTORS);
  const template = pick(ACTIONS);
  const target = pick(TARGETS);
  const timestamp = new Date().toISOString();
  const severity = template.action === 'rbac.permission.denied' ? 'warning' : pick(severities);
  const event = appendAuditEvent({
    ts: timestamp,
    action: template.action,
    summary: `${template.summary} (${target.name ?? target.id})`,
    actor,
    target,
    severity,
    source: 'ui'
  });
  return event;
};

const startTimer = () => {
  if (timer) return;
  timer = setInterval(() => {
    const event = createEvent();
    push({
      type: 'info',
      title: 'New audit event',
      body: event.summary
    });
    emit(event);
  }, 45_000);
};

const stopTimer = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

export const subscribeAuditStream = (listener: AuditListener) => {
  listeners.add(listener);
  startTimer();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopTimer();
    }
  };
};

export const triggerAuditEvent = () => {
  const event = createEvent();
  push({
    type: 'info',
    title: 'New audit event',
    body: event.summary
  });
  emit(event);
};

