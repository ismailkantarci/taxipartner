import { mountMandatesPage } from './page';

export function attachMandatesRoute() {
  function render() {
    if (location.hash.startsWith('#/mandates')) {
      const host = document.getElementById('app') || document.body;
      mountMandatesPage(host);
    }
  }
  window.addEventListener('hashchange', render);
  render();
}
