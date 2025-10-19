import React from 'react';
import { useGuardContext } from '../lib/rbac/guard';

const DashboardPage: React.FC = () => {
  const { user, currentTenantId } = useGuardContext();

  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Hoş geldin, {user.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          TAXIPartner Admin çalışma alanındasın. Aşağıdaki kartlar repo adapter’ı, dil ve tenant bilgilerini özetler.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Aktif Rol</p>
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{user.role}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tenant</p>
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{currentTenantId ?? 'Seçilmedi'}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Durum</p>
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Next modules porting in progress…</p>
        </article>
      </div>
    </section>
  );
};

export default DashboardPage;

