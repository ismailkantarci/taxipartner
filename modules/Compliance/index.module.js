import { AppState } from '../core.state/app.state.module.js';

const ComplianceModule = {
  init(target) {
    const translate = (key, fallback) => AppState.getTranslation?.(key) || fallback;
    target.innerHTML = `
      <section class="space-y-4">
        <header class="space-y-1">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            ${translate('operations.compliance.title', 'Compliance Overview')}
          </h1>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            ${translate(
              'operations.compliance.description',
              'Map regulatory controls, evidence owners and exception waivers in one workspace.'
            )}
          </p>
        </header>
        <div class="rounded-xl border border-dashed border-gray-300 bg-white/70 p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
          ${translate(
            'operations.compliance.placeholder',
            'Compliance dashboards, heatmaps and workflows will anchor here once data contracts arrive.'
          )}
        </div>
      </section>
    `;
  }
};

export default ComplianceModule;
