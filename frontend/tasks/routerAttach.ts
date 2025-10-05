import { mountTasksPage } from './page';

export function attachTasksRoute() {
  let lastRendered = '';

  function render() {
    const hash = location.hash || '#/';
    if (!hash.startsWith('#/tasks')) {
      lastRendered = '';
      return;
    }
    if (lastRendered === hash) return;
    lastRendered = hash;
    const host = document.getElementById('app') || document.body;
    void mountTasksPage(host);
  }

  window.addEventListener('hashchange', render);
  render();
}
