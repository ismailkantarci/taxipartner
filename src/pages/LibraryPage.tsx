import React from 'react';
import { BookOpen } from 'lucide-react';
import { colors, spacing, typography, breakpoints } from '../../modules/library/tokens/index.js';

const LibraryPage: React.FC = () => (
  <section className="flex flex-1 flex-col gap-6">
    <header className="space-y-2">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        <BookOpen className="h-6 w-6" /> Design Library
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Paylaşılan tasarım sistemi token’larının hızlı ön izlemesi. Demo komutlarını ve telefon input örneğini buradan görebilirsin.
      </p>
    </header>

    <section className="grid gap-6 lg:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Renk Paleti</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          @taxipartner/library paketinden yayınlanan brand + status tonları.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.entries(colors.brand).map(([token, value]) => (
            <ColorSwatch key={token} name={token} value={String(value)} />
          ))}
          {Object.entries(colors.status).map(([token, value]) => (
            <ColorSwatch key={`status-${token}`} name={token} value={String(value)} />
          ))}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Spacing &amp; Typography</h2>
        <div className="mt-3 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Spacing</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Object.entries(spacing).map(([step, value]) => (
                <div key={step} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <span className="font-medium">{step}</span>
                  <span className="font-mono">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Typography</h3>
            <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <li><strong>Aile:</strong> {typography.fontFamily.sans}</li>
              <li><strong>Mono:</strong> {typography.fontFamily.mono}</li>
              <li><strong>Boyutlar:</strong> {Object.entries(typography.fontSize).map(([k, v]) => `${k}:${v}`).join(', ')}</li>
              <li><strong>Line height:</strong> {Object.entries(typography.lineHeight).map(([k, v]) => `${k}:${String(v)}`).join(', ')}</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Breakpoints</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
              {Object.entries(breakpoints).map(([token, value]) => (
                <span key={token} className="rounded-full border border-slate-200 px-3 py-1 dark:border-slate-700">
                  {token}: {value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>
    </section>

    <section className="grid gap-6 lg:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">CLI Komutları</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Design sistemini keşfetmek için yararlı scriptler.</p>
        <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
          <li><code className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">npm run library:demo</code> – Demo uygulamasını çalıştır.</li>
          <li><code className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">npm run library:build</code> – Paket dağıtımı için build al.</li>
          <li><code className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">npm run library:test</code> – Component testlerini çalıştır.</li>
        </ul>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Notlar</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Tasarım sistemi paketinin tamamı <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">modules/library</code> altında bulunur.
          Storybook veya playground kurulumları için komutları kullanabilir, renk/spacing değerlerini doğrudan uygulamalara taşıyabilirsin.
        </p>
      </article>
    </section>
  </section>
);

const ColorSwatch: React.FC<{ name: string; value: string }> = ({ name, value }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <span className="h-10 w-10 rounded-lg border border-slate-300 dark:border-slate-600" style={{ background: value }} />
    <div className="text-sm">
      <div className="font-semibold text-slate-700 dark:text-slate-100">{name}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{value}</div>
    </div>
  </div>
);

export default LibraryPage;
