export type UserId = string;

export type UserSummary = {
  id: UserId;
  email?: string | null;
  roles: string[];
  mfaEnabled: boolean;
  sessionsCount: number;
};

export type UserDetail = {
  id: UserId;
  email?: string | null;
  roles: string[];
  claims?: any;
  mfaEnabled: boolean;
  sessions?: string[];
};

export type RoleItem = {
  name: string;
  scope?: 'global' | 'tenant' | string;
};

export type Paging = {
  skip: number;
  take: number;
  total?: number;
};
