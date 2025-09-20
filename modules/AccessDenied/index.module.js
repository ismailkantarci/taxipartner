import { AppState } from '../core.state/app.state.module.js';

export default {
  init(target){
    target.innerHTML = `
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-2">403</h1>
        <p class="text-gray-600 mb-4">${AppState.getTranslation?.('access.denied') || 'Access denied. This route requires admin role.'}</p>
        <a href="#/" class="text-blue-600 hover:underline">${AppState.getTranslation?.('access.back') || 'Back to Dashboard'}</a>
      </div>`;
  },
  dispose(){}
};
