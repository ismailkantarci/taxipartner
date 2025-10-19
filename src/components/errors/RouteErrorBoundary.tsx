import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

type RouteErrorBoundaryProps = {
  children: React.ReactNode;
  onReset?: () => void;
};

const RouteErrorFallback: React.FC<{ error: Error; reset: () => void }> = ({ error, reset }) => {
  const { t } = useTranslation();
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-3xl border border-rose-200 bg-rose-50 px-8 py-16 text-center text-slate-700 shadow-lg dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white dark:bg-rose-400">
        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t('route.error.title', { defaultValue: 'Something went wrong' })}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {error.message || t('route.error.generic', { defaultValue: 'We ran into an unexpected issue while loading this page.' })}
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        {t('route.error.retry', { defaultValue: 'Try again' })}
      </button>
    </section>
  );
};

const RouteErrorBoundary: React.FC<RouteErrorBoundaryProps> = ({ children, onReset }) => (
  <ErrorBoundary
    onReset={onReset}
    fallbackRender={({ error, resetErrorBoundary }) => (
      <RouteErrorFallback error={error} reset={resetErrorBoundary} />
    )}
  >
    {children}
  </ErrorBoundary>
);

export default RouteErrorBoundary;

