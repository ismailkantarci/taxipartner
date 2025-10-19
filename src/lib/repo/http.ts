import { RepositoryError } from './index';
import type {
  CreateGoalInput,
  GoalRecord,
  GoalsListQuery,
  GoalsListResult,
  UpdateGoalInput
} from './goals/types';
import type { GoalsAdapter } from './index';
import type {
  ComplianceListQuery,
  ComplianceListResult,
  ComplianceRecord,
  CreateComplianceInput,
  UpdateComplianceInput
} from './compliance/types';
import type {
  RiskListQuery,
  RiskListResult,
  RiskRecord,
  CreateRiskInput,
  UpdateRiskInput
} from './risk/types';
import { getToken, refreshToken, clearSession } from '../auth/session';
import { getTenantId } from '../tenant/store';
import { push } from '../notifications/store';

const API_BASE_URL_RAW = import.meta.env.VITE_API_BASE_URL ?? '';
const API_BASE_URL = API_BASE_URL_RAW.trim().replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT ?? 10000);
const API_RETRIES = Number(import.meta.env.VITE_API_RETRIES ?? 1);
const TENANT_HEADER = import.meta.env.VITE_TENANT_HEADER ?? 'x-tenant-id';
const ENABLE_HTTP_WRITE = import.meta.env.VITE_ENABLE_HTTP_WRITE !== 'false';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type ListQuery = {
  search?: string;
  status?: readonly string[];
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  cols?: readonly string[];
};

const buildListQueryParams = (query: ListQuery) => {
  const params = new URLSearchParams();
  if (query.search) params.set('q', query.search);
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
  if (typeof query.page === 'number') params.set('page', String(query.page));
  if (typeof query.pageSize === 'number') params.set('pageSize', String(query.pageSize));
  if (query.status?.length) {
    query.status.forEach(status => params.append('status', status));
  }
  const cols = query.cols?.length ? query.cols : undefined;
  if (cols) {
    params.set('cols', cols.join(','));
  }
  return params;
};

const buildGoalQueryParams = (query: GoalsListQuery) =>
  buildListQueryParams({
    search: query.search,
    status: query.status,
    sort: query.sort,
    order: query.order,
    page: query.page,
    pageSize: query.pageSize,
    cols: query.cols ?? query.columns
  });

const buildComplianceQueryParams = (query: ComplianceListQuery) => {
  const params = buildListQueryParams({
    search: query.q,
    status: query.status,
    sort: query.sort,
    order: query.order,
    page: query.page,
    pageSize: query.pageSize,
    cols: query.cols
  });
  if (query.category) {
    params.set('category', query.category);
  }
  return params;
};

const buildRiskQueryParams = (query: RiskListQuery) =>
  buildListQueryParams({
    search: query.q,
    status: query.status,
    sort: query.sort,
    order: query.order,
    page: query.page,
    pageSize: query.pageSize,
    cols: query.cols
  });

const parseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('repo:http failed to parse JSON', error);
    return text;
  }
};

const createError = async (response: Response, payload?: unknown) => {
  const body = await parseJson(response);
  const message =
    (body && typeof body === 'object' && 'message' in body && typeof (body as any).message === 'string'
      ? (body as any).message
      : undefined) ||
    response.statusText ||
    'Request failed';
  return new RepositoryError(message, {
    statusCode: response.status,
    details: {
      body,
      payload
    }
  });
};

const request = async <T>(
  path: string,
  options: RequestInit & { retry?: number; query?: URLSearchParams }
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

  const headers: HeadersInit = {
    Accept: 'application/json'
  };

  const token = getToken();
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  const tenantId = getTenantId();
  if (tenantId) {
    (headers as Record<string, string>)[TENANT_HEADER] = tenantId;
  }

  if (options.body && !(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const url = new URL(path, API_BASE_URL);
  if (options.query) {
    options.query.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }

  try {
    const response = await fetch(url.toString(), {
      ...options,
      headers,
      signal: controller.signal
    });

    if (response.status === 401 && (options.retry ?? API_RETRIES) > 0) {
      const newToken = await refreshToken();
      if (newToken) {
        return request(path, {
          ...options,
          retry: (options.retry ?? API_RETRIES) - 1
        });
      }
      clearSession();
      push({
        type: 'warning',
        title: 'Session expired',
        body: 'Please log in again.',
        link: '/login'
      });
      throw await createError(response);
    }

    if (!response.ok) {
      throw await createError(response, options.body);
    }

    const data = await parseJson(response);
    return data as T;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    if ((error as any)?.name === 'AbortError') {
      throw new RepositoryError('Request timed out');
    }
    throw new RepositoryError((error as Error)?.message ?? 'Network error', { cause: error });
  } finally {
    clearTimeout(timeout);
  }
};

const ensureWriteEnabled = () => {
  if (ENABLE_HTTP_WRITE) return;
  throw new RepositoryError('HTTP write operations are disabled in this environment.');
};

export const createHttpGoalsAdapter = (): GoalsAdapter => ({
  async list(query) {
    const params = buildGoalQueryParams(query);
    const data = await request<{ items: GoalRecord[]; total: number }>('/goals', {
      method: 'GET',
      query: params
    });
    return {
      items: data?.items ?? [],
      total: data?.total ?? 0
    };
  },
  async get(id) {
    const data = await request<GoalRecord | null>(`/goals/${id}`, {
      method: 'GET'
    });
    return data ?? null;
  },
  async create(input) {
    ensureWriteEnabled();
    const data = await request<GoalRecord>('/goals', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return data;
  },
  async update(id, input) {
    ensureWriteEnabled();
    const data = await request<GoalRecord>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    });
    return data;
  },
  async remove(id) {
    ensureWriteEnabled();
    await request<void>(`/goals/${id}`, {
      method: 'DELETE'
    });
  }
});

export const createHttpComplianceAdapter = () => ({
  async list(query: ComplianceListQuery): Promise<ComplianceListResult> {
    const params = buildComplianceQueryParams(query);
    const data = await request<{ items: ComplianceRecord[]; total: number }>(`/compliance/${query.category}`, {
      method: 'GET',
      query: params
    });
    return {
      items: data?.items ?? [],
      total: data?.total ?? 0
    };
  },
  async get(id: string) {
    const data = await request<ComplianceRecord | null>(`/compliance/items/${id}`, {
      method: 'GET'
    });
    return data ?? null;
  },
  async create(input: CreateComplianceInput) {
    ensureWriteEnabled();
    const data = await request<ComplianceRecord>('/compliance/items', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return data;
  },
  async update(id: string, input: UpdateComplianceInput) {
    ensureWriteEnabled();
    const data = await request<ComplianceRecord>(`/compliance/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    });
    return data;
  },
  async remove(id: string) {
    ensureWriteEnabled();
    await request<void>(`/compliance/items/${id}`, {
      method: 'DELETE'
    });
  }
});

export const createHttpRiskAdapter = () => ({
  async list(query: RiskListQuery): Promise<RiskListResult> {
    const params = buildRiskQueryParams(query);
    const data = await request<{ items: RiskRecord[]; total: number }>('/risk', {
      method: 'GET',
      query: params
    });
    return {
      items: data?.items ?? [],
      total: data?.total ?? 0
    };
  },
  async get(id: string) {
    const data = await request<RiskRecord | null>(`/risk/${id}`, {
      method: 'GET'
    });
    return data ?? null;
  },
  async create(input: CreateRiskInput) {
    ensureWriteEnabled();
    const data = await request<RiskRecord>('/risk', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return data;
  },
  async update(id: string, input: UpdateRiskInput) {
    ensureWriteEnabled();
    const data = await request<RiskRecord>(`/risk/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    });
    return data;
  },
  async remove(id: string) {
    ensureWriteEnabled();
    await request<void>(`/risk/${id}`, {
      method: 'DELETE'
    });
  }
});
