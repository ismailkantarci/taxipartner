import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRiskInput, RiskListQuery, RiskRecord, UpdateRiskInput } from '../../lib/repo/risk/types';
import { useRiskRepository, RepositoryError, normalizeError } from '../../lib/repo/index.tsx';
import { push } from '../../lib/notifications/store';

export const riskKeys = {
  all: ['risk'] as const,
  list: (params: RiskListQuery) =>
    ['risk', params.q ?? '', (params.status ?? []).join(','), params.sort ?? '', params.order ?? 'asc', params.page ?? 0, params.pageSize ?? 10, (params.cols ?? []).join(',')] as const,
  detail: (id: string) => ['risk', 'detail', id] as const
};

const notifyError = (title: string, error: unknown) => {
  const normalized = error instanceof RepositoryError ? error : normalizeError(error);
  push({
    type: 'error',
    title,
    body: normalized.message
  });
};

export const useRiskList = (params: RiskListQuery) => {
  const repo = useRiskRepository();
  return useQuery({
    queryKey: riskKeys.list(params),
    queryFn: () => repo.list(params),
    placeholderData: keepPreviousData
  });
};

export const useRisk = (id: string | null) => {
  const repo = useRiskRepository();
  return useQuery({
    queryKey: id ? riskKeys.detail(id) : ['risk', 'detail', 'none'],
    queryFn: () => (id ? repo.get(id) : Promise.resolve(null)),
    enabled: Boolean(id)
  });
};

export const useCreateRisk = () => {
  const repo = useRiskRepository();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRiskInput) => repo.create(input),
    onSuccess: record => {
      const targets = client.getQueriesData<{ items: RiskRecord[]; total: number }>({ queryKey: riskKeys.all });
      targets.forEach(([key, data]) => {
        if (!data) return;
        client.setQueryData(key, {
          ...data,
          items: [record, ...data.items],
          total: data.total + 1
        });
      });
      push({ type: 'success', title: 'Risk created', body: record.title });
    },
    onError: error => notifyError('Failed to create risk', error),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: riskKeys.all });
    }
  });
};

export const useUpdateRisk = () => {
  const repo = useRiskRepository();
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRiskInput }) => repo.update(id, input),
    onSuccess: record => {
      const targets = client.getQueriesData<{ items: RiskRecord[]; total: number }>({ queryKey: riskKeys.all });
      targets.forEach(([key, data]) => {
        if (!data) return;
        client.setQueryData(key, {
          ...data,
          items: data.items.map(existing => (existing.id === record.id ? record : existing))
        });
      });
      client.setQueryData(riskKeys.detail(record.id), record);
      push({ type: 'success', title: 'Risk updated', body: record.title });
    },
    onError: error => notifyError('Failed to update risk', error),
    onSettled: (_data, _error, variables) => {
      void client.invalidateQueries({ queryKey: riskKeys.detail(variables.id) });
    }
  });
};

export const useDeleteRisk = () => {
  const repo = useRiskRepository();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: (_data, id) => {
      const targets = client.getQueriesData<{ items: RiskRecord[]; total: number }>({ queryKey: riskKeys.all });
      targets.forEach(([key, data]) => {
        if (!data) return;
        client.setQueryData(key, {
          ...data,
          items: data.items.filter(item => item.id !== id),
          total: Math.max(0, data.total - 1)
        });
      });
      push({ type: 'success', title: 'Risk deleted', body: id });
    },
    onError: error => notifyError('Failed to delete risk', error),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: riskKeys.all });
    }
  });
};

export const invalidateRisks = (client: ReturnType<typeof useQueryClient>) => {
  void client.invalidateQueries({ queryKey: riskKeys.all });
};
