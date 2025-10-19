import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import storage from '../../utils/storage';
import { setTenantId } from '../tenant/store';
import { policy, type PermissionKey, type PolicyDecision, type RbacUser, ROLES } from './policy';

type TenantInfo = {
  id: string;
  name: string;
};

export type GuardContextValue = {
  user: RbacUser;
  currentTenantId: string | null;
  tenants: TenantInfo[];
  setRole: (role: RbacUser['role']) => void;
  setCurrentTenant: (tenantId: string | null) => void;
  setUserTenants: (tenantIds: string[]) => void;
  updateUser: (updater: (prev: RbacUser) => RbacUser) => void;
};

const RBAC_STORAGE_KEY = 'tp-admin@rbac-state';

const DEFAULT_TENANTS: TenantInfo[] = [
  { id: 'tenant-vienna', name: 'Vienna HQ' },
  { id: 'tenant-berlin', name: 'Berlin Ops' },
  { id: 'tenant-zurich', name: 'Zurich Compliance' }
];

const DEFAULT_USER: RbacUser = {
  id: 'user-demo',
  name: 'Admin Demo',
  role: 'superAdmin',
  tenantIds: [DEFAULT_TENANTS[0].id],
  extraPermissions: ['system.devtools']
};

type PersistedState = {
  user: RbacUser;
  currentTenantId: string | null;
};

const GuardContext = createContext<GuardContextValue | null>(null);

const readInitialState = (): PersistedState => {
  if (typeof window === 'undefined') {
    return {
      user: DEFAULT_USER,
      currentTenantId: DEFAULT_TENANTS[0].id
    };
  }
  const stored = storage.get<PersistedState>(RBAC_STORAGE_KEY);
  if (stored?.user) {
    return stored;
  }
  return {
    user: DEFAULT_USER,
    currentTenantId: DEFAULT_TENANTS[0].id
  };
};

export const GuardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [{ user, currentTenantId }, setState] = useState<PersistedState>(() => readInitialState());

  useEffect(() => {
    storage.set(RBAC_STORAGE_KEY, { user, currentTenantId });
  }, [user, currentTenantId]);

  const setRole = useCallback((role: RbacUser['role']) => {
    setState(prev => ({
      ...prev,
      user: {
        ...prev.user,
        role
      }
    }));
  }, []);

  const setCurrentTenant = useCallback((tenantId: string | null) => {
    setState(prev => {
      if (!tenantId) {
        return { ...prev, currentTenantId: null };
      }
      const hasTenant =
        prev.user.role === 'superAdmin' || prev.user.tenantIds.includes(tenantId)
          ? true
          : false;
      return {
        user: hasTenant
          ? prev.user
          : {
              ...prev.user,
              tenantIds: Array.from(new Set([...prev.user.tenantIds, tenantId]))
            },
        currentTenantId: tenantId
      };
    });
  }, []);

  const setUserTenants = useCallback((tenantIds: string[]) => {
    setState(prev => ({
      ...prev,
      user: {
        ...prev.user,
        tenantIds: tenantIds.length ? Array.from(new Set(tenantIds)) : prev.user.tenantIds
      },
      currentTenantId: tenantIds.includes(prev.currentTenantId ?? '')
        ? prev.currentTenantId
        : tenantIds[0] ?? null
    }));
  }, []);

  const updateUser = useCallback((updater: (prev: RbacUser) => RbacUser) => {
    setState(prev => ({
      ...prev,
      user: updater(prev.user)
    }));
  }, []);

  const value = useMemo<GuardContextValue>(
    () => ({
      user,
      currentTenantId,
      tenants: DEFAULT_TENANTS,
      setRole,
      setCurrentTenant,
      setUserTenants,
      updateUser
    }),
    [user, currentTenantId, setRole, setCurrentTenant, setUserTenants, updateUser]
  );

  useEffect(() => {
    setTenantId(currentTenantId);
  }, [currentTenantId]);

  return <GuardContext.Provider value={value}>{children}</GuardContext.Provider>;
};

export const useGuardContext = () => {
  const context = useContext(GuardContext);
  if (!context) {
    throw new Error('useGuardContext must be used within GuardProvider');
  }
  return context;
};

export type UseCanOptions = {
  tenantId?: string | null;
};

export const useCan = (permission: PermissionKey, options?: UseCanOptions): boolean => {
  const { user, currentTenantId } = useGuardContext();
  return policy.can({
    permission,
    user,
    currentTenantId,
    resourceTenantId: options?.tenantId ?? null
  });
};

export const usePolicyCheck = (
  permission: PermissionKey,
  options?: UseCanOptions
): PolicyDecision => {
  const { user, currentTenantId } = useGuardContext();
  return useMemo(
    () =>
      policy.evaluate({
        permission,
        user,
        currentTenantId,
        resourceTenantId: options?.tenantId ?? null
      }),
    [permission, options?.tenantId, user, currentTenantId]
  );
};

type GuardProps =
  | {
      can: PermissionKey;
      children: React.ReactNode;
      tenantId?: string | null;
      fallback?: React.ReactNode;
      requireAll?: never;
    }
  | {
      can: PermissionKey[];
      children: React.ReactNode;
      tenantId?: string | null;
      fallback?: React.ReactNode;
      requireAll?: boolean;
    };

export const Guard: React.FC<GuardProps> = ({
  can,
  children,
  tenantId = null,
  fallback = null,
  requireAll = true
}) => {
  const { user, currentTenantId } = useGuardContext();

  const evaluate = useCallback(
    (permission: PermissionKey) =>
      policy.evaluate({
        permission,
        user,
        currentTenantId,
        resourceTenantId: tenantId
      }),
    [user, currentTenantId, tenantId]
  );

  const decisions = Array.isArray(can)
    ? can.map(permission => evaluate(permission))
    : [evaluate(can)];

  const allowed = Array.isArray(can)
    ? requireAll
      ? decisions.every(decision => decision.allowed)
      : decisions.some(decision => decision.allowed)
    : decisions[0]?.allowed ?? false;

  if (!allowed) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};

export type GuardedActionOptions = UseCanOptions & {
  onDenied?: (decision: PolicyDecision) => void;
};

export const useGuardedAction = <Args extends unknown[], Return>(
  permission: PermissionKey,
  handler: (...args: Args) => Return,
  options?: GuardedActionOptions
) => {
  const { user, currentTenantId } = useGuardContext();

  return useCallback(
    (...args: Args) => {
      const decision = policy.evaluate({
        permission,
        user,
        currentTenantId,
        resourceTenantId: options?.tenantId ?? null
      });

      if (!decision.allowed) {
        options?.onDenied?.(decision);
        return undefined;
      }
      return handler(...args);
    },
    [handler, permission, options?.tenantId, options?.onDenied, user, currentTenantId]
  );
};

export const availableRoles = ROLES;
export const availableTenants: TenantInfo[] = DEFAULT_TENANTS;
