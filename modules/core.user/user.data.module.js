const FALLBACK_TENANTS = [
  { id: 'reftiss', name: 'Reftiss KG' },
  { id: 'gofleet', name: 'GoFleet GmbH' }
];

const FALLBACK_USER = {
  id: 'local-debug',
  email: 'debug@example.com',
  fullName: 'Debug User',
  companyTag: '@KMS',
  language: 'de-AT',
  roles: ['admin'],
  tenants: FALLBACK_TENANTS,
  currentTenant: FALLBACK_TENANTS[0]?.id ?? null,
  preferredTheme: 'system',
  mfaEnabled: false,
  phone: null
};

function normaliseUrl(url, fallback) {
  if (!url) return fallback;
  try {
    const parsed = new URL(String(url));
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return fallback;
  }
}

export function deriveIdentityApiBase() {
  const envBase = import.meta?.env?.VITE_IDENTITY_API;
  if (envBase) return normaliseUrl(envBase, envBase).replace(/\/+$/, '');

  const { protocol, hostname } = window.location;
  if (hostname.endsWith('.app.github.dev')) {
    return `${protocol}//${hostname.replace('-5173', '-3000')}`;
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3000`;
  }
  return 'http://localhost:3000';
}

export function deriveIdentityLoginUrl(apiBase) {
  const explicit = import.meta?.env?.VITE_IDENTITY_LOGIN;
  if (explicit) return explicit;

  try {
    const api = new URL(apiBase);
    const { protocol } = api;
    let host = api.hostname;
    const port = api.port;
    if (host.endsWith('.app.github.dev') && host.includes('-3000')) {
      host = host.replace('-3000', '-5174');
      return `${protocol}//${host}/#/auth/login`;
    }
    if ((host === 'localhost' || host === '127.0.0.1') && (!port || port === '3000')) {
      return `${protocol}//${host}:5174/#/auth/login`;
    }
    if (port === '3000') {
      return `${protocol}//${host}:5174/#/auth/login`;
    }
    return `${protocol}//${api.host}/#/auth/login`;
  } catch {
    const { protocol, hostname, port } = window.location;
    if (hostname.endsWith('.app.github.dev') && hostname.includes('-5173')) {
      return `${protocol}//${hostname.replace('-5173', '-5174')}/#/auth/login`;
    }
    if (port === '5173') {
      return `${protocol}//${hostname}:5174/#/auth/login`;
    }
    return '#/auth/login';
  }
}

export const IDENTITY_API_BASE = deriveIdentityApiBase().replace(/\/+$/, '');
export const IDENTITY_LOGIN_URL = deriveIdentityLoginUrl(IDENTITY_API_BASE);

export function readAuthToken() {
  try {
    const stored = localStorage.getItem('token');
    if (stored) return stored;
  } catch {}
  try {
    const match = document.cookie.match(/(?:^|;\s*)tp_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function expireAuthCookie() {
  const parts = ['tp_token=', 'path=/', 'Max-Age=0', 'SameSite=Lax', 'expires=Thu, 01 Jan 1970 00:00:00 GMT'];
  if (location.protocol === 'https:') {
    parts.push('Secure');
  }
  if (location.hostname.endsWith('.app.github.dev')) {
    parts.push('domain=.app.github.dev');
  }
  try {
    document.cookie = parts.join('; ');
  } catch {}
}

class UnauthenticatedError extends Error {
  redirect;
  constructor(message, redirect) {
    super(message);
    this.redirect = redirect;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 204) return null;
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status})`);
    error.status = response.status;
    try {
      const body = await response.json();
      error.body = body;
    } catch {}
    throw error;
  }
  return response.json();
}

export async function loadCurrentUser() {
  const token = readAuthToken();
  if (!token) {
    throw new UnauthenticatedError('Token missing', IDENTITY_LOGIN_URL);
  }

  try {
    const data = await fetchJson(`${IDENTITY_API_BASE}/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const profile = data?.profile;
    if (!profile) {
      throw new Error('Profile response missing');
    }

    const language = profile.preferredLanguage ?? FALLBACK_USER.language;
    const preferredTheme = profile.preferredTheme ?? FALLBACK_USER.preferredTheme;
    const fullName = profile.fullName?.trim() || profile.email?.split('@')[0] || FALLBACK_USER.fullName;

    return {
      id: profile.id,
      email: profile.email,
      fullName,
      companyTag: FALLBACK_USER.companyTag,
      language,
      preferredTheme,
      roles: FALLBACK_USER.roles,
      tenants: FALLBACK_USER.tenants,
      currentTenant: localStorage.getItem('selectedTenantId') || FALLBACK_USER.currentTenant,
      mfaEnabled: Boolean(profile.mfaEnabled),
      phone: profile.phone ?? null,
      rawProfile: profile
    };
  } catch (error) {
    if (error?.status === 401) {
      throw new UnauthenticatedError('Unauthorized', IDENTITY_LOGIN_URL);
    }
    console.error('[loadCurrentUser] fallback to static user due to error:', error);
    return { ...FALLBACK_USER, error };
  }
}

export { FALLBACK_USER };
