import { nanoid } from 'nanoid';
const SAMPLE_EVENTS = [
    {
        id: 'AUD-2024-001',
        ts: '2024-10-12T09:45:00.000Z',
        action: 'program.goal.created',
        summary: 'Program goal "Expand EV Fleet" created',
        actor: { id: 'user-demo', name: 'Admin Demo', email: 'admin@test.dev' },
        target: { id: 'GOAL-014', type: 'goal', name: 'Expand EV Fleet' },
        source: 'ui',
        severity: 'info',
        metadata: { status: 'in-progress' }
    },
    {
        id: 'AUD-2024-002',
        ts: '2024-10-11T18:05:00.000Z',
        action: 'compliance.package.updated',
        summary: 'Compliance package "Vienna KPI" updated: cadence changed to quarterly',
        actor: { id: 'user-lisa', name: 'Lisa Graf', email: 'lisa.graf@taxipartner.dev' },
        target: { id: 'COMP-008', type: 'compliance-package', name: 'Vienna KPI' },
        source: 'ui'
    },
    {
        id: 'AUD-2024-003',
        ts: '2024-10-11T06:22:00.000Z',
        action: 'auth.session.login',
        summary: 'Successful login from 185.16.12.24',
        actor: { id: 'user-marco', name: 'Marco Huber', email: 'marco.huber@taxipartner.dev' },
        target: { id: 'session-5f8', type: 'session' },
        source: 'api'
    },
    {
        id: 'AUD-2024-004',
        ts: '2024-10-10T13:17:00.000Z',
        action: 'risk.record.updated',
        summary: 'Risk "Payment Gateway Outage" status set to High',
        actor: { id: 'user-eva', name: 'Eva Leitner', email: 'eva.leitner@taxipartner.dev' },
        target: { id: 'RISK-001', type: 'risk', name: 'Payment Gateway Outage' },
        severity: 'warning',
        metadata: { prevStatus: 'moderate', status: 'high' },
        source: 'ui'
    },
    {
        id: 'AUD-2024-005',
        ts: '2024-10-09T23:41:00.000Z',
        action: 'jobs.csv.completed',
        summary: 'CSV export "goals-q4" completed (1,245 rows)',
        actor: { id: 'system-job', name: 'Background Job' },
        target: { id: 'job-824', type: 'job' },
        source: 'scheduler'
    }
];
let events = [...SAMPLE_EVENTS];
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const matchesTerm = (event, query) => {
    if (!query)
        return true;
    const search = query.trim().toLowerCase();
    if (!search)
        return true;
    return (event.summary.toLowerCase().includes(search) ||
        event.action.toLowerCase().includes(search) ||
        event.actor.name.toLowerCase().includes(search) ||
        (event.target.name ?? '').toLowerCase().includes(search) ||
        event.id.toLowerCase().includes(search));
};
const matchesUser = (event, user) => {
    if (!user)
        return true;
    return event.actor.id === user || event.actor.email === user;
};
const matchesAction = (event, action) => {
    if (!action)
        return true;
    return event.action === action;
};
const matchesWindow = (event, from, to) => {
    if (!from && !to)
        return true;
    const ts = new Date(event.ts).getTime();
    if (from && ts < new Date(from).getTime())
        return false;
    if (to && ts > new Date(to).getTime())
        return false;
    return true;
};
const sortEvents = (collection, sort, order = 'desc') => {
    const sorted = [...collection];
    if (!sort || sort === 'ts') {
        sorted.sort((a, b) => order === 'asc'
            ? new Date(a.ts).getTime() - new Date(b.ts).getTime()
            : new Date(b.ts).getTime() - new Date(a.ts).getTime());
        return sorted;
    }
    sorted.sort((a, b) => {
        const av = a[sort];
        const bv = b[sort];
        return order === 'asc'
            ? String(av ?? '').localeCompare(String(bv ?? ''))
            : String(bv ?? '').localeCompare(String(av ?? ''));
    });
    return sorted;
};
const paginate = (collection, page = 0, pageSize = 25) => {
    if (pageSize <= 0)
        return collection;
    const start = page * pageSize;
    return collection.slice(start, start + pageSize);
};
export const createMemoryAuditAdapter = () => ({
    async list(query) {
        await delay(120);
        const filtered = events.filter(event => matchesTerm(event, query.q) &&
            matchesUser(event, query.user) &&
            matchesAction(event, query.action) &&
            matchesWindow(event, query.from, query.to));
        const sorted = sortEvents(filtered, query.sort, query.order);
        const paginated = paginate(sorted, query.page, query.pageSize ?? 25);
        return {
            items: paginated.map(item => ({ ...item })),
            total: filtered.length
        };
    },
    async get(id) {
        await delay(80);
        const event = events.find(item => item.id === id);
        return event ? { ...event } : null;
    }
});
export const appendAuditEvent = (partial) => {
    const event = {
        ...partial,
        id: partial.id ?? `AUD-${nanoid(8).toUpperCase()}`
    };
    events = [event, ...events].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return event;
};
export const getAuditEventsSnapshot = () => events.map(event => ({ ...event }));
