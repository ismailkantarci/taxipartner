import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ComplianceListQuery,
  ComplianceRecord,
  CreateComplianceInput,
  UpdateComplianceInput
} from '../../lib/repo/compliance/types';
import {
  useComplianceRepository,
  RepositoryError,
  normalizeError
} from '../../lib/repo/index.tsx';
import { push } from '../../lib/notifications/store';

export const complianceKeys = {
  all: ['compliance'] as const,
  list: (params: ComplianceListQuery) =>
    ['compliance', params.category, params.q ?? '', (params.status ?? []).join(','), params.sort ?? '', params.order ?? 'asc', params.page ?? 0, params.pageSize ?? 10, (params.cols ?? []).join(',')] as const,
  detail: (id: string) => ['compliance', 'detail', id] as const
};

const notifyError = (title: string, error: unknown) => {
  const normalized = error instanceof RepositoryError ? error : normalizeError(error);
  push({
    type: 'error',
    title,
    body: normalized.message
  });
};

export const useComplianceList = (params: ComplianceListQuery) => {
  const repo = useComplianceRepository();
  return useQuery({
    queryKey: complianceKeys.list(params),
    queryFn: () => repo.list(params),
    placeholderData: keepPreviousData
  });
};

export const useComplianceItem = (id: string | null) => {
  const repo = useComplianceRepository();
  return useQuery({
    queryKey: id ? complianceKeys.detail(id) : ['compliance', 'detail', 'none'],
    queryFn: () => (id ? repo.get(id) : Promise.resolve(null)),
    enabled: Boolean(id)
  });
};

const updateListCache = (client: ReturnType<typeof useQueryClient>, item: ComplianceRecord) => {
  const targets = client.getQueriesData<{ items: ComplianceRecord[]; total: number }>({ queryKey: complianceKeys.all });
  targets.forEach(([key, data]) => {
    if (!data) return;
    client.setQueryData(key, {
      ...data,
      items: data.items.map(existing => (existing.id === item.id ? item : existing))
    });
  });
};

export const useCreateCompliance = () => {
  const repo = useComplianceRepository();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateComplianceInput) => repo.create(input),
    onSuccess: record => {
      const targets = client.getQueriesData<{ items: ComplianceRecord[]; total: number }>({ queryKey: complianceKeys.all });
      targets.forEach(([key, data]) => {
        if (!data) return;
        client.setQueryData(key, {
          ...data,
          items: [record, ...data.items],
          total: data.total + 1
        });
      });
      push({ type: 'success', title: 'Compliance item created', body: record.name });
    },
    onError: error => notifyError('Failed to create compliance item', error),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: complianceKeys.all });
    }
  });
};

export const useUpdateCompliance = () => {
  const repo = useComplianceRepository();
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateComplianceInput }) => repo.update(id, input),
    onSuccess: record => {
      updateListCache(client, record);
      push({ type: 'success', title: 'Compliance item updated', body: record.name });
    },
    onError: error => notifyError('Failed to update compliance item', error),
    onSettled: (_data, _error, variables) => {
      void client.invalidateQueries({ queryKey: complianceKeys.detail(variables.id) });
    }
  });
};

export const useDeleteCompliance = () => {
  const repo = useComplianceRepository();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: (_data, id) => {
      const targets = client.getQueriesData<{ items: ComplianceRecord[]; total: number }>({ queryKey: complianceKeys.all });
      targets.forEach(([key, data]) => {
        if (!data) return;
        client.setQueryData(key, {
          ...data,
          items: data.items.filter(item => item.id !== id),
          total: Math.max(0, data.total - 1)
        });
      });
      push({ type: 'success', title: 'Compliance item deleted', body: id });
    },
    onError: error => notifyError('Failed to delete compliance item', error),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: complianceKeys.all });
    }
  });
};

export const invalidateComplianceList = (client: ReturnType<typeof useQueryClient>, params: ComplianceListQuery) => {
  void client.invalidateQueries({ queryKey: complianceKeys.list(params) });
};
