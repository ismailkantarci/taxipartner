import { useSyncExternalStore } from 'react';
let currentTenantId = null;
const subscribers = new Set();
const notify = () => {
    subscribers.forEach(listener => {
        try {
            listener();
        }
        catch (error) {
            console.error('[tenant] listener error', error);
        }
    });
};
export const getTenantId = () => currentTenantId;
export const setTenantId = (tenantId) => {
    currentTenantId = tenantId;
    notify();
};
export const subscribeTenant = (listener) => {
    subscribers.add(listener);
    return () => {
        subscribers.delete(listener);
    };
};
export const useTenantId = () => useSyncExternalStore(subscribeTenant, () => currentTenantId, () => currentTenantId);
