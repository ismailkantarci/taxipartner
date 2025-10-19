import { mountVehiclesPage } from './page';

export function attachVehiclesRoute() {
  function render() {
    if (location.hash.startsWith('#/vehicles')) {
      const host = document.getElementById('app') || document.body;
      mountVehiclesPage(host);
    }
  }
  window.addEventListener('hashchange', render);
  render();
}
