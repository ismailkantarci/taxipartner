import { getToken as getAppToken } from '../../lib/auth/session';
import { normalizeError, RepositoryError } from '../../lib/repo/index';
import { push } from '../../lib/notifications/store';

const LEGACY_BASE_URL_RAW = import.meta.env.VITE_IDENTITY_API ?? '';
const LEGACY_BASE_URL =
  (typeof LEGACY_BASE_URL_RAW === 'string' ? LEGACY_BASE_URL_RAW.trim().replace(/\/+$/, '') : '') ||
  (typeof window !== 'undefined' ? `${window.location.origin}` : '');

const DEFAULT_TIMEOUT = Number(import.meta.env.VITE_LEGACY_API_TIMEOUT ?? 10_000);
const TENANT_HEADER = import.meta.env.VITE_LEGACY_TENANT_HEADER ?? 'x-tenant-id';
const COMPANY_HEADER = import.meta.env.VITE_LEGACY_COMPANY_HEADER ?? 'x-company-id';

export type LegacyQueryParams = Record<string, string | number | boolean | null | undefined>;

export type LegacyHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface LegacyRequestConfig {
  path: string;
  method?: LegacyHttpMethod;
  params?: LegacyQueryParams;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  tenantId?: string | null;
  companyId?: string | null;
  timeout?: number;
  rawResponse?: boolean;
}

const readStoredToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    const fromSession = getAppToken();
    if (fromSession) return fromSession;
    return (
      window.localStorage.getItem('token') ||
      window.localStorage.getItem('tp-admin@auth-token') ||
      null
    );
  } catch (error) {
    console.warn('[legacy-api] failed to read token', error);
    return null;
  }
};

const encodeQuery = (params: LegacyQueryParams | undefined) => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(item => {
        search.append(key, String(item));
      });
      return;
    }
    if (typeof value === 'boolean') {
      search.set(key, value ? 'true' : 'false');
      return;
    }
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export class LegacyApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'LegacyApiError';
    this.status = status;
    this.body = body;
  }
}

const ensureBaseUrl = () => {
  if (LEGACY_BASE_URL) return LEGACY_BASE_URL;
  throw new RepositoryError('Legacy API base url is not configured.');
};

const parseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('[legacy-api] failed to parse JSON response', error);
    return text;
  }
};

const notifySessionExpired = () => {
  push({
    type: 'warning',
    title: 'Session expired',
    body: 'Your session expired. Please sign in again.',
    link: '/login'
  });
};

export const legacyFetch = async <T = unknown>({
  path,
  method = 'GET',
  params,
  body,
  headers,
  signal,
  tenantId,
  companyId,
  timeout,
  rawResponse = false
}: LegacyRequestConfig): Promise<T> => {
  const baseUrl = ensureBaseUrl();
  const controller = new AbortController();
  const abortTimeout = setTimeout(() => controller.abort(), timeout ?? DEFAULT_TIMEOUT);
  const requestSignal = signal ?? controller.signal;

  const computedHeaders: HeadersInit = {
    Accept: 'application/json',
    ...headers
  };

  const token = readStoredToken();
  if (token) {
    (computedHeaders as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  const effectiveTenant = tenantId ?? null;
  if (effectiveTenant) {
    (computedHeaders as Record<string, string>)[TENANT_HEADER] = effectiveTenant;
  }
  if (companyId) {
    (computedHeaders as Record<string, string>)[COMPANY_HEADER] = companyId;
  }

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
    requestBody = body as BodyInit;
  } else if (body !== undefined && body !== null) {
    requestBody = JSON.stringify(body);
    (computedHeaders as Record<string, string>)['Content-Type'] =
      (computedHeaders as Record<string, string>)['Content-Type'] ?? 'application/json';
  }

  try {
    const response = await fetch(`${baseUrl}${path}${encodeQuery(params)}`, {
      method,
      headers: computedHeaders,
      body: requestBody,
      signal: requestSignal
    });

    if (response.status === 401) {
      notifySessionExpired();
      throw new LegacyApiError('Unauthorized', response.status, await parseJson(response));
    }

    if (!response.ok) {
      throw new LegacyApiError(
        response.statusText || 'Legacy request failed',
        response.status,
        await parseJson(response)
      );
    }

    if (rawResponse) {
      return response as unknown as T;
    }

    const data = await parseJson(response);
    return data as T;
  } catch (error) {
    if (error instanceof LegacyApiError) {
      throw error;
    }
    if ((error as Error).name === 'AbortError') {
      throw new LegacyApiError('Legacy request timed out', 408, null);
    }
    const normalized = normalizeError(error);
    throw new LegacyApiError(normalized.message, normalized.statusCode ?? 500, normalized);
  } finally {
    clearTimeout(abortTimeout);
  }
};

export type LegacyFetcher = typeof legacyFetch;
