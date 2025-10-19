import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuditRepository, RepositoryError, normalizeError } from '../../lib/repo';
import type { QueryClient } from '@tanstack/react-query';
import type { AuditListQuery, AuditEvent, AuditListResult } from '../../lib/repo/audit';
import { push } from '../../lib/notifications/store';
import { useEffect } from 'react';

export const auditKeys = {
  all: ['audit'] as const,
  list: (params: AuditListQuery) =>
    [
      'audit',
      params.q ?? '',
      params.user ?? '',
      params.action ?? '',
      params.from ?? '',
      params.to ?? '',
      params.page ?? 0,
      params.pageSize ?? 25,
      params.sort ?? 'ts',
      params.order ?? 'desc'
    ] as const,
  detail: (id: string) => ['audit', 'detail', id] as const
};

const notifyError = (error: unknown) => {
  const normalized = error instanceof RepositoryError ? error : normalizeError(error);
  push({
    type: 'error',
    title: 'Audit feed error',
    body: normalized.message
  });
};

export const useAuditList = (params: AuditListQuery) => {
  const repo = useAuditRepository();
  const query = useQuery<AuditListResult, RepositoryError>({
    queryKey: auditKeys.list(params),
    queryFn: () => repo.list(params),
    placeholderData: keepPreviousData,
    retry: false
  });
  useEffect(() => {
    if (query.error) {
      notifyError(query.error);
    }
  }, [query.error]);
  return query;
};

export const useAuditEvent = (id: string | null) => {
  const repo = useAuditRepository();
  const query = useQuery<AuditEvent | null, RepositoryError>({
    queryKey: id ? auditKeys.detail(id) : ['audit', 'detail', 'none'],
    queryFn: () => (id ? repo.get(id) : Promise.resolve(null)),
    enabled: Boolean(id),
    retry: false
  });
  useEffect(() => {
    if (query.error) {
      notifyError(query.error);
    }
  }, [query.error]);
  return query;
};

export const prependAuditEvent = (client: QueryClient, event: AuditEvent) => {
  const queries = client.getQueriesData<{ items: AuditEvent[]; total: number }>({ queryKey: auditKeys.all });
  queries.forEach(([key, data]) => {
    if (!data) return;
    client.setQueryData(key, {
      items: [event, ...data.items].slice(0, data.items.length),
      total: data.total + 1
    });
  });
};
