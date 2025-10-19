import { nanoid } from 'nanoid';
import { normalizeError, RepositoryError } from '../index';
import type {
  CreateRiskInput,
  RiskListQuery,
  RiskListResult,
  RiskRecord,
  RiskStatus,
  UpdateRiskInput
} from './types';

const SAMPLE_RISKS: RiskRecord[] = [
  {
    id: 'RISK-001',
    title: 'Payment Gateway Outage',
    owner: 'Nina Kraus',
    status: 'high',
    impact: 'high',
    likelihood: 'possible',
    updatedAt: '2024-10-04T09:12:00.000Z',
    description: 'Critical payment provider outage risk for weekend operations.',
    controls: 5
  },
  {
    id: 'RISK-002',
    title: 'Data Center Cooling Failure',
    owner: 'Marco Huber',
    status: 'moderate',
    impact: 'medium',
    likelihood: 'unlikely',
    updatedAt: '2024-09-29T17:42:00.000Z',
    description: 'Aging cooling units could impact Vienna data center.',
    controls: 3
  },
  {
    id: 'RISK-003',
    title: 'Third-party Data Breach',
    owner: 'Eva Leitner',
    status: 'high',
    impact: 'high',
    likelihood: 'likely',
    updatedAt: '2024-10-10T10:55:00.000Z',
    description: 'Vendor handles PII; SOC2 remediation pending.',
    controls: 6
  },
  {
    id: 'RISK-004',
    title: 'Regulatory Fine - GDPR',
    owner: 'Samuel Öz',
    status: 'moderate',
    impact: 'high',
    likelihood: 'possible',
    updatedAt: '2024-09-15T08:05:00.000Z',
    description: 'GDPR data subject access request backlog.',
    controls: 4
  },
  {
    id: 'RISK-005',
    title: 'Fleet Vehicle Shortage',
    owner: 'Lena Berger',
    status: 'low',
    impact: 'medium',
    likelihood: 'possible',
    updatedAt: '2024-09-18T12:15:00.000Z',
    description: 'Vehicle maintenance downtime causing coverage gaps.',
    controls: 2
  }
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const matchesSearch = (record: RiskRecord, term?: string) => {
  if (!term) return true;
  const search = term.trim().toLowerCase();
  if (!search.length) return true;
  return (
    record.title.toLowerCase().includes(search) ||
    record.owner.toLowerCase().includes(search) ||
    record.id.toLowerCase().includes(search) ||
    (record.description ?? '').toLowerCase().includes(search)
  );
};

const matchesStatus = (record: RiskRecord, statuses?: RiskStatus[]) => {
  if (!statuses || statuses.length === 0) return true;
  return statuses.includes(record.status);
};

const sortRecords = (records: RiskRecord[], sort?: string, order: 'asc' | 'desc' = 'asc') => {
  if (!sort) return records;
  const sorted = [...records];
  sorted.sort((a, b) => {
    const av = (a as Record<string, unknown>)[sort];
    const bv = (b as Record<string, unknown>)[sort];
    if (typeof av === 'number' && typeof bv === 'number') {
      return order === 'asc' ? av - bv : bv - av;
    }
    const as = String(av ?? '');
    const bs = String(bv ?? '');
    return order === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
  });
  return sorted;
};

const paginate = (records: RiskRecord[], page = 0, pageSize = records.length) => {
  if (pageSize <= 0) return records;
  const start = page * pageSize;
  return records.slice(start, start + pageSize);
};

export const createMemoryRiskAdapter = () => {
  let items = [...SAMPLE_RISKS];

  const list = async (query: RiskListQuery): Promise<RiskListResult> => {
    await delay(120);
    const filtered = items.filter(record => matchesSearch(record, query.q) && matchesStatus(record, query.status));
    const sorted = sortRecords(filtered, query.sort, query.order);
    const paginated = paginate(sorted, query.page, query.pageSize);
    return {
      items: paginated.map(record => ({ ...record })),
      total: filtered.length
    };
  };

  const get = async (id: string) => {
    await delay(100);
    const record = items.find(item => item.id === id);
    return record ? { ...record } : null;
  };

  const create = async (input: CreateRiskInput) => {
    await delay(140);
    const timestamp = new Date().toISOString();
    const record: RiskRecord = {
      id: `RISK-${nanoid(6).toUpperCase()}`,
      updatedAt: timestamp,
      ...input
    };
    items = [record, ...items];
    return { ...record };
  };

  const update = async (id: string, input: UpdateRiskInput) => {
    await delay(140);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) {
      throw new RepositoryError('Risk not found', { statusCode: 404 });
    }
    const updated: RiskRecord = {
      ...items[index],
      ...input,
      updatedAt: new Date().toISOString()
    };
    items = items.map(item => (item.id === id ? updated : item));
    return { ...updated };
  };

  const remove = async (id: string) => {
    await delay(120);
    const exists = items.some(item => item.id === id);
    if (!exists) {
      throw new RepositoryError('Risk not found', { statusCode: 404 });
    }
    items = items.filter(item => item.id !== id);
  };

  return {
    list: (query: RiskListQuery) =>
      list(query).catch(error => {
        throw normalizeError(error, 'Failed to load risks');
      }),
    get: (id: string) =>
      get(id).catch(error => {
        throw normalizeError(error, 'Failed to load risk detail');
      }),
    create: (input: CreateRiskInput) =>
      create(input).catch(error => {
        throw normalizeError(error, 'Failed to create risk');
      }),
    update: (id: string, input: UpdateRiskInput) =>
      update(id, input).catch(error => {
        throw normalizeError(error, 'Failed to update risk');
      }),
    remove: (id: string) =>
      remove(id).catch(error => {
        throw normalizeError(error, 'Failed to delete risk');
      })
  };
};
