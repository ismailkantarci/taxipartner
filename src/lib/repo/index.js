import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createMemoryGoalsAdapter } from './memory';
import { createMemoryComplianceAdapter } from './compliance/memory';
import { createMemoryRiskAdapter } from './risk/memory';
import { createHttpGoalsAdapter, createHttpComplianceAdapter, createHttpRiskAdapter } from './http';
import { createMemorySettingsAdapter, createHttpSettingsAdapter } from './settings';
import { registerSettingsAdapter } from '../settings/store';
import { createMemoryAuditAdapter, createHttpAuditAdapter } from './audit';
export class RepositoryError extends Error {
    statusCode;
    details;
    constructor(message, options) {
        super(message);
        this.name = 'RepositoryError';
        this.statusCode = options?.statusCode;
        this.details = options?.details;
        if (options?.cause) {
            this.cause = options.cause;
        }
    }
}
const RepositoryContext = createContext(null);
export const createAdapter = (name) => {
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
const DEFAULT_ADAPTER = (import.meta.env.VITE_REPO_ADAPTER ?? 'memory');
export const RepositoryProvider = ({ initialAdapter = DEFAULT_ADAPTER, children }) => {
    const [adapterName, setAdapterName] = useState(initialAdapter);
    const adapters = useMemo(() => createAdapter(adapterName), [adapterName]);
    const setAdapter = useCallback((name) => {
        setAdapterName(name);
    }, []);
    useEffect(() => {
        registerSettingsAdapter(adapters.settings);
    }, [adapters.settings]);
    const value = useMemo(() => ({
        goals: adapters.goals,
        compliance: adapters.compliance,
        risk: adapters.risk,
        settings: adapters.settings,
        audit: adapters.audit,
        adapter: adapterName,
        setAdapter
    }), [adapters, adapterName, setAdapter]);
    return _jsx(RepositoryContext.Provider, { value: value, children: children });
};
export const useRepositoryContext = () => {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('useRepositoryContext must be used within a RepositoryProvider');
    }
    return context;
};
export const useGoalsRepository = () => {
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
export const useComplianceRepository = () => {
    const context = useRepositoryContext();
    return context.compliance;
};
export const useRiskRepository = () => {
    const context = useRepositoryContext();
    return context.risk;
};
export const useAuditRepository = () => {
    const context = useRepositoryContext();
    return context.audit;
};
export const normalizeError = (error, fallbackMessage = 'Unexpected repository error') => {
    if (error instanceof RepositoryError) {
        return error;
    }
    if (error instanceof Error) {
        return new RepositoryError(error.message, { cause: error });
    }
    return new RepositoryError(fallbackMessage, { details: { error } });
};
