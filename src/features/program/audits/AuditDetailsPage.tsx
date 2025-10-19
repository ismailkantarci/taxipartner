import React from 'react';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const AuditDetailsPage: React.FC = () => {
  const { auditId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    const params = new URLSearchParams(location.search);
    params.delete('modal');
    const query = params.toString();
    navigate({ pathname: '/program/audits', search: query ? `?${query}` : '' });
  };

  return (
    <section className="flex flex-1 flex-col gap-6">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to audits
      </button>
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
        <ClipboardCheck className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="font-semibold text-slate-700 dark:text-slate-200">Audit details coming soon</p>
        <p className="mt-2 max-w-lg">
          Route <span className="font-semibold">{auditId}</span> is wired to the router with query persistence. Hook real audit data and URL-driven modals in v0.5.
        </p>
      </div>
    </section>
  );
};

export default AuditDetailsPage;
