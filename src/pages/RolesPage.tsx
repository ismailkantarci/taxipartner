import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import RequirePermission from '../components/rbac/RequirePermission';
import { iamSeedRoles, type IamRole } from '../data';

const RolesContent: React.FC = () => {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return iamSeedRoles;
    return iamSeedRoles.filter(role =>
      [role.name, role.description, ...role.permissions]
        .some(value => value.toLowerCase().includes(term))
    );
  }, [query]);

  return (
    <section className="flex flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Roles</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Legacy rol şablonlarından örnekler. Yakında gerçek IAM API’sine bağlanacak.
          </p>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Rol adı veya izin ara…"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{rows.length} rol</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="bg-slate-50 text-left font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Açıklama</th>
              <th className="px-4 py-3">İzinler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-slate-500 dark:text-slate-300">
                  Aradığın kritere uygun rol bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map(role => <RoleRow key={role.name} role={role} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const RoleRow: React.FC<{ role: IamRole }> = ({ role }) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{role.name}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{role.description}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">
      <div className="flex flex-wrap gap-2">
        {role.permissions.map(permission => (
          <span key={permission} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {permission}
          </span>
        ))}
      </div>
    </td>
  </tr>
);

const RolesPage: React.FC = () => (
  <RequirePermission permission="iam.roles.read">
    <RolesContent />
  </RequirePermission>
);

export default RolesPage;
