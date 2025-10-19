import { useSyncExternalStore } from 'react';

let currentTenantId: string | null = null;
const subscribers = new Set<() => void>();

const notify = () => {
  subscribers.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('[tenant] listener error', error);
    }
  });
};

export const getTenantId = () => currentTenantId;

export const setTenantId = (tenantId: string | null) => {
  currentTenantId = tenantId;
  notify();
};

export const subscribeTenant = (listener: () => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

export const useTenantId = () =>
  useSyncExternalStore(subscribeTenant, () => currentTenantId, () => currentTenantId);
