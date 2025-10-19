import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { normalizeError } from '../../lib/repo/index.tsx';
import { push } from '../../lib/notifications/store';

const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ error, resetErrorBoundary }) => {
  const normalized = normalizeError(error);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-slate-600 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white dark:bg-rose-400">
        <RefreshCw className="h-6 w-6" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Something went wrong</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{normalized.message}</p>
      </div>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Retry
      </button>
    </div>
  );
};

const QueryErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { reset } = useQueryErrorResetBoundary();

  const handleError = (error: Error) => {
    const normalized = normalizeError(error);
    push({
      type: 'error',
      title: 'Request failed',
      body: normalized.message
    });
  };

  return (
    <ErrorBoundary
      onReset={reset}
      onError={handleError}
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
};

export default QueryErrorBoundary;
