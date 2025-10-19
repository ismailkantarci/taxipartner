import React from 'react';
import { ClipboardList } from 'lucide-react';

const ProgramAuditsPage: React.FC = () => (
  <section className="flex flex-1 flex-col gap-5">
    <header>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Audit workspace
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        v0.3 ships route alignment. Connect TanStack Table + workflow widgets in
        the next milestone.
      </p>
    </header>
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
      <ClipboardList className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500" />
      <p className="font-medium text-slate-700 dark:text-slate-200">
        Hook audits data here in v0.4
      </p>
      <p className="mt-2 max-w-md text-slate-500 dark:text-slate-400">
        Tabs now rely on React Router. Preserve query params when switching back
        to the goals view to keep filters aligned.
      </p>
    </div>
  </section>
);

export default ProgramAuditsPage;
