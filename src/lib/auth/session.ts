import { push } from '../notifications/store';

let authToken: string | null = null;
let refreshInProgress = false;

const getInitialToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('tp-admin@auth-token');
  } catch (error) {
    console.warn('[auth] token load failed', error);
    return null;
  }
};

authToken = getInitialToken();

export const getToken = () => authToken;

export const setToken = (token: string | null) => {
  authToken = token;
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.localStorage.setItem('tp-admin@auth-token', token);
    } else {
      window.localStorage.removeItem('tp-admin@auth-token');
    }
  } catch (error) {
    console.warn('[auth] token persist failed', error);
  }
};

export const refreshToken = async (): Promise<string | null> => {
  if (refreshInProgress) {
    await new Promise(resolve => setTimeout(resolve, 250));
    return authToken;
  }
  refreshInProgress = true;
  try {
    const simulatedToken = 'dev-token';
    setToken(simulatedToken);
    return simulatedToken;
  } catch (error) {
    console.warn('[auth] refreshToken error', error);
    setToken(null);
    push({
      type: 'warning',
      title: 'Session expired',
      body: 'Please sign in again to continue.',
      link: '/login'
    });
    return null;
  } finally {
    refreshInProgress = false;
  }
};

export const clearSession = () => {
  setToken(null);
};
