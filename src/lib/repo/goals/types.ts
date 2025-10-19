export type GoalDynamicStatus = 'ok' | 'warn' | 'risk';

export type GoalRecord = {
  id: string;
  name: string;
  owner: string;
  dynamicStatus: GoalDynamicStatus;
  audits: number;
  createdAt: string;
  updatedAt: string;
  lastAuditAt: string;
  summary?: string;
};

export type CreateGoalInput = {
  name: string;
  owner: string;
  dynamicStatus: GoalDynamicStatus;
  audits: number;
  summary?: string;
};

export type UpdateGoalInput = Partial<CreateGoalInput>;

export type GoalsListQuery = {
  search?: string;
  status?: GoalDynamicStatus[];
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  cols?: string[];
  /**
   * @deprecated Prefer cols
   */
  columns?: string[];
};

export type GoalsListResult = {
  items: GoalRecord[];
  total: number;
};
