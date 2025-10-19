import React from 'react';
import RequirePermission from '../components/rbac/RequirePermission';

const MandatesContent: React.FC = () => (
  <section className="flex flex-1 flex-col gap-4">
    <header className="space-y-1">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Mandates</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Capture permits, concessions and mandate coverage by tenant or company.
      </p>
    </header>
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
      Connect document workflows and lifecycle states once compliance schemas land.
    </div>
  </section>
);

const MandatesPage: React.FC = () => (
  <RequirePermission permission="tenants.manage">
    <MandatesContent />
  </RequirePermission>
);

export default MandatesPage;

