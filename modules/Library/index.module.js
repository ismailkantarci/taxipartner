import { AppState } from '../core.state/app.state.module.js';
import { createPhoneInput, PHONE_INPUT_STYLES } from '../library/components/phone-input/phone-input.js';
import { colors, spacing } from '../library/tokens/index.js';

const STYLE_ID = 'library-module-phone-styles';

function ensurePhoneStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PHONE_INPUT_STYLES;
  document.head.append(style);
}

function prettifyKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase());
}

function createColorSwatch(name, value) {
  const item = document.createElement('div');
  item.className = 'flex items-center gap-3 rounded-md border border-slate-200 dark:border-slate-700 p-3';
  item.innerHTML = `
    <span class="w-10 h-10 rounded-md border border-slate-300 dark:border-slate-600" style="background:${value};"></span>
    <div class="text-sm">
      <div class="font-medium text-slate-700 dark:text-slate-100">${prettifyKey(name)}</div>
      <div class="text-xs text-slate-500 dark:text-slate-400">${value}</div>
    </div>
  `;
  return item;
}

function createSpacingChip(step, value) {
  const chip = document.createElement('div');
  chip.className = 'flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300';
  chip.innerHTML = `<span class="font-medium">${step}</span><span class="font-mono">${value}</span>`;
  return chip;
}

const LibraryModule = {
  _phoneControl: null,

  init(container) {
    const t = (key, fallback) => AppState.getTranslation(key) || fallback;

    container.innerHTML = `
      <section class="space-y-6">
        <header class="space-y-2">
          <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-50">${t('library.title', 'Design Library')}</h1>
          <p class="text-sm text-slate-600 dark:text-slate-300">${t('library.subtitle', 'Shared components and tokens preview')}</p>
        </header>

        <div class="grid gap-6 lg:grid-cols-2">
          <article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">${t('library.tokens.title', 'Design Tokens')}</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300 mb-5">${t('library.tokens.description', 'Key values exported from @taxipartner/library/tokens.')}</p>
            <div class="space-y-4">
              <div>
                <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Brand</h3>
                <div class="grid gap-2 sm:grid-cols-2" data-role="brand-list"></div>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">${t('library.actions.title', 'Commands')}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">${t('library.actions.description', 'Use these commands to explore the shared design system locally.')}</p>
                <ul class="space-y-2 text-xs text-slate-600 dark:text-slate-300" data-role="command-list">
                  <li><code class="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">${t('library.actions.storybook', 'Storybook: cd apps/design-system && npm run storybook')}</code></li>
                  <li><code class="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">${t('library.actions.demo', 'Demo: npm run library:demo')}</code></li>
                  <li><code class="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">${t('library.actions.build', 'Build: npm run library:build')}</code></li>
                  <li><code class="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">${t('library.actions.test', 'Test: npm run library:test')}</code></li>
                </ul>
              </div>
            </div>
          </article>

          <article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">${t('library.phone.title', 'Phone Input Demo')}</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300 mb-4">${t('library.phone.description', 'Interactive phone field powered by the shared library.')}</p>
            <div class="space-y-4">
              <div>
                <label for="library-phone-input" class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Phone</label>
                <input id="library-phone-input" type="tel" class="w-full" autocomplete="tel" />
              </div>
              <div class="rounded-lg bg-slate-50 p-4 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <div class="flex justify-between"><span>E.164:</span> <span data-role="phone-e164">—</span></div>
                <div class="flex justify-between"><span>Country:</span> <span data-role="phone-country">—</span></div>
                <div class="flex justify-between"><span>Valid:</span> <span data-role="phone-valid">—</span></div>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Spacing</h3>
                <div class="grid gap-2 sm:grid-cols-2" data-role="spacing-list"></div>
              </div>
            </div>
          </article>
        </div>
      </section>
    `;

    const brandList = container.querySelector('[data-role="brand-list"]');
    if (brandList) {
      Object.entries(colors.brand || {}).forEach(([key, value]) => {
        brandList.appendChild(createColorSwatch(key, value));
      });
    }

    const spacingList = container.querySelector('[data-role="spacing-list"]');
    if (spacingList) {
      Object.entries(spacing || {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .forEach(([step, value]) => {
          spacingList.appendChild(createSpacingChip(step, value));
        });
    }

    ensurePhoneStyles();
    const input = container.querySelector('#library-phone-input');
    const e164El = container.querySelector('[data-role="phone-e164"]');
    const countryEl = container.querySelector('[data-role="phone-country"]');
    const validEl = container.querySelector('[data-role="phone-valid"]');

    if (input) {
      this._phoneControl = createPhoneInput(input, {
        preferredCountries: ['at', 'de', 'tr', 'ua'],
        initialCountry: 'at',
        onChange: ({ phone, country, isValid }) => {
          if (e164El) e164El.textContent = phone || '—';
          if (countryEl) countryEl.textContent = country || '—';
          if (validEl) validEl.textContent = isValid ? t('library.phone.validYes', 'Yes') : t('library.phone.validNo', 'No');
        }
      });
    }
  },

  dispose() {
    try {
      this._phoneControl?.destroy?.();
    } catch {}
    this._phoneControl = null;
  }
};

export default LibraryModule;
