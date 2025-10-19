import React from 'react';

const SecOpsPage: React.FC = () => (
  <section className="flex flex-1 flex-col gap-4">
    <header className="space-y-1">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Security Operations</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Coordinate incidents, intel feeds and playbooks across the TAXIPartner fleet.
      </p>
    </header>
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
      SOAR widgets, alert queues and on-call rotations plug in here during SecOps sprint.
    </div>
  </section>
);

export default SecOpsPage;

