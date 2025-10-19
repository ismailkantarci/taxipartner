import { AppState } from '../core.state/app.state.module.js';

const SecOpsModule = {
  init(target) {
    const translate = (key, fallback) => AppState.getTranslation?.(key) || fallback;
    target.innerHTML = `
      <section class="space-y-4">
        <header class="space-y-1">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            ${translate('operations.secops.title', 'Security Operations')}
          </h1>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            ${translate(
              'operations.secops.description',
              'Coordinate incidents, intel feeds and playbooks across the TAXIPartner fleet.'
            )}
          </p>
        </header>
        <div class="rounded-xl border border-dashed border-gray-300 bg-white/70 p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
          ${translate(
            'operations.secops.placeholder',
            'SOAR widgets, alert queues and on-call rotations plug in here during SecOps sprint.'
          )}
        </div>
      </section>
    `;
  }
};

export default SecOpsModule;
