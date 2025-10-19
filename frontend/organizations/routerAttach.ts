import { mountOrganizationsPage } from './page';

export function attachOrganizationsRoute() {
  function render() {
    if (location.hash.startsWith('#/organizations')) {
      const host = document.getElementById('app') || document.body;
      mountOrganizationsPage(host);
    }
  }
  window.addEventListener('hashchange', render);
  render();
}
