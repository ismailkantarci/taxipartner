import { AppState } from '../core.state/app.state.module.js';
import { sanitizeHTML } from './sanitize.js';

export const ModuleLoader = {
  _current: { container: null, mod: null },
  async load(name, options = { append: true }) {
    const target = document.getElementById("modulContent");
    if (!target) {
      console.error("modulContent element not found in DOM");
      return;
    }
    try {
      const manifestUrl = new URL(`../${name}/module.manifest.json`, import.meta.url);
      const manifestRes = await fetch(manifestUrl.href);
      const manifest = await manifestRes.json();

      // Create a container to avoid wiping other content
      const container = document.createElement('section');
      container.className = 'mb-8';
      if (!options.append) {
        try { this._current.mod?.dispose?.(); } catch {}
        target.innerHTML = '';
        this._current = { container: null, mod: null };
      }
      target.appendChild(container);

      // Optional HTML injection if defined in manifest
      if (manifest.html) {
        try {
          const htmlUrl = new URL(`../${name}/${manifest.html}`, import.meta.url);
          const htmlRes = await fetch(htmlUrl.href);
          const html = sanitizeHTML(await htmlRes.text());
          const wrapper = document.createElement('div');
          wrapper.innerHTML = html;
          container.appendChild(wrapper);
        } catch (e) {
          if (AppState.debug) console.warn('Optional HTML could not be loaded for', name, e);
        }
      }

      // Optional style injection
      if (manifest.style) {
        const href = new URL(`../${name}/${manifest.style}`, import.meta.url).href;
        if (!document.querySelector(`link[data-module-style="${name}"]`)) {
          const linkEl = document.createElement('link');
          linkEl.rel = 'stylesheet';
          linkEl.href = href;
          linkEl.setAttribute('data-module-style', name);
          document.head.appendChild(linkEl);
        }
      }

      // Import module entry and initialize (path relative to this file)
      const moduleUrl = new URL(`../${name}/${manifest.entry}`, import.meta.url);
      // Vite cannot statically analyze this runtime-computed path; suppress warning explicitly.
      const { default: Mod } = await import(/* @vite-ignore */ moduleUrl.href);
      Mod?.init?.(container);
      this._current = { container, mod: Mod };
    } catch (err) {
      const targetEl = document.getElementById('modulContent');
      if (targetEl) targetEl.innerHTML += `<p class="text-red-500">Modül yüklenemedi: ${name}</p>`;
      console.error(err);
    }
  },

  async loadFromManifest() {
    const target = document.getElementById("modulContent");
    if (!target) return;

    try {
      const [configResponse] = await Promise.all([
        fetch(new URL('../modules.config.json', import.meta.url).href)
      ]);
      const config = await configResponse.json();
      const activeModules = config.activeModules || [];

      // Default: load only first module, router may replace later
      target.innerHTML = '';
      if (activeModules.length) {
        AppState.setActiveModule(activeModules[0]);
        await this.load(activeModules[0], { append: false });
      }
    } catch (err) {
      target.innerHTML = `<p class="text-red-500">Modüller yüklenemedi.</p>`;
      console.error(err);
    }
  },

  async init() {
    await this.loadFromManifest();
  }
};
