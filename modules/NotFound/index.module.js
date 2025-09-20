import { AppState } from '../core.state/app.state.module.js';

export default {
  init(target){
    target.innerHTML = `
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-2">404</h1>
        <p class="text-gray-600 mb-4">${AppState.getTranslation('notfound.message')}</p>
        <a href="#/" class="text-blue-600 hover:underline">${AppState.getTranslation('notfound.back')}</a>
      </div>`;
  },
  dispose(){}
};
