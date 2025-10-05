import { mountCompaniesPage } from "./page";

export function attachCompaniesRoute() {
  function render() {
    if (location.hash.startsWith("#/companies")) {
      const host = document.getElementById("app") || document.body;
      mountCompaniesPage(host);
    }
  }
  window.addEventListener("hashchange", render);
  render();
}
