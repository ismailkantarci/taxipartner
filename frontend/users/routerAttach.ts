import { mountUsersPage } from './usersPage';

export function attachUsersRoute() {
  function render() {
    const hash = location.hash || '#/';
    if (!hash.startsWith('#/users')) return;
    const host = document.getElementById('app') || document.body;
    mountUsersPage(host);
  }
  window.addEventListener('hashchange', render);
  render();
}
