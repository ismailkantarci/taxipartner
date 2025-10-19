import type { QueryClient } from '@tanstack/react-query';
import { push } from '../notifications/store';
import { translate } from '../i18n';

let initialized = false;
let lastStatus: 'online' | 'offline' = typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline';

export const setupNetworkListeners = (client: QueryClient) => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const handleOnline = () => {
    lastStatus = 'online';
    push({
      type: 'success',
      title: translate('network.online.title', { defaultValue: 'Back online' }),
      body: translate('network.online.body', { defaultValue: 'Connection restored.' })
    });
    void client.resumePausedMutations().catch(() => undefined);
    void client.invalidateQueries();
  };

  const handleOffline = () => {
    if (lastStatus === 'offline') return;
    lastStatus = 'offline';
    push({
      type: 'warning',
      title: translate('network.offline.title', { defaultValue: 'You are offline' }),
      body: translate('network.offline.body', {
        defaultValue: 'Changes will sync once your connection is back.'
      })
    });
    void client.cancelQueries();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
};
