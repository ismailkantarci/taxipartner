import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import RequirePermission from '../components/rbac/RequirePermission';
import { iamSeedUsers, type IamUser } from '../data';

const UsersTable: React.FC = () => {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return iamSeedUsers;
    return iamSeedUsers.filter(user =>
      [user.email, user.fullName, user.role, user.id]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(term))
    );
  }, [query]);

  return (
    <section className="flex flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Users</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Legacy IAM servisinden taşınacak kullanıcı listesi için örnek veri. Filtreleyerek inceleyebilirsin.
          </p>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search by ad, e-posta veya rol…"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{rows.length} kullanıcı</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="bg-slate-50 text-left font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Kullanıcı ID</th>
              <th className="px-4 py-3">Ad Soyad</th>
              <th className="px-4 py-3">E-posta</th>
              <th className="px-4 py-3">Rol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500 dark:text-slate-300">
                  Aradığın kriterlere uygun kullanıcı bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map(user => <UserRow key={user.id} user={user} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const UserRow: React.FC<{ user: IamUser }> = ({ user }) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{user.id}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{user.fullName}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{user.email}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{user.role}</td>
  </tr>
);

const UsersPage: React.FC = () => (
  <RequirePermission permission="iam.users.read">
    <UsersTable />
  </RequirePermission>
);

export default UsersPage;
