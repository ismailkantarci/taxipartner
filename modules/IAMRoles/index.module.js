import { AppState } from '../core.state/app.state.module.js';

const IAMRolesModule = {
  init(target) {
    const translate = (key, fallback) => AppState.getTranslation?.(key) || fallback;
    target.innerHTML = `
      <section class="space-y-4">
        <header class="space-y-1">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            ${translate('iam.roles.title', 'Role Directory')}
          </h1>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            ${translate(
              'iam.roles.description',
              'Create, audit and align RBAC profiles across the tenant hierarchy.'
            )}
          </p>
        </header>
        <div class="rounded-xl border border-dashed border-gray-300 bg-white/70 p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
          ${translate(
            'iam.roles.placeholder',
            'Role management views land here. Hook TanStack tables or workflow boards as the data model hardens.'
          )}
        </div>
      </section>
    `;
  }
};

export default IAMRolesModule;
