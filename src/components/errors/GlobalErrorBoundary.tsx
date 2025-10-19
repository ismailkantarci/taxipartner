import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { LifeBuoy } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

type GlobalErrorBoundaryProps = {
  children: React.ReactNode;
};

const GlobalFallback: React.FC<{ error: Error; reset: () => void }> = ({ error }) => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 text-slate-100">
      <LifeBuoy className="h-12 w-12 text-slate-300" aria-hidden="true" />
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold">{t('global.error.title', { defaultValue: 'We’re fixing it.' })}</h1>
        <p className="text-sm text-slate-300">
          {t('global.error.message', {
            defaultValue: 'An unexpected error occurred. Our team has been notified.'
          })}
        </p>
        <p className="text-xs text-slate-400">{error.message}</p>
        <a
          href="mailto:support@taxipartner.dev"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {t('global.error.support', { defaultValue: 'Contact support' })}
        </a>
      </div>
    </div>
  );
};

const GlobalErrorBoundary: React.FC<GlobalErrorBoundaryProps> = ({ children }) => (
  <ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => <GlobalFallback error={error} reset={resetErrorBoundary} />}> 
    {children}
  </ErrorBoundary>
);

export default GlobalErrorBoundary;

