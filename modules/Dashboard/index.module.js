// modules/Dashboard/index.module.js
import { AppState } from '../core.state/app.state.module.js';

const DashboardModule = {
  init(target) {
    target.innerHTML = `
      <h1 class="text-xl font-bold text-gray-700 mb-6">${AppState.getTranslation('dashboard.title')}</h1>
      <p class="text-gray-600">${AppState.getTranslation('dashboard.welcome')} <strong>${AppState.currentUser?.fullName || 'Guest'}</strong>!</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div class="bg-white dark:bg-gray-800 shadow p-4 rounded border dark:border-gray-700 text-center">
          <div class="text-gray-500 text-sm">${AppState.getTranslation('dashboard.activeModule')}</div>
          <div class="text-xl font-bold text-blue-600 mt-1">${AppState.activeModule || '...'}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 shadow p-4 rounded border dark:border-gray-700 text-center">
          <div class="text-gray-500 text-sm">${AppState.getTranslation('dashboard.language')}</div>
          <div class="text-xl font-bold text-blue-600 mt-1">${AppState.language}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 shadow p-4 rounded border dark:border-gray-700 text-center">
          <div class="text-gray-500 text-sm">${AppState.getTranslation('dashboard.tenant')}</div>
          <div class="text-xl font-bold text-blue-600 mt-1">${AppState.tenant || '...'}</div>
        </div>
      </div>
    `;
  }
};

export default DashboardModule;
