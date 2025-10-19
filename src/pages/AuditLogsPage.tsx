import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import RequirePermission from '../components/rbac/RequirePermission';
import { iamSeedAuditEvents, type IamAuditEvent } from '../data';

const statusClasses: Record<IamAuditEvent['status'], string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  error: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
};

const AuditLogsContent: React.FC = () => {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return iamSeedAuditEvents;
    return iamSeedAuditEvents.filter(event =>
      [event.actor, event.action, event.target, event.status]
        .some(value => value.toLowerCase().includes(term))
    );
  }, [query]);

  return (
    <section className="flex flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Audit Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            IAM olay geçmişi. Rol atamaları, MFA zorlamaları ve sistem hataları gibi kritik aksiyonları listeler.
          </p>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Aktör, aksiyon veya hedef ara…"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{rows.length} kayıt</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="bg-slate-50 text-left font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Event ID</th>
              <th className="px-4 py-3">Aktör</th>
              <th className="px-4 py-3">Aksiyon</th>
              <th className="px-4 py-3">Hedef</th>
              <th className="px-4 py-3">Zaman</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-300">
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map(event => <AuditRow key={event.id} event={event} />)
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

const AuditRow: React.FC<{ event: IamAuditEvent }> = ({ event }) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
    <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-300">{event.id}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{event.actor}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{event.action}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{event.target}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{formatDate(event.ts)}</td>
    <td className="px-4 py-3">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[event.status]}`}>
        {event.status === 'success' ? 'Başarılı' : 'Hata'}
      </span>
    </td>
  </tr>
);

const AuditLogsPage: React.FC = () => (
  <RequirePermission permission="reports.auditLogs.read">
    <AuditLogsContent />
  </RequirePermission>
);

export default AuditLogsPage;
