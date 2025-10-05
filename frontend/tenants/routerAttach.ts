import { mountTenantsPage } from "./page";

export function attachTenantsRoute() {
  function render() {
    if (location.hash.startsWith("#/tenants")) {
      const host = document.getElementById("app") || document.body;
      mountTenantsPage(host);
    }
  }
  window.addEventListener("hashchange", render);
  render();
}
