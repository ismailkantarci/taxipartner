import { QueryClient } from '@tanstack/react-query';
import { normalizeError, RepositoryError } from '../repo';

const exponentialBackoff = (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000);

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (failureCount >= 3) return false;
          if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
          const repoError = error instanceof RepositoryError ? error : normalizeError(error);
          if (repoError.statusCode && repoError.statusCode >= 400 && repoError.statusCode < 500) {
            return false;
          }
          return true;
        },
        retryDelay: exponentialBackoff,
        refetchOnWindowFocus: true,
        refetchOnReconnect: 'always',
        throwOnError: false
      }
    }
  });

export const queryClient = createQueryClient();
