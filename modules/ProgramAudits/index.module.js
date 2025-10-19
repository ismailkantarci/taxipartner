import { AppState } from '../core.state/app.state.module.js';

const ProgramAuditsModule = {
  init(target) {
    const translate = (key, fallback) => AppState.getTranslation?.(key) || fallback;
    target.innerHTML = `
      <section class="space-y-4">
        <header class="space-y-1">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            ${translate('program.audits.title', 'Program Audits')}
          </h1>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            ${translate(
              'program.audits.description',
              'Plan evidence windows, assign lead auditors and monitor remediation clocks.'
            )}
          </p>
        </header>
        <div class="rounded-xl border border-dashed border-gray-300 bg-white/70 p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
          ${translate(
            'program.audits.placeholder',
            'Audit runbooks will render here. Tab navigation stays in sync with router state.'
          )}
        </div>
      </section>
    `;
  }
};

export default ProgramAuditsModule;
