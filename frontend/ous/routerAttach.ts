import { mountOUsPage } from "./page";

export function attachOUsRoute() {
  function render() {
    if (location.hash.startsWith("#/ous")) {
      const host = document.getElementById("app") || document.body;
      mountOUsPage(host);
    }
  }
  window.addEventListener("hashchange", render);
  render();
}
