export interface TenantSummary {
  id: string;
  name?: string | null;
}

export interface LoadedUser {
  id: string;
  email: string;
  fullName: string;
  companyTag?: string;
  language: string;
  preferredTheme: string;
  roles: string[];
  tenants: TenantSummary[];
  currentTenant: string | null;
  mfaEnabled: boolean;
  phone: string | null;
  rawProfile?: Record<string, unknown>;
  error?: unknown;
}

export declare const FALLBACK_USER: LoadedUser;

export declare function deriveIdentityApiBase(): string;
export declare function deriveIdentityLoginUrl(apiBase: string): string;

export declare const IDENTITY_API_BASE: string;
export declare const IDENTITY_LOGIN_URL: string;

export declare function readAuthToken(): string | null;
export declare function expireAuthCookie(): void;

export declare function loadCurrentUser(): Promise<LoadedUser>;
