import type { GoalsListQuery } from '../repo/goals/types';

export const goalsKeys = {
  all: ['goals'] as const,
  list: (params: GoalsListQuery) =>
    ['goals', 'list', params.search ?? '', params.sort ?? '', params.order ?? 'asc', params.page ?? 0, params.pageSize ?? 10, (params.status ?? []).join(','), (params.cols ?? []).join(',')] as const,
  detail: (id: string) => ['goals', 'detail', id] as const
};
