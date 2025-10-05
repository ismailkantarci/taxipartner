import { mountPermissionsPage } from './page';

let attached = false;

export function attachPermissionsRoute() {
  if (attached) {
    return;
  }
  attached = true;

  function render() {
    const hash = location.hash || '#/';
    if (!hash.startsWith('#/permissions')) {
      return;
    }
    const host = document.getElementById('app') || document.body;
    mountPermissionsPage(host);
  }

  window.addEventListener('hashchange', render);
  render();
}
