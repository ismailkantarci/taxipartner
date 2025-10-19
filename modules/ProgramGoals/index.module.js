import { AppState } from '../core.state/app.state.module.js';

const ProgramGoalsModule = {
  init(target) {
    const translate = (key, fallback) => AppState.getTranslation?.(key) || fallback;
    target.innerHTML = `
      <section class="space-y-4">
        <header class="space-y-1">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            ${translate('program.goals.title', 'Program Goals')}
          </h1>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            ${translate(
              'program.goals.description',
              'Align audits, KPIs and remediation tasks for each control objective.'
            )}
          </p>
        </header>
        <div class="rounded-xl border border-dashed border-gray-300 bg-white/70 p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
          ${translate(
            'program.goals.placeholder',
            'Use the tab strip to jump between audits and goals. Plug OKR dashboards or backlog views here.'
          )}
        </div>
      </section>
    `;
  }
};

export default ProgramGoalsModule;
