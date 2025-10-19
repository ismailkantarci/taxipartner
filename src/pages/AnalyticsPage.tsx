import React, { useMemo, useState } from 'react';
import { BarChart3, Download, RefreshCw, Trash2, Search } from 'lucide-react';
import RequirePermission from '../components/rbac/RequirePermission';

type TelemetryEvent = {
  t?: string;
  event: string;
  name?: string;
  dur?: number;
  route?: string;
};

const readTelemetry = (): TelemetryEvent[] => {
  try {
    const raw = localStorage.getItem('Telemetry');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const AnalyticsContent: React.FC = () => {
  const [events, setEvents] = useState<TelemetryEvent[]>(() => readTelemetry());
  const [query, setQuery] = useState('');

  const filteredEvents = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return events;
    return events.filter(item =>
      [item.event, item.name, item.route]
        .filter(Boolean)
        .some(value => value!.toLowerCase().includes(term))
    );
  }, [events, query]);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    filteredEvents.forEach(event => {
      const key = event.event || 'unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const maxCount = entries.length ? Math.max(...entries.map(([, count]) => count)) : 1;
    return { entries, maxCount };
  }, [filteredEvents]);

  const recentEvents = useMemo(
    () =>
      filteredEvents
        .slice(-20)
        .reverse()
        .map((event, index) => ({ id: index, ...event })),
    [filteredEvents]
  );

  const handleRefresh = () => {
    setEvents(readTelemetry());
  };

  const handleExport = (type: 'json' | 'csv') => {
    const data = readTelemetry();
    if (type === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'telemetry.json';
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const keys: Array<keyof TelemetryEvent> = ['t', 'event', 'name', 'dur', 'route'];
    const header = keys.join(',');
    const rows = data.map(item =>
      keys
        .map(key => {
          const value = item[key];
          const safe = value === undefined || value === null ? '' : String(value);
          const sanitized = /^[=+\-@]/.test(safe) ? `'${safe}` : safe;
          return `"${sanitized.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const blob = new Blob([`\ufeff${header}\n${rows.join('\n')}`], {
      type: 'text/csv;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'telemetry.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    localStorage.removeItem('Telemetry');
    setEvents([]);
  };

  return (
    <section className="flex flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
            <BarChart3 className="h-5 w-5" />
            Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Telemetry olaylarını yerel tarayıcı depolamasından okur. Export düğmeleri ile veriyi dışa aktarabilirsin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Yenile
          </button>
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            JSON
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/20"
          >
            <Trash2 className="h-4 w-4" />
            Temizle
          </button>
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
            placeholder="Event veya route ara…"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {filteredEvents.length} kayıt · toplam {events.length}
        </span>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-200">Event türleri</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Telemetry event tipi başına toplam çağrı sayısı ve ASCII bar grafiği.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-200">
            {summary.entries.length === 0 ? (
              <li className="text-xs text-slate-500 dark:text-slate-400">Henüz event kaydı yok.</li>
            ) : (
              summary.entries.map(([event, count]) => {
                const blocks = Math.max(1, Math.round((count / summary.maxCount) * 20));
                const bar = '█'.repeat(blocks);
                return (
                  <li key={event} className="flex items-center justify-between gap-3 font-mono text-xs">
                    <span className="flex-1 truncate">{event}</span>
                    <span className="flex-[2] truncate text-emerald-500 dark:text-emerald-300">{bar}</span>
                    <span>{count}</span>
                  </li>
                );
              })
            )}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-200">Son 20 event</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Görüntülenen liste en son event’ten başlayarak sıralanır.
          </p>
          <div className="mt-3 space-y-2 max-h-[340px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-900">
            {recentEvents.length === 0
              ? 'Henüz kayıt yok.'
              : recentEvents.map(item => (
                  <div key={item.id} className="rounded-md bg-white p-2 shadow-sm dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{item.event}</span>
                      <span className="text-[10px] text-slate-400">
                        {item.t ? new Date(item.t).toLocaleTimeString() : '—'}
                      </span>
                    </div>
                    {item.route ? (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">route: {item.route}</div>
                    ) : null}
                    {item.name ? (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">name: {item.name}</div>
                    ) : null}
                    {typeof item.dur === 'number' ? (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">duration: {item.dur.toFixed(0)} ms</div>
                    ) : null}
                  </div>
                ))}
          </div>
        </article>
      </section>
    </section>
  );
};

const AnalyticsPage: React.FC = () => (
  <RequirePermission permission="system.devtools">
    <AnalyticsContent />
  </RequirePermission>
);

export default AnalyticsPage;
