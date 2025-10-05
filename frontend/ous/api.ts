const API = (import.meta.env.VITE_IDENTITY_API ?? "http://localhost:3000").replace(/\/+$/, "");

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function headersWithTenant(tenantId: string) {
  return { ...authHeaders(), "x-tenant-id": tenantId };
}

export async function listOUs(tenantId: string) {
  const url = `${API}/ous?tenantId=${encodeURIComponent(tenantId)}`;
  const response = await fetch(url, { headers: headersWithTenant(tenantId) });
  return response.json();
}

export async function createOU(tenantId: string, body: any) {
  const response = await fetch(`${API}/ous`, {
    method: "POST",
    headers: { ...headersWithTenant(tenantId), "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, tenantId })
  });
  return response.json();
}

export async function updateOU(tenantId: string, id: string, body: any) {
  const response = await fetch(`${API}/ous/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { ...headersWithTenant(tenantId), "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, tenantId })
  });
  return response.json();
}

export async function deleteOU(tenantId: string, id: string) {
  const url = `${API}/ous/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: headersWithTenant(tenantId)
  });
  return response.json();
}
