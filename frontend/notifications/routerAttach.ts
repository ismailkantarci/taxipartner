import { mountNotificationsPage } from './page';

export function attachNotificationsRoute() {
  let lastRendered = '';

  function render() {
    const hash = location.hash || '#/';
    if (!hash.startsWith('#/notifications')) {
      lastRendered = '';
      return;
    }
    if (lastRendered === hash) return;
    lastRendered = hash;
    const host = document.getElementById('app') || document.body;
    mountNotificationsPage(host);
  }

  window.addEventListener('hashchange', render);
  render();
}
