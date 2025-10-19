import type { AuditAdapter, AuditEvent, AuditListResult, AuditListQuery } from './types';
import { createMemoryAuditAdapter } from './memory';
import { getTenantId } from '../../tenant/store';

class AuditAdapterError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number, cause?: unknown) {
    super(message);
    this.name = 'AuditAdapterError';
    this.statusCode = statusCode;
    if (cause) {
      this.cause = cause;
    }
  }
}

const AUDIT_API_BASE = import.meta.env.VITE_AUDIT_API_BASE ?? '/api/audit';
const ENABLE_HTTP_AUDIT = import.meta.env.VITE_ENABLE_HTTP_AUDIT !== 'false';

const request = async <T>(path: string, options: RequestInit & { query?: URLSearchParams; fallback?: () => Promise<T> }) => {
  if (!ENABLE_HTTP_AUDIT) {
    if (options.fallback) return options.fallback();
    throw new AuditAdapterError('HTTP audit adapter disabled');
  }

  const tenantId = getTenantId();
  const headers: HeadersInit = {
    Accept: 'application/json'
  };
  if (options.body && !(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  if (tenantId) {
    (headers as Record<string, string>)['x-tenant-id'] = tenantId;
  }

  const url = new URL(path, AUDIT_API_BASE);
  options.query?.forEach((value, key) => url.searchParams.append(key, value));

  try {
    const response = await fetch(url.toString(), {
      ...options,
      headers
    });
    if (!response.ok) {
      throw new AuditAdapterError(response.statusText || 'Audit request failed', response.status);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (error) {
    if (options.fallback) {
      return options.fallback();
    }
    throw new AuditAdapterError(error instanceof Error ? error.message : 'Audit request failed', undefined, error);
  }
};

const buildQueryParams = (query: AuditListQuery) => {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.user) params.set('user', query.user);
  if (query.action) params.set('action', query.action);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (typeof query.page === 'number') params.set('page', String(query.page));
  if (typeof query.pageSize === 'number') params.set('pageSize', String(query.pageSize));
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
  return params;
};

export const createHttpAuditAdapter = (): AuditAdapter => {
  const memory = createMemoryAuditAdapter();

  return {
    async list(query: AuditListQuery) {
      const params = buildQueryParams(query);
      return request<AuditListResult>('/', {
        method: 'GET',
        query: params,
        fallback: () => memory.list(query)
      });
    },
    async get(id: string) {
      return request<AuditEvent | null>(`/${encodeURIComponent(id)}`, {
        method: 'GET',
        fallback: () => memory.get(id)
      });
    }
  };
};
