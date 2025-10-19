import React from 'react';

type PlaceholderPageProps = {
  title: string;
  description?: string;
};

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  description
}) => (
  <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
    <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
      {title}
    </h1>
    <p className="mt-2 max-w-lg text-slate-500 dark:text-slate-400">
      {description ??
        'Route scaffold ready. Connect real data sources and components in upcoming milestones.'}
    </p>
  </section>
);

export default PlaceholderPage;
