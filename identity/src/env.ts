import dotenv from 'dotenv';

dotenv.config();

// Secure-env: require explicit secrets outside of tests
function must(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} must be provided`);
  }
  return value;
}

export const JWT_SECRET = must('JWT_SECRET');
export const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
export const DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH === 'true';
export const DEV_BYPASS_EMAIL = process.env.DEV_BYPASS_EMAIL || '';
if (DEV_BYPASS_AUTH) {
  console.warn('[auth] DEV_BYPASS_AUTH enabled; disable in production!');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DEV_BYPASS_AUTH cannot be true in production');
  }
}
export const DEV_CORS_ORIGINS = (process.env.DEV_CORS_ORIGINS || '').trim();
export const OIDC_AUTHORITY = process.env.OIDC_AUTHORITY || '';
export const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || '';
export const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';
export const OIDC_REDIRECT_URI = process.env.OIDC_REDIRECT_URI || '';
