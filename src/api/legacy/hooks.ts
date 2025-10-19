import {
  type QueryKey,
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
  useQuery,
  type UseQueryOptions,
  type UseQueryResult
} from '@tanstack/react-query';
import { legacyFetch } from './client';
import type { LegacyRequestConfig, LegacyQueryParams, LegacyApiError } from './client';

type MaybeFactory<T, V> = T | ((variables: V) => T);

const resolve = <T, V>(input: MaybeFactory<T | undefined, V>, variables: V): T | undefined => {
  if (typeof input === 'function') {
    return (input as (args: V) => T | undefined)(variables);
  }
  return input;
};

export type LegacyQueryOptions<TData, TSelected = TData, TError = LegacyApiError> = Omit<
  UseQueryOptions<TData, TError, TSelected, QueryKey>,
  'queryFn'
> & {
  path: string;
  params?: LegacyQueryParams;
  request?: Omit<LegacyRequestConfig, 'path' | 'params' | 'method'>;
  method?: LegacyRequestConfig['method'];
};

export const useLegacyQuery = <TData, TSelected = TData, TError = LegacyApiError>({
  path,
  params,
  request,
  method = 'GET',
  ...rest
}: LegacyQueryOptions<TData, TSelected, TError>): UseQueryResult<TSelected, TError> =>
  useQuery({
    ...rest,
    queryFn: () =>
      legacyFetch<TData>({
        path,
        params,
        method,
        ...request
      })
  });

export type LegacyMutationRequest<TVariables> = {
  path: MaybeFactory<string, TVariables>;
  method?: LegacyRequestConfig['method'];
  params?: MaybeFactory<LegacyQueryParams | undefined, TVariables>;
  body?: MaybeFactory<unknown, TVariables>;
  headers?: MaybeFactory<HeadersInit | undefined, TVariables>;
  tenantId?: MaybeFactory<string | null | undefined, TVariables>;
  companyId?: MaybeFactory<string | null | undefined, TVariables>;
  rawResponse?: MaybeFactory<boolean | undefined, TVariables>;
  timeout?: MaybeFactory<number | undefined, TVariables>;
};

export type LegacyMutationOptions<
  TData,
  TVariables,
  TError = LegacyApiError,
  TContext = unknown
> = Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'> & {
  request?: LegacyMutationRequest<TVariables>;
  mutationFn?: (variables: TVariables) => Promise<TData>;
};

export const useLegacyMutation = <
  TData = unknown,
  TVariables = void,
  TError = LegacyApiError,
  TContext = unknown
>({
  request,
  mutationFn,
  ...options
}: LegacyMutationOptions<TData, TVariables, TError, TContext>): UseMutationResult<
  TData,
  TError,
  TVariables,
  TContext
> => {
  if (!mutationFn && !request?.path) {
    throw new Error('useLegacyMutation requires either mutationFn or request.path');
  }

  const finalMutationFn =
    mutationFn ??
    ((variables: TVariables) => {
      const computedPath =
        resolve(request?.path as MaybeFactory<string, TVariables>, variables) ?? '/';
      return legacyFetch<TData>({
        path: computedPath,
        method: request?.method ?? 'POST',
        params: resolve(request?.params, variables),
        body: resolve(request?.body, variables),
        headers: resolve(request?.headers, variables),
        tenantId: resolve(request?.tenantId, variables) ?? undefined,
        companyId: resolve(request?.companyId, variables) ?? undefined,
        rawResponse: resolve(request?.rawResponse, variables),
        timeout: resolve(request?.timeout, variables)
      });
    });

  return useMutation<TData, TError, TVariables, TContext>({
    ...options,
    mutationFn: finalMutationFn
  });
};

export { LegacyApiError, legacyFetch } from './client';
