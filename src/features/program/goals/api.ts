import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { GoalsListQuery, GoalRecord, CreateGoalInput, UpdateGoalInput } from '../../../lib/repo/goals/types';
import { useGoalsRepository, RepositoryError, normalizeError } from '../../../lib/repo/index.tsx';
import { goalsKeys } from '../../../lib/query/keys';
import { push } from '../../../lib/notifications/store';

const notifyError = (title: string, error: unknown) => {
  const normalized = error instanceof RepositoryError ? error : normalizeError(error);
  push({
    type: 'error',
    title,
    body: normalized.message
  });
};

export const useGoalsList = (params: GoalsListQuery) => {
  const repo = useGoalsRepository();
  return useQuery({
    queryKey: goalsKeys.list(params),
    queryFn: () => repo.list(params),
    placeholderData: keepPreviousData
  });
};

export const useGoal = (id: string | null | undefined) => {
  const repo = useGoalsRepository();
  return useQuery({
    queryKey: id ? goalsKeys.detail(id) : ['goals', 'detail', 'none'],
    queryFn: () => (id ? repo.get(id) : Promise.resolve(null)),
    enabled: Boolean(id)
  });
};

const updateCachesAfterCreate = (
  client: QueryClient,
  created: GoalRecord
) => {
  const targets = client.getQueriesData<{ items: GoalRecord[]; total: number }>({ queryKey: goalsKeys.all });
  targets.forEach(([key, data]) => {
    if (!data) return;
    client.setQueryData(key, {
      ...data,
      items: [created, ...data.items],
      total: data.total + 1
    });
  });
};

const updateCachesAfterUpdate = (
  client: QueryClient,
  updated: GoalRecord
) => {
  const targets = client.getQueriesData<{ items: GoalRecord[]; total: number }>({ queryKey: goalsKeys.all });
  targets.forEach(([key, data]) => {
    if (!data) return;
    client.setQueryData(key, {
      ...data,
      items: data.items.map(item => (item.id === updated.id ? updated : item))
    });
  });
  client.setQueryData(goalsKeys.detail(updated.id), updated);
};

const updateCachesAfterDelete = (client: QueryClient, id: string) => {
  const targets = client.getQueriesData<{ items: GoalRecord[]; total: number }>({ queryKey: goalsKeys.all });
  targets.forEach(([key, data]) => {
    if (!data) return;
    client.setQueryData(key, {
      ...data,
      items: data.items.filter(item => item.id !== id),
      total: Math.max(0, data.total - 1)
    });
  });
  client.removeQueries({ queryKey: goalsKeys.detail(id) });
};

export const useCreateGoal = () => {
  const repo = useGoalsRepository();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGoalInput) => repo.create(input),
    onSuccess: goal => {
      updateCachesAfterCreate(client, goal);
      push({ type: 'success', title: 'Goal created', body: `${goal.name} added.` });
    },
    onError: error => notifyError('Failed to create goal', error),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: goalsKeys.all });
    }
  });
};

export const useUpdateGoal = () => {
  const repo = useGoalsRepository();
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateGoalInput }) => repo.update(id, input),
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: goalsKeys.detail(id) });
      const previous = client.getQueryData<GoalRecord>(goalsKeys.detail(id));
      if (previous) {
        const optimistic = { ...previous, ...input, updatedAt: new Date().toISOString() } as GoalRecord;
        client.setQueryData(goalsKeys.detail(id), optimistic);
        updateCachesAfterUpdate(client, optimistic);
      }
      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        client.setQueryData(goalsKeys.detail(variables.id), context.previous);
        updateCachesAfterUpdate(client, context.previous);
      }
      notifyError('Failed to update goal', error);
    },
    onSuccess: goal => {
      updateCachesAfterUpdate(client, goal);
      push({ type: 'success', title: 'Goal updated', body: `${goal.name} saved.` });
    },
    onSettled: (_data, _error, variables) => {
      void client.invalidateQueries({ queryKey: goalsKeys.detail(variables.id) });
    }
  });
};

export const useDeleteGoal = () => {
  const repo = useGoalsRepository();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onMutate: async id => {
      await client.cancelQueries({ queryKey: goalsKeys.all });
      const previous = client.getQueriesData<{ items: GoalRecord[]; total: number }>({ queryKey: goalsKeys.all });
      updateCachesAfterDelete(client, id);
      return { previous };
    },
    onError: (error, id, context) => {
      if (context?.previous) {
        context.previous.forEach(([key, data]) => {
          client.setQueryData(key, data);
        });
      }
      notifyError('Failed to delete goal', error);
    },
    onSuccess: (_data, id) => {
      push({ type: 'success', title: 'Goal deleted', body: `Goal ${id} removed.` });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: goalsKeys.all });
    }
  });
};

export const invalidateGoalsList = (client: QueryClient) => {
  void client.invalidateQueries({ queryKey: goalsKeys.all });
};
