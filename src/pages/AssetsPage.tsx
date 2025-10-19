import React from 'react';

const AssetsPage: React.FC = () => (
  <section className="flex flex-1 flex-col gap-4">
    <header className="space-y-1">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Asset Inventory</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Track vehicles, endpoints and data stores with lifecycle telemetry.
      </p>
    </header>
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
      Asset catalog UI hooks into this slot. Expect TanStack tables and map overlays in upcoming drops.
    </div>
  </section>
);

export default AssetsPage;

