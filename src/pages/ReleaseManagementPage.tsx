import React, { useMemo, useState } from 'react';
import { CalendarRange, Rocket } from 'lucide-react';
import releaseLog from '../../modules/ReleaseManagement/release-log.json';
import RequirePermission from '../components/rbac/RequirePermission';

type ReleaseEntry = (typeof releaseLog)[number];

const getDescription = (entry: ReleaseEntry) => {
  const desc = entry.description;
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  return desc.tr || desc.en || desc.de || Object.values(desc)[0] || '';
};

const ReleaseManagementContent: React.FC = () => {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = releaseLog as ReleaseEntry[];
    const filtered = term
      ? list.filter(item =>
          [item.version, item.status, item.author, getDescription(item)]
            .filter(Boolean)
            .some(value => value!.toLowerCase().includes(term))
        )
      : list;
    return filtered.slice(0, 30); // listeyi yoğunluktan kaçınmak için sınırla
  }, [query]);

  return (
    <section className="flex flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
            <Rocket className="h-5 w-5" /> Release Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            modules/ReleaseManagement/release-log.json dosyasındaki sürümleri listeler. Arama barı ile belirli sürümleri bulabilirsin.
          </p>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <input
            type="search"
            placeholder="Sürüm, yazar veya durum ara…"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{rows.length} satır gösteriliyor</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="bg-slate-50 text-left font-semibold text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Sürüm</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Yazar</th>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Not</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500 dark:text-slate-300">
                  Eşleşen sürüm bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map(entry => <ReleaseRow key={`${entry.version}-${entry.date}`} entry={entry} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const ReleaseRow: React.FC<{ entry: ReleaseEntry }> = ({ entry }) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{entry.version}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{entry.status ?? '—'}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{entry.author ?? '—'}</td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">
      <span className="inline-flex items-center gap-1">
        <CalendarRange className="h-3.5 w-3.5" /> {entry.date ?? '—'}
      </span>
    </td>
    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">
      <p className="line-clamp-3 text-xs text-slate-500 dark:text-slate-400">{getDescription(entry)}</p>
    </td>
  </tr>
);

const ReleaseManagementPage: React.FC = () => (
  <RequirePermission permission="system.devtools">
    <ReleaseManagementContent />
  </RequirePermission>
);

export default ReleaseManagementPage;

