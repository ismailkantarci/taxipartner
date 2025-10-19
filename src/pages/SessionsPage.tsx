import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import RequirePermission from '../components/rbac/RequirePermission';
import { iamSeedSessions, type IamSession } from '../data';

const statusClasses: Record<IamSession['status'], string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  revoked: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
};

const SessionsContent: React.FC = () => {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return iamSeedSessions;
    return iamSeedSessions.filter(session =>
      [session.userEmail, session.device, session.location, session.status]
        .some(value => value.toLowerCase().includes(term))
    );
  }, [query]);

  return (
    <section className="flex flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sessions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Aktif ve sonlandırılmış IAM oturumlarının örnek listesi. Cihaz bilgileri ve konum verileri gösterilir.
          </p>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="E-posta, cihaz veya durum ara…"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{rows.length} oturum</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="bg-slate-50 text-left font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Session ID</th>
              <th className="px-4 py-3">Kullanıcı</th>
              <th className="px-4 py-3">Cihaz</th>
              <th className="px-4 py-3">Konum</th>
              <th className="px-4 py-3">Son Aktivite</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-300">
                  Sonuç bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map(session => <SessionRow key={session.id} session={session} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const SessionRow: React.FC<{ session: IamSession }> = ({ session }) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
    <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-300">{session.id}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{session.userEmail}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{session.device}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{session.location}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{formatDate(session.lastSeen)}</td>
    <td className="px-4 py-3">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[session.status]}`}>
        {session.status === 'active' ? 'Aktif' : 'Sonlandırıldı'}
      </span>
    </td>
  </tr>
);

const SessionsPage: React.FC = () => (
  <RequirePermission permission="iam.sessions.read">
    <SessionsContent />
  </RequirePermission>
);

export default SessionsPage;
