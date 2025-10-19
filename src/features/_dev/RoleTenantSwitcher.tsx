import React, { useMemo } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { availableRoles, availableTenants, useGuardContext } from '../../lib/rbac/guard';
import { useRepositoryAdapter } from '../../lib/repo/index.tsx';
import type { AdapterName } from '../../lib/repo';
import type { RoleId } from '../../lib/rbac/policy';

const RoleTenantSwitcher: React.FC = () => {
  const { user, currentTenantId, setRole, setCurrentTenant, setUserTenants } = useGuardContext();
  const { adapter, setAdapter } = useRepositoryAdapter();
  const queryClient = useQueryClient();

  if (!import.meta.env.DEV) {
    return null;
  }

  const tenantAssignments = useMemo(() => new Set(user.tenantIds), [user.tenantIds]);

  const handleRoleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setRole(event.target.value as RoleId);
  };

  const handleTenantToggle = (tenantId: string, checked: boolean) => {
    const next = new Set(user.tenantIds);
    if (checked) {
      next.add(tenantId);
    } else {
      next.delete(tenantId);
    }
    setUserTenants(Array.from(next));
  };

  const handleCurrentTenantChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setCurrentTenant(value === 'none' ? null : value);
  };

  const handleAdapterChange = (next: AdapterName) => {
    setAdapter(next);
    void queryClient.invalidateQueries();
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-left text-sm text-slate-600 shadow-inner dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      <header className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            DevTools · RBAC Switcher
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Emulate roles and tenant context locally. Only available in development.
          </p>
        </div>
      </header>

      <div className="space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Active role
          </span>
          <select
            value={user.role}
            onChange={handleRoleChange}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {availableRoles.map(role => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Tenant membership
          </p>
          <div className="grid gap-2">
            {availableTenants.map(tenant => {
              const checked = tenantAssignments.has(tenant.id);
              return (
                <label
                  key={tenant.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:border-slate-300 focus-within:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <span>{tenant.name}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={event => handleTenantToggle(tenant.id, event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500 dark:border-slate-600"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Current tenant context
          </span>
          <select
            value={currentTenantId ?? 'none'}
            onChange={handleCurrentTenantChange}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="none">None (global)</option>
            {availableTenants.map(tenant => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Repository adapter
          </span>
          <select
            value={adapter}
            onChange={event => handleAdapterChange(event.target.value as AdapterName)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="memory">Memory (mock)</option>
            <option value="http">HTTP (API)</option>
          </select>
        </label>
      </div>
    </section>
  );
};

export default RoleTenantSwitcher;
