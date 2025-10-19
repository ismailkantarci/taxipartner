import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QueryErrorBoundary from '../../components/errors/QueryErrorBoundary';
import { useRisk } from '../../features/risk/api';
import { ArrowLeft, ClipboardList, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const RiskDetailContent: React.FC = () => {
  const { riskId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useRisk(riskId ?? null);

  if (!riskId) {
    return (
      <section className="flex flex-1 flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate('/risk')}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to risks
        </button>
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          <ClipboardList className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">Risk not found</p>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-4 text-sm text-slate-500 dark:text-slate-300">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        Loading risk…
      </section>
    );
  }

  if (isError) {
    throw error ?? new Error('Failed to load risk');
  }

  if (!data) {
    return (
      <section className="flex flex-1 flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate('/risk')}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to risks
        </button>
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          <ClipboardList className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">Risk not found</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-6">
      <button
        type="button"
        onClick={() => navigate('/risk')}
        className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to risks
      </button>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{data.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Owned by {data.owner}</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900">{data.status.toUpperCase()}</span>
        </div>
      </header>
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Summary</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{data.description ?? 'No description provided.'}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Impact</dt>
            <dd className="mt-2 font-medium text-slate-800 dark:text-slate-100">{data.impact}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Likelihood</dt>
            <dd className="mt-2 font-medium text-slate-800 dark:text-slate-100">{data.likelihood}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Controls</dt>
            <dd className="mt-2 font-medium text-slate-800 dark:text-slate-100">{data.controls ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Last updated</dt>
            <dd className="mt-2 font-medium text-slate-800 dark:text-slate-100">{format(new Date(data.updatedAt), 'PPpp')}</dd>
          </div>
        </dl>
      </section>
    </section>
  );
};

const RiskDetailPage: React.FC = () => (
  <QueryErrorBoundary>
    <RiskDetailContent />
  </QueryErrorBoundary>
);

export default RiskDetailPage;
