import { buildAuthHeaders, buildJsonHeaders } from "../api/http";

const API = (import.meta.env.VITE_IDENTITY_API ?? "http://localhost:3000").replace(/\/+$/, "");

type HeaderMap = Record<string, string>;

const authHeaders = (): HeaderMap => buildAuthHeaders();
const jsonHeaders = (headers: HeaderMap = {}): HeaderMap => buildJsonHeaders(headers);

type ApiResponse<T = Record<string, unknown>> = T & {
  ok: boolean;
  status: number;
  error?: string;
};

async function asJson<T extends Record<string, unknown>>(response: Response): Promise<ApiResponse<T>> {
  const fallback = "Error";
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const ok = response.ok && json?.ok !== false;
  const error =
    typeof json.error === "string"
      ? json.error
      : !ok
      ? fallback
      : undefined;
  const { ok: _ignoredOk, error: _ignoredError, ...rest } = json;
  return {
    ...(rest as T),
    ok,
    status: response.status,
    ...(error ? { error } : {})
  };
}

export type ListOUsParams = {
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: string;
};

export async function listOUs(tenantId: string, params: ListOUsParams = {}) {
  const url = new URL(`${API}/tenants/${encodeURIComponent(tenantId)}/ous`);
  if (params.query) url.searchParams.set("q", params.query);
  if (typeof params.page === "number") url.searchParams.set("page", String(params.page));
  if (typeof params.pageSize === "number") url.searchParams.set("pageSize", String(params.pageSize));
  if (params.sort) url.searchParams.set("sort", params.sort);
  if (params.order) url.searchParams.set("order", params.order);
  const response = await fetch(url.toString(), {
    headers: authHeaders()
  });
  return asJson<{
    items?: Array<{
      id: string;
      name: string;
      parentId?: string | null;
      childCount?: number;
    }>;
    total?: number;
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: string;
  }>(response);
}

export async function createOU(tenantId: string, body: any) {
  const response = await fetch(`${API}/tenants/${encodeURIComponent(tenantId)}/ous`, {
    method: "POST",
    headers: jsonHeaders(authHeaders()),
    body: JSON.stringify(body)
  });
  return asJson<{ ou?: Record<string, unknown> }>(response);
}

export async function getOU(tenantId: string, id: string) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/ous/${encodeURIComponent(id)}`,
    {
      headers: authHeaders()
    }
  );
  return asJson<{ ou?: Record<string, unknown> }>(response);
}

export async function updateOU(tenantId: string, id: string, body: any) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/ous/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: jsonHeaders(authHeaders()),
      body: JSON.stringify(body)
    }
  );
  return asJson<{ ou?: Record<string, unknown> }>(response);
}

export async function deleteOU(tenantId: string, id: string) {
  const response = await fetch(
    `${API}/tenants/${encodeURIComponent(tenantId)}/ous/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: authHeaders()
    }
  );
  return asJson<Record<string, unknown>>(response);
}
