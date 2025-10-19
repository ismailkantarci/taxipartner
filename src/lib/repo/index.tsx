import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  CreateGoalInput,
  GoalRecord,
  GoalsListQuery,
  GoalsListResult,
  UpdateGoalInput
} from './goals/types';
import type {
  ComplianceListQuery,
  ComplianceListResult,
  ComplianceRecord,
  CreateComplianceInput,
  UpdateComplianceInput
} from './compliance/types';
import type {
  RiskListQuery,
  RiskListResult,
  RiskRecord,
  CreateRiskInput,
  UpdateRiskInput
} from './risk/types';
import { createMemoryGoalsAdapter } from './memory';
import { createMemoryComplianceAdapter } from './compliance/memory';
import { createMemoryRiskAdapter } from './risk/memory';
import { createHttpGoalsAdapter, createHttpComplianceAdapter, createHttpRiskAdapter } from './http';
import {
  createMemorySettingsAdapter,
  createHttpSettingsAdapter,
  type SettingsAdapter
} from './settings';
import { registerSettingsAdapter } from '../settings/store';
import {
  createMemoryAuditAdapter,
  createHttpAuditAdapter,
  type AuditAdapter
} from './audit';

export type AdapterError = {
  message: string;
  cause?: unknown;
  statusCode?: number;
  details?: Record<string, unknown>;
};

export class RepositoryError extends Error {
  statusCode?: number;
  details?: Record<string, unknown>;

  constructor(message: string, options?: { statusCode?: number; details?: Record<string, unknown>; cause?: unknown }) {
    super(message);
    this.name = 'RepositoryError';
    this.statusCode = options?.statusCode;
    this.details = options?.details;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

export type GoalsAdapter = {
  list(query: GoalsListQuery): Promise<GoalsListResult>;
  get(id: string): Promise<GoalRecord | null>;
  create(input: CreateGoalInput): Promise<GoalRecord>;
  update(id: string, input: UpdateGoalInput): Promise<GoalRecord>;
  remove(id: string): Promise<void>;
};

export type ComplianceAdapter = {
  list(query: ComplianceListQuery): Promise<ComplianceListResult>;
  get(id: string): Promise<ComplianceRecord | null>;
  create(input: CreateComplianceInput): Promise<ComplianceRecord>;
  update(id: string, input: UpdateComplianceInput): Promise<ComplianceRecord>;
  remove(id: string): Promise<void>;
};

export type RiskAdapter = {
  list(query: RiskListQuery): Promise<RiskListResult>;
  get(id: string): Promise<RiskRecord | null>;
  create(input: CreateRiskInput): Promise<RiskRecord>;
  update(id: string, input: UpdateRiskInput): Promise<RiskRecord>;
  remove(id: string): Promise<void>;
};

export type AdapterName = 'memory' | 'http';

type RepositoryContextValue = {
  goals: GoalsAdapter;
  compliance: ComplianceAdapter;
  risk: RiskAdapter;
  settings: SettingsAdapter;
  audit: AuditAdapter;
  adapter: AdapterName;
  setAdapter: (adapter: AdapterName) => void;
};

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export const createAdapter = (name: AdapterName) => {
  if (name === 'http') {
    return {
      goals: createHttpGoalsAdapter(),
      compliance: createHttpComplianceAdapter(),
      risk: createHttpRiskAdapter(),
      settings: createHttpSettingsAdapter(),
      audit: createHttpAuditAdapter()
    };
  }
  return {
    goals: createMemoryGoalsAdapter(),
    compliance: createMemoryComplianceAdapter(),
    risk: createMemoryRiskAdapter(),
    settings: createMemorySettingsAdapter(),
    audit: createMemoryAuditAdapter()
  };
};

type RepositoryProviderProps = {
  initialAdapter?: AdapterName;
  children: React.ReactNode;
};

const DEFAULT_ADAPTER = (import.meta.env.VITE_REPO_ADAPTER ?? 'memory') as AdapterName;

export const RepositoryProvider: React.FC<RepositoryProviderProps> = ({
  initialAdapter = DEFAULT_ADAPTER,
  children
}) => {
  const [adapterName, setAdapterName] = useState<AdapterName>(initialAdapter);

  const adapters = useMemo(() => createAdapter(adapterName), [adapterName]);

  const setAdapter = useCallback((name: AdapterName) => {
    setAdapterName(name);
  }, []);

  useEffect(() => {
    registerSettingsAdapter(adapters.settings);
  }, [adapters.settings]);

  const value = useMemo<RepositoryContextValue>(
    () => ({
      goals: adapters.goals,
      compliance: adapters.compliance,
      risk: adapters.risk,
      settings: adapters.settings,
      audit: adapters.audit,
      adapter: adapterName,
      setAdapter
    }),
    [adapters, adapterName, setAdapter]
  );

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
};

export const useRepositoryContext = () => {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useRepositoryContext must be used within a RepositoryProvider');
  }
  return context;
};

export const useGoalsRepository = (): GoalsAdapter => {
  const context = useRepositoryContext();
  return context.goals;
};

export const useRepositoryAdapter = () => {
  const context = useRepositoryContext();
  return {
    adapter: context.adapter,
    setAdapter: context.setAdapter
  };
};

export const useComplianceRepository = (): ComplianceAdapter => {
  const context = useRepositoryContext();
  return context.compliance;
};

export const useRiskRepository = (): RiskAdapter => {
  const context = useRepositoryContext();
  return context.risk;
};

export const useAuditRepository = (): AuditAdapter => {
  const context = useRepositoryContext();
  return context.audit;
};

export const normalizeError = (error: unknown, fallbackMessage = 'Unexpected repository error'): RepositoryError => {
  if (error instanceof RepositoryError) {
    return error;
  }
  if (error instanceof Error) {
    return new RepositoryError(error.message, { cause: error });
  }
  return new RepositoryError(fallbackMessage, { details: { error } });
};
