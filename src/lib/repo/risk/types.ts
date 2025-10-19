export type RiskStatus = 'low' | 'moderate' | 'high';

export type RiskRecord = {
  id: string;
  title: string;
  owner: string;
  status: RiskStatus;
  impact: 'low' | 'medium' | 'high';
  likelihood: 'unlikely' | 'possible' | 'likely';
  updatedAt: string;
  description?: string;
  controls?: number;
};

export type RiskListQuery = {
  q?: string;
  status?: RiskStatus[];
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  cols?: string[];
};

export type RiskListResult = {
  items: RiskRecord[];
  total: number;
};

export type CreateRiskInput = Omit<RiskRecord, 'id' | 'updatedAt'>;
export type UpdateRiskInput = Partial<Omit<RiskRecord, 'id'>>;
