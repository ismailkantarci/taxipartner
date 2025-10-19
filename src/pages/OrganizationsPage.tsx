import React from 'react';
import RequirePermission from '../components/rbac/RequirePermission';

const OrganizationsContent: React.FC = () => (
  <section className="flex flex-1 flex-col gap-4">
    <header className="space-y-1">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Organizations</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Model mandate groups, reporting lines and contracting entities per tenant.
      </p>
    </header>
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
      Organization designer to be embedded. Tie in tree views or drag-drop builders.
    </div>
  </section>
);

const OrganizationsPage: React.FC = () => (
  <RequirePermission permission="tenants.manage">
    <OrganizationsContent />
  </RequirePermission>
);

export default OrganizationsPage;

