export type ComplianceCategory =
  | 'packages'
  | 'analysis'
  | 'exceptions'
  | 'external-audit-findings';

export type ComplianceStatus = 'ok' | 'attention' | 'blocked';

export type ComplianceRecord = {
  id: string;
  name: string;
  owner: string;
  category: ComplianceCategory;
  status: ComplianceStatus;
  updatedAt: string;
  items?: number;
  summary?: string;
};

export type ComplianceListQuery = {
  category: ComplianceCategory;
  q?: string;
  status?: ComplianceStatus[];
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  cols?: string[];
};

export type ComplianceListResult = {
  items: ComplianceRecord[];
  total: number;
};

export type CreateComplianceInput = Omit<ComplianceRecord, 'id' | 'updatedAt'>;
export type UpdateComplianceInput = Partial<Omit<ComplianceRecord, 'id'>>;
