import React from 'react';

const ControlsPage: React.FC = () => (
  <section className="flex flex-1 flex-col gap-4">
    <header className="space-y-1">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Control Library</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Curate technical and procedural controls, map owners and automate attestations.
      </p>
    </header>
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
      Control catalogue scaffolding ready. Attach detail drawers, evidence checklists or scenario planners.
    </div>
  </section>
);

export default ControlsPage;

