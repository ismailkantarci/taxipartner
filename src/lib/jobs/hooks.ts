import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import type { Job } from './types';
import { subscribe, getJob } from './jobs';

export const useJob = <TPayload,>(id: string | null | undefined) => {
  const subscribeToJob = useCallback(
    (onStoreChange: () => void) => {
      if (!id) {
        return () => {};
      }
      return subscribe<TPayload>(id, () => {
        onStoreChange();
      });
    },
    [id]
  );

  const getSnapshot = useCallback(() => {
    if (!id) return null;
    return getJob<TPayload>(id) ?? null;
  }, [id]);

  const getServerSnapshot = useCallback(() => null, []);

  return useSyncExternalStore(subscribeToJob, getSnapshot, getServerSnapshot) as Job<TPayload> | null;
};
