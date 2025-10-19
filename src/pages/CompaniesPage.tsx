import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import RequirePermission from '../components/rbac/RequirePermission';

const CompaniesContent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | void;

    const mount = async () => {
      if (!containerRef.current) return;
      setStatus('loading');
      try {
        const mod = await import('../../frontend/companies/page.ts');
        if (!mounted) return;
        const result = await mod.mountCompaniesPage(containerRef.current);
        if (!mounted) return;
        cleanup = typeof result === 'function' ? result : undefined;
        setStatus('ready');
      } catch (err) {
        if (!mounted) return;
        console.error('[companies] legacy mount failed', err);
        setError(err instanceof Error ? err.message : 'Beklenmedik bir hata oluştu.');
        setStatus('error');
      }
    };

    void mount();

    return () => {
      mounted = false;
      if (cleanup) {
        try {
          cleanup();
        } catch (err) {
          console.warn('[companies] cleanup failed', err);
        }
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <section className="flex flex-1 flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Companies</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Bu ekran legacy Companies modülünü yükler. Yakında query katmanına taşınacaktır.
        </p>
      </header>
      {status === 'error' ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
          {error ?? 'Modül yüklenemedi.'}
        </div>
      ) : null}
      {status !== 'ready' ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Companies modülü yükleniyor…
        </div>
      ) : null}
      <div
        ref={containerRef}
        className="min-h-[520px] rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      />
    </section>
  );
};

const CompaniesPage: React.FC = () => (
  <RequirePermission permission="tenants.manage">
    <CompaniesContent />
  </RequirePermission>
);

export default CompaniesPage;

