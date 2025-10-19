import { RepositoryError } from './index';
import { getToken, refreshToken, clearSession } from '../auth/session';
import { getTenantId } from '../tenant/store';
import { push } from '../notifications/store';
const envBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');
const API_BASE_URL = envBase || (typeof window !== 'undefined' ? window.location.origin : '');
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT ?? 10000);
const API_RETRIES = Number(import.meta.env.VITE_API_RETRIES ?? 1);
const TENANT_HEADER = import.meta.env.VITE_TENANT_HEADER ?? 'x-tenant-id';
const ENABLE_HTTP_WRITE = import.meta.env.VITE_ENABLE_HTTP_WRITE !== 'false';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const buildGoalQueryParams = (query) => {
    const params = new URLSearchParams();
    if (query.search)
        params.set('q', query.search);
    if (query.sort)
        params.set('sort', query.sort);
    if (query.order)
        params.set('order', query.order);
    if (typeof query.page === 'number')
        params.set('page', String(query.page));
    if (typeof query.pageSize === 'number')
        params.set('pageSize', String(query.pageSize));
    if (query.status && query.status.length) {
        query.status.forEach(status => params.append('status', status));
    }
    if (query.cols && query.cols.length) {
        params.set('cols', query.cols.join(','));
    }
    return params;
};
const buildComplianceQueryParams = (query) => {
    const params = buildGoalQueryParams({
        search: query.q,
        status: query.status,
        sort: query.sort,
        order: query.order,
        page: query.page,
        pageSize: query.pageSize,
        cols: query.cols
    });
    params.set('category', query.category);
    return params;
};
const buildRiskQueryParams = (query) => buildGoalQueryParams({
    search: query.q,
    status: query.status,
    sort: query.sort,
    order: query.order,
    page: query.page,
    pageSize: query.pageSize,
    cols: query.cols
});
const parseJson = async (response) => {
    const text = await response.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch (error) {
        console.warn('repo:http failed to parse JSON', error);
        return text;
    }
};
const createError = async (response, payload) => {
    const body = await parseJson(response);
    const message = (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
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
const request = async (path, options) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);
    const headers = {
        Accept: 'application/json'
    };
    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const tenantId = getTenantId();
    if (tenantId) {
        headers[TENANT_HEADER] = tenantId;
    }
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
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
        return data;
    }
    catch (error) {
        if (error instanceof RepositoryError)
            throw error;
        if (error?.name === 'AbortError') {
            throw new RepositoryError('Request timed out');
        }
        throw new RepositoryError(error?.message ?? 'Network error', { cause: error });
    }
    finally {
        clearTimeout(timeout);
    }
};
const ensureWriteEnabled = () => {
    if (ENABLE_HTTP_WRITE)
        return;
    throw new RepositoryError('HTTP write operations are disabled in this environment.');
};
export const createHttpGoalsAdapter = () => ({
    async list(query) {
        const params = buildGoalQueryParams(query);
        const data = await request('/goals', {
            method: 'GET',
            query: params
        });
        return {
            items: data?.items ?? [],
            total: data?.total ?? 0
        };
    },
    async get(id) {
        const data = await request(`/goals/${id}`, {
            method: 'GET'
        });
        return data ?? null;
    },
    async create(input) {
        ensureWriteEnabled();
        const data = await request('/goals', {
            method: 'POST',
            body: JSON.stringify(input)
        });
        return data;
    },
    async update(id, input) {
        ensureWriteEnabled();
        const data = await request(`/goals/${id}`, {
            method: 'PUT',
            body: JSON.stringify(input)
        });
        return data;
    },
    async remove(id) {
        ensureWriteEnabled();
        await request(`/goals/${id}`, {
            method: 'DELETE'
        });
    }
});
export const createHttpComplianceAdapter = () => ({
    async list(query) {
        const params = buildComplianceQueryParams(query);
        const data = await request(`/compliance/${query.category}`, {
            method: 'GET',
            query: params
        });
        return {
            items: data?.items ?? [],
            total: data?.total ?? 0
        };
    },
    async get(id) {
        const data = await request(`/compliance/items/${id}`, {
            method: 'GET'
        });
        return data ?? null;
    },
    async create(input) {
        ensureWriteEnabled();
        const data = await request('/compliance/items', {
            method: 'POST',
            body: JSON.stringify(input)
        });
        return data;
    },
    async update(id, input) {
        ensureWriteEnabled();
        const data = await request(`/compliance/items/${id}`, {
            method: 'PUT',
            body: JSON.stringify(input)
        });
        return data;
    },
    async remove(id) {
        ensureWriteEnabled();
        await request(`/compliance/items/${id}`, {
            method: 'DELETE'
        });
    }
});
export const createHttpRiskAdapter = () => ({
    async list(query) {
        const params = buildRiskQueryParams(query);
        const data = await request('/risk', {
            method: 'GET',
            query: params
        });
        return {
            items: data?.items ?? [],
            total: data?.total ?? 0
        };
    },
    async get(id) {
        const data = await request(`/risk/${id}`, {
            method: 'GET'
        });
        return data ?? null;
    },
    async create(input) {
        ensureWriteEnabled();
        const data = await request('/risk', {
            method: 'POST',
            body: JSON.stringify(input)
        });
        return data;
    },
    async update(id, input) {
        ensureWriteEnabled();
        const data = await request(`/risk/${id}`, {
            method: 'PUT',
            body: JSON.stringify(input)
        });
        return data;
    },
    async remove(id) {
        ensureWriteEnabled();
        await request(`/risk/${id}`, {
            method: 'DELETE'
        });
    }
});
