import { RepositoryError, normalizeError } from './index';
const INITIAL_DATA = [
    {
        id: 'GL-001',
        name: 'Fleet Compliance 2025',
        owner: 'Eva Leitner',
        dynamicStatus: 'ok',
        audits: 8,
        createdAt: '2024-01-10T09:21:00.000Z',
        updatedAt: '2024-09-28T14:12:00.000Z',
        lastAuditAt: '2024-09-01T11:00:00.000Z',
        summary: 'Ensures the TAXIPartner fleet meets local compliance requirements ahead of the 2025 renewal.'
    },
    {
        id: 'GL-002',
        name: 'Driver Safety Refresh',
        owner: 'Marco Huber',
        dynamicStatus: 'warn',
        audits: 5,
        createdAt: '2023-11-04T08:05:00.000Z',
        updatedAt: '2024-10-09T10:45:00.000Z',
        lastAuditAt: '2024-09-15T08:30:00.000Z',
        summary: 'Rework driver safety certifications and extend blended learning sessions to night shift staff.'
    },
    {
        id: 'GL-003',
        name: 'Multi-Tenant Billing',
        owner: 'Nina Schmidt',
        dynamicStatus: 'ok',
        audits: 3,
        createdAt: '2024-03-16T16:24:00.000Z',
        updatedAt: '2024-10-01T13:05:00.000Z',
        lastAuditAt: '2024-08-19T14:00:00.000Z',
        summary: 'Enable billing segmentation for multimodal partners without increasing operational overhead.'
    },
    {
        id: 'GL-004',
        name: 'Mandate Renewal Campaign',
        owner: 'Samuel Öz',
        dynamicStatus: 'risk',
        audits: 2,
        createdAt: '2023-07-22T10:17:00.000Z',
        updatedAt: '2024-09-26T07:48:00.000Z',
        lastAuditAt: '2024-07-29T09:15:00.000Z',
        summary: 'Coordinate outreach to city partners and unions to renew service mandates before year end.'
    },
    {
        id: 'GL-005',
        name: 'Incident Response Readiness',
        owner: 'Lena Berger',
        dynamicStatus: 'warn',
        audits: 7,
        createdAt: '2024-02-02T07:12:00.000Z',
        updatedAt: '2024-10-07T17:32:00.000Z',
        lastAuditAt: '2024-09-30T09:45:00.000Z',
        summary: 'Increase SecOps drill coverage and reduce average containment time for fleet-wide incidents.'
    },
    {
        id: 'GL-006',
        name: 'Zero Emission Fleet',
        owner: 'Oliver Brandt',
        dynamicStatus: 'ok',
        audits: 6,
        createdAt: '2022-12-11T08:41:00.000Z',
        updatedAt: '2024-09-19T15:22:00.000Z',
        lastAuditAt: '2024-08-02T10:10:00.000Z',
        summary: 'Phase-in EV adoption and supporting infrastructure across high-traffic partner hubs.'
    },
    {
        id: 'GL-007',
        name: 'Night Shift Safety',
        owner: 'Melanie Gruber',
        dynamicStatus: 'risk',
        audits: 4,
        createdAt: '2023-09-08T18:05:00.000Z',
        updatedAt: '2024-10-06T21:12:00.000Z',
        lastAuditAt: '2024-09-18T22:00:00.000Z',
        summary: 'Deploy improved panic alert flows and refresh on-prem security coverage for off-peak operations.'
    }
];
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const matchesSearch = (goal, term) => {
    const search = term.trim().toLowerCase();
    if (!search.length)
        return true;
    return (goal.name.toLowerCase().includes(search) ||
        goal.owner.toLowerCase().includes(search) ||
        goal.id.toLowerCase().includes(search) ||
        (goal.summary ?? '').toLowerCase().includes(search));
};
const matchesStatus = (goal, statuses) => {
    if (!statuses || statuses.length === 0)
        return true;
    return statuses.includes(goal.dynamicStatus);
};
const sortGoals = (goals, field, order = 'asc') => {
    if (!field) {
        return goals;
    }
    const sorted = [...goals];
    sorted.sort((a, b) => {
        const av = a[field];
        const bv = b[field];
        if (typeof av === 'number' && typeof bv === 'number') {
            return order === 'asc' ? av - bv : bv - av;
        }
        const as = String(av ?? '');
        const bs = String(bv ?? '');
        return order === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return sorted;
};
const paginate = (goals, page = 0, pageSize = goals.length) => {
    if (pageSize <= 0)
        return goals;
    const start = page * pageSize;
    return goals.slice(start, start + pageSize);
};
const createIdFactory = () => {
    let counter = INITIAL_DATA.length + 1;
    return () => `GL-${String(counter++).padStart(3, '0')}`;
};
const idFactory = createIdFactory();
export const createMemoryGoalsAdapter = () => {
    let items = [...INITIAL_DATA];
    const list = async (query) => {
        await delay(120);
        const filtered = items.filter(goal => matchesSearch(goal, query.search ?? '') && matchesStatus(goal, query.status));
        const sorted = sortGoals(filtered, query.sort, query.order);
        const paginated = paginate(sorted, query.page, query.pageSize);
        return {
            items: paginated.map(goal => ({ ...goal })),
            total: filtered.length
        };
    };
    const get = async (id) => {
        await delay(80);
        const goal = items.find(item => item.id === id);
        return goal ? { ...goal } : null;
    };
    const create = async (input) => {
        await delay(150);
        if (!input.name.trim() || !input.owner.trim()) {
            throw new RepositoryError('Goal name and owner are required.', { statusCode: 400 });
        }
        const timestamp = new Date().toISOString();
        const goal = {
            id: idFactory(),
            name: input.name.trim(),
            owner: input.owner.trim(),
            dynamicStatus: input.dynamicStatus,
            audits: input.audits,
            summary: input.summary ?? '',
            createdAt: timestamp,
            updatedAt: timestamp,
            lastAuditAt: timestamp
        };
        items = [goal, ...items];
        return { ...goal };
    };
    const update = async (id, input) => {
        await delay(140);
        const index = items.findIndex(goal => goal.id === id);
        if (index === -1) {
            throw new RepositoryError('Goal not found', { statusCode: 404 });
        }
        const previous = items[index];
        const updated = {
            ...previous,
            ...input,
            name: input.name !== undefined ? input.name.trim() : previous.name,
            owner: input.owner !== undefined ? input.owner.trim() : previous.owner,
            audits: input.audits ?? previous.audits,
            dynamicStatus: input.dynamicStatus ?? previous.dynamicStatus,
            summary: input.summary ?? previous.summary,
            updatedAt: new Date().toISOString()
        };
        items = items.map(goal => (goal.id === id ? updated : goal));
        return { ...updated };
    };
    const remove = async (id) => {
        await delay(120);
        const exists = items.some(goal => goal.id === id);
        if (!exists) {
            throw new RepositoryError('Goal not found', { statusCode: 404 });
        }
        items = items.filter(goal => goal.id !== id);
    };
    return {
        list: async (query) => {
            try {
                return await list(query);
            }
            catch (error) {
                throw normalizeError(error);
            }
        },
        get: async (id) => {
            try {
                return await get(id);
            }
            catch (error) {
                throw normalizeError(error);
            }
        },
        create: async (input) => {
            try {
                return await create(input);
            }
            catch (error) {
                throw normalizeError(error);
            }
        },
        update: async (id, input) => {
            try {
                return await update(id, input);
            }
            catch (error) {
                throw normalizeError(error);
            }
        },
        remove: async (id) => {
            try {
                await remove(id);
            }
            catch (error) {
                throw normalizeError(error);
            }
        }
    };
};
