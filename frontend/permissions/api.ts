const API_BASE = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

type TemplatesResponse = {
  ok: boolean;
  templates: Array<{ role: string; allow: string[]; deny: string[] }>;
  error?: string;
};

type EffectiveResponse = {
  ok: boolean;
  role: string;
  allow: string[];
  error?: string;
};

type UpdateTemplateResponse = {
  ok: boolean;
  template?: { role: string; allow: string[]; deny: string[] };
  note?: string;
  error?: string;
};

function authz(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listTemplates(): Promise<TemplatesResponse> {
  const response = await fetch(`${API_BASE}/permissions/templates`, { headers: authz() });
  return response.json();
}

export async function roleEffective(role: string): Promise<EffectiveResponse> {
  const response = await fetch(
    `${API_BASE}/permissions/roles/${encodeURIComponent(role)}/effective`,
    { headers: authz() }
  );
  return response.json();
}

export async function updateTemplate(
  role: string,
  body: { allow?: string[]; deny?: string[] }
): Promise<UpdateTemplateResponse> {
  const response = await fetch(`${API_BASE}/permissions/templates/${encodeURIComponent(role)}`, {
    method: 'POST',
    headers: { ...authz(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}
