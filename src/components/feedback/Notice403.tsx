import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

type Notice403Props = {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
};

const defaultCopy = {
  title: 'Access denied',
  description:
    'You do not currently have permission to view this area. Switch to a role with the required access or contact an administrator.',
  actionLabel: 'Back to dashboard',
  actionHref: '/dashboard'
};

export const Notice403: React.FC<Notice403Props> = ({
  title = defaultCopy.title,
  description = defaultCopy.description,
  actionLabel = defaultCopy.actionLabel,
  actionHref = defaultCopy.actionHref
}) => (
  <section
    role="region"
    aria-labelledby="forbidden-title"
    className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-3xl border border-slate-200 bg-white px-8 py-16 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900"
  >
    <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200">
      <ShieldAlert className="h-8 w-8" aria-hidden="true" />
    </span>
    <div>
      <h1 id="forbidden-title" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{description}</p>
    </div>
    <Link
      to={actionHref}
      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
    >
      {actionLabel}
    </Link>
  </section>
);

export default Notice403;

