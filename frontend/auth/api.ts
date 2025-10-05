const API = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

export async function me() {
  const token = localStorage.getItem('token');
  const r = await fetch(API + '/auth/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  return r.json();
}

export async function login(email: string, password: string) {
  const r = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return r.json();
}

export async function inviteAccept(payload: any) {
  const r = await fetch(API + '/invite/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return r.json();
}

export async function inviteCreate(payload: any) {
  const r = await fetch(API + '/invite/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return r.json();
}
