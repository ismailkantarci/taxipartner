import { mountAuditPage } from './page';

let attached = false;

export function attachAuditRoute() {
  if (attached) {
    return;
  }
  attached = true;

  function render() {
    const hash = location.hash || '#/';
    if (!hash.startsWith('#/audit')) {
      return;
    }
    const host = document.getElementById('app') || document.body;
    mountAuditPage(host);
  }

  window.addEventListener('hashchange', render);
  render();
}
