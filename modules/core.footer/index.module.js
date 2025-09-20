// modules/core.footer/index.module.js
import { AppState } from '../core.state/app.state.module.js';

const FooterModule = {
  async init(target) {
    const year = new Date().getFullYear();
    let version = '';
    let buildDate = '';
    let repoUrl = '';
    try {
      const meta = await fetch(new URL('../../system.meta.json', import.meta.url)).then(r=>r.json());
      version = meta?.version || '';
      buildDate = meta?.buildDate || '';
    } catch {}
    try {
      // Reuse already loaded config when available to avoid duplicate fetches
      const cfg = (window.AppConfigRef && typeof window.AppConfigRef === 'object')
        ? window.AppConfigRef
        : await fetch(new URL('../../app.config.json', import.meta.url)).then(r=>r.json());
      repoUrl = cfg?.repoUrl || '';
    } catch {}

    // Minimal footer text (no version visible). Version is accessible via About modal.
    target.innerHTML = `
      <div class="text-[10px] text-gray-400 dark:text-gray-500 py-2 px-4 border-t border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 w-full text-center space-y-0.5">
        <div class="leading-tight">© 2020 - ${year} TAXIPartner</div>
        <div class="text-[9px] italic opacity-80 leading-tight">Admin Suite · Built with ❤️ in Vienna · <button id="footerAboutLink" class="underline">${AppState.getTranslation?.('footer.about') || 'About'}</button></div>
      </div>
    `;

    // About modal (centered)
    const ensureAbout = () => {
      let el = document.getElementById('aboutModal');
      if (el) return el;
      el = document.createElement('div');
      el.id = 'aboutModal';
      el.className = 'hidden fixed inset-0 z-[2100] flex items-center justify-center p-4';
      const dateTxt = buildDate ? String(buildDate).slice(0,10) : '';
      const repo = repoUrl ? `<a class="underline" href="${repoUrl}" target="_blank">GitHub</a>` : '';
      const repoHelp = !repoUrl
        ? `<div class="text-[11px] text-gray-500 dark:text-gray-400">Repo URL not set. Set it via: <code>python3 scripts/set_repo_url.py &lt;https://github.com/org/repo&gt;</code></div>`
        : '';
      el.innerHTML = `
        <div class="absolute inset-0 bg-black/40" data-close="backdrop" aria-hidden="true"></div>
        <div class="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[95%] max-w-[520px] max-h-[80vh] overflow-y-auto p-6">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-semibold text-gray-800 dark:text-gray-100">${AppState.getTranslation?.('footer.about') || 'About'}</h2>
            <button id="aboutClose" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.close') || 'Close'}</button>
          </div>
          <div class="text-sm text-gray-700 dark:text-gray-200 space-y-2">
            <div><strong>TAXIPartner Admin Suite</strong></div>
            ${version ? `<div>${AppState.getTranslation?.('footer.version') || 'Version'}: v${version}</div>` : ''}
            ${dateTxt ? `<div>${AppState.getTranslation?.('footer.buildDate') || 'Build'}: ${dateTxt}</div>` : ''}
            ${repo ? `<div>${repo}</div>` : ''}
            ${repoHelp}
          </div>
        </div>`;
      document.body.appendChild(el);
      return el;
    };

    const aboutBtn = document.getElementById('footerAboutLink');
    const aboutModal = ensureAbout();
    const openAbout = () => {
      aboutModal.classList.remove('hidden');
      aboutModal.setAttribute('role','dialog');
      aboutModal.setAttribute('aria-modal','true');
      try { document.body.classList.add('overflow-hidden'); } catch {}
      const c = aboutModal.querySelector('#aboutClose');
      c && c.focus && c.focus();
    };
    const closeAbout = () => {
      aboutModal.classList.add('hidden');
      aboutModal.removeAttribute('aria-modal');
      try { document.body.classList.remove('overflow-hidden'); } catch {}
    };
    aboutBtn?.addEventListener('click', (e)=>{ e.preventDefault(); openAbout(); });
    aboutModal?.addEventListener('click', (e)=>{ if (e.target?.dataset?.close==='backdrop') closeAbout(); });
    aboutModal.querySelector('#aboutClose')?.addEventListener('click', closeAbout);
    document.addEventListener('keydown', (e)=>{ const m = document.getElementById('aboutModal'); if (e.key==='Escape' && m && !m.classList.contains('hidden')) closeAbout(); });
  }
};

export default FooterModule;
