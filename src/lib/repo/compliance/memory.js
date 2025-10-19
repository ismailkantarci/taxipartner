import { nanoid } from 'nanoid';
import { normalizeError, RepositoryError } from '../index';
const SAMPLE_DATA = [
    {
        id: 'CP-001',
        name: 'ISO 27001 Package 2025',
        owner: 'Nina Kraus',
        category: 'packages',
        status: 'ok',
        updatedAt: '2024-09-20T10:10:00.000Z',
        items: 42,
        summary: 'Quarterly control evaluation set for ISO 27001.'
    },
    {
        id: 'CP-002',
        name: 'PCI DSS Gap Analysis',
        owner: 'Marco Huber',
        category: 'analysis',
        status: 'attention',
        updatedAt: '2024-10-02T08:55:00.000Z',
        items: 18,
        summary: 'Open items for Q3 PCI DSS remediation.'
    },
    {
        id: 'CP-003',
        name: 'Vendor Exception #921',
        owner: 'Eva Leitner',
        category: 'exceptions',
        status: 'blocked',
        updatedAt: '2024-10-12T14:30:00.000Z',
        items: 5,
        summary: 'Pending legal approval for third-party vendor exception.'
    },
    {
        id: 'CP-004',
        name: 'City Audit Findings 2024',
        owner: 'Samuel Öz',
        category: 'external-audit-findings',
        status: 'attention',
        updatedAt: '2024-09-29T09:10:00.000Z',
        items: 12,
        summary: 'Follow-up actions for Vienna city audit.'
    },
    {
        id: 'CP-005',
        name: 'KYC Compliance Exceptions',
        owner: 'Lena Berger',
        category: 'exceptions',
        status: 'ok',
        updatedAt: '2024-10-04T11:22:00.000Z',
        items: 7,
        summary: 'Documented KYC deviations requiring review.'
    },
    {
        id: 'CP-006',
        name: 'GDPR Processing Review',
        owner: 'Oliver Brandt',
        category: 'analysis',
        status: 'ok',
        updatedAt: '2024-10-07T07:45:00.000Z',
        items: 21,
        summary: 'Analysis of GDPR processing activities for EU region.'
    }
];
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const matchesSearch = (record, term) => {
    if (!term)
        return true;
    const value = term.trim().toLowerCase();
    if (!value.length)
        return true;
    return (record.name.toLowerCase().includes(value) ||
        record.owner.toLowerCase().includes(value) ||
        (record.summary ?? '').toLowerCase().includes(value) ||
        record.id.toLowerCase().includes(value));
};
const matchesStatus = (record, statuses) => {
    if (!statuses || statuses.length === 0)
        return true;
    return statuses.includes(record.status);
};
const sortRecords = (records, sort, order = 'asc') => {
    if (!sort)
        return records;
    const sorted = [...records];
    sorted.sort((a, b) => {
        const av = a[sort];
        const bv = b[sort];
        if (typeof av === 'number' && typeof bv === 'number') {
            return order === 'asc' ? av - bv : bv - av;
        }
        const as = String(av ?? '');
        const bs = String(bv ?? '');
        return order === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return sorted;
};
const paginate = (records, page = 0, pageSize = records.length) => {
    if (pageSize <= 0)
        return records;
    const start = page * pageSize;
    return records.slice(start, start + pageSize);
};
export const createMemoryComplianceAdapter = () => {
    let items = [...SAMPLE_DATA];
    const list = async (query) => {
        await delay(120);
        const filtered = items.filter(record => record.category === query.category &&
            matchesSearch(record, query.q) &&
            matchesStatus(record, query.status));
        const sorted = sortRecords(filtered, query.sort, query.order);
        const paginated = paginate(sorted, query.page, query.pageSize);
        return {
            items: paginated.map(record => ({ ...record })),
            total: filtered.length
        };
    };
    const get = async (id) => {
        await delay(100);
        const record = items.find(item => item.id === id);
        return record ? { ...record } : null;
    };
    const create = async (input) => {
        await delay(140);
        const timestamp = new Date().toISOString();
        const record = {
            id: nanoid(8).toUpperCase(),
            updatedAt: timestamp,
            ...input
        };
        items = [record, ...items];
        return { ...record };
    };
    const update = async (id, input) => {
        await delay(140);
        const index = items.findIndex(item => item.id === id);
        if (index === -1) {
            throw new RepositoryError('Compliance item not found', { statusCode: 404 });
        }
        const updated = {
            ...items[index],
            ...input,
            updatedAt: new Date().toISOString()
        };
        items = items.map(item => (item.id === id ? updated : item));
        return { ...updated };
    };
    const remove = async (id) => {
        await delay(120);
        const exists = items.some(item => item.id === id);
        if (!exists) {
            throw new RepositoryError('Compliance item not found', { statusCode: 404 });
        }
        items = items.filter(item => item.id !== id);
    };
    return {
        list: (query) => list(query).catch(error => {
            throw normalizeError(error, 'Failed to load compliance records');
        }),
        get: (id) => get(id).catch(error => {
            throw normalizeError(error, 'Failed to load compliance record');
        }),
        create: (input) => create(input).catch(error => {
            throw normalizeError(error, 'Failed to create compliance record');
        }),
        update: (id, input) => update(id, input).catch(error => {
            throw normalizeError(error, 'Failed to update compliance record');
        }),
        remove: (id) => remove(id).catch(error => {
            throw normalizeError(error, 'Failed to delete compliance record');
        })
    };
};
