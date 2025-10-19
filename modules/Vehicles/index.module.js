import { AppState } from '../core.state/app.state.module.js';

export default {
  init(target) {
    const title = AppState.getTranslation('vehicles') || 'Vehicles';
    target.innerHTML = `
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-4">${title}</h1>
        <div id="vehicles-list" class="mt-4"></div>
      </div>`;
    import('../../frontend/vehicles/page.ts')
      .then((mod) => {
        try {
          const result = mod.mountVehiclesPage?.(target);
          if (result && typeof result.then === 'function') {
            result.catch(() => {});
          }
        } catch {}
      })
      .catch(() => {});
  }
};
