import { AppState } from '../core.state/app.state.module.js';
import { Toast } from '../core.toast/index.module.js';
import { compareVersion, computeReleaseModules, diffHighlight, validateRelease } from './utils.js';

const ReleaseManagerModule = {
  async init(target) {
    let releases = [];
    try {
      const res = await fetch(new URL('./release-log.json', import.meta.url).href);
      if (!res.ok) throw new Error('release-log.json yüklenemedi');
      releases = await res.json();
    } catch (e) {
      target.innerHTML = `<div class="text-red-600 font-bold p-4">Hata: ${e.message}</div>`;
      return;
    }

    const getLang = () => {
      const lang = (AppState.language || 'en').toLowerCase();
      const base = lang.split('-')[0];
      return { lang, base };
    };
    const resolveDesc = (r) => {
      const d = r && r.description;
      if (!d) return '';
      if (typeof d === 'string') return d;
      const { lang, base } = getLang();
      return (
        d[lang] || d[base] || d.en || d.de || d.tr || Object.values(d)[0] || ''
      );
    };
    const uniqueValues = (arr, key) => [...new Set(arr.map(item => item[key]).filter(Boolean))].sort();
    // Post-load quick validation summary
    try {
      const invalid = (Array.isArray(releases)?releases:[]).reduce((n,r)=> n + (validateRelease(r).length>0 ? 1 : 0), 0);
      if (invalid>0) { try { Toast?.show?.(`${invalid} ${AppState.getTranslation?.('release.invalid_count') || 'invalid entries'}`, 'error'); } catch {} }
    } catch {}
    const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    const csvSafe = (s) => { const v = String(s ?? ''); return v && /^[=+\-@]/.test(v) ? "'" + v : v; };
    const csvQuote = (s) => '"' + String(s ?? '').replace(/"/g,'""') + '"';

    // Module manifest cache for version lookup
    const manifestCache = new Map();
    const loadManifestCache = () => { try { return JSON.parse(sessionStorage.getItem('RM_ManifestCache')||'{}'); } catch { return {}; } };
    const saveManifestCache = (obj) => { try { sessionStorage.setItem('RM_ManifestCache', JSON.stringify(obj)); } catch {} };
    const manifestPersist = loadManifestCache();
    async function getModuleVersion(name){
      if (!name) return '';
      if (manifestCache.has(name)) return manifestCache.get(name);
      if (manifestPersist[name]) { manifestCache.set(name, manifestPersist[name]); return manifestPersist[name]; }
      try{
        const url = new URL(`../${name}/module.manifest.json`, import.meta.url);
        const j = await fetch(url).then(r=>r.json());
        const v = j?.version || '';
        manifestCache.set(name, v);
        manifestPersist[name] = v; saveManifestCache(manifestPersist);
        return v;
      }catch{
        manifestCache.set(name, '');
        manifestPersist[name] = ''; saveManifestCache(manifestPersist);
        return '';
      }
    }

    // computeReleaseModules moved to utils.js

    function formatTime(r){
      if (r?.time) return r.time;
      if (r?.datetime) {
        const s = String(r.datetime);
        const m = s.match(/T(\d{2}:\d{2})/);
        if (m) return m[1];
      }
      return '';
    }
    // Highlight helper for safe text
    function highlightText(text, query){
      const s = String(text ?? '');
      const q = String(query || '').trim();
      if (!q || q.length < 2) return escapeHtml(s);
      const escRe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escRe, 'ig');
      let out = '';
      let last = 0; let m;
      while ((m = re.exec(s))){
        out += escapeHtml(s.slice(last, m.index));
        out += `<mark class="rm-hl">${escapeHtml(m[0])}</mark>`;
        last = re.lastIndex;
        if (m.index === re.lastIndex) re.lastIndex++; // safety for zero-width
      }
      out += escapeHtml(s.slice(last));
      return out;
    }
    // Sorting state and helpers
    const sortState = { key: 'date', dir: 'desc' }; // default newest first
    const applySort = (list) => {
      const arr = [...list];
      const { key, dir } = sortState;
      const mul = dir === 'asc' ? 1 : -1;
      arr.sort((x, y) => {
        let c = 0;
        if (key === 'version') c = compareVersion(x.version, y.version);
        else if (key === 'date') c = String(x.date || '').localeCompare(String(y.date || ''));
        else if (key === 'status') c = String(x.status || '').localeCompare(String(y.status || ''));
        else if (key === 'author') c = String(x.author || '').localeCompare(String(y.author || ''));
        return c * mul;
      });
      return arr;
    };

    // validateRelease moved to utils.js

    // 🧮 Bilgi Kutuları ve Çok Dilli Başlıklar
    const canary = AppState.isFlagEnabled?.('release.canaryUi');
    // Localized label for actions; fallback to English if key not resolved
    const _actLbl = AppState.getTranslation?.('release.actions');
    const actionsText = (_actLbl && _actLbl !== 'release.actions') ? _actLbl : 'Actions';
    // Table preferences (columns + page size)
    const defaultPrefs = { visible: { date: true, status: true, author: true, modules: true, description: true }, pageSize: 10, order: ['date','status','author','modules','description'] };
    const loadPrefs = () => {
      try {
        const p = JSON.parse(localStorage.getItem('RM_TablePrefs') || 'null') || defaultPrefs;
        if (!p.order) p.order = ['date','status','author','modules','description'];
        if (!p.visible) p.visible = { date: true, status: true, author: true, modules: true, description: true };
        if (p.visible.modules === undefined) p.visible.modules = true;
        return p;
      } catch { return defaultPrefs; }
    };
    const savePrefs = (prefs) => { try { localStorage.setItem('RM_TablePrefs', JSON.stringify(prefs)); } catch {} };
    let { visible, pageSize, order: colOrder } = loadPrefs();
    let page = 1;
    target.innerHTML = `
      <div class="rm-root">
        <div class="rm-toolbar items-center mb-5">
          <h1 class="rm-title text-2xl font-semibold text-gray-800 dark:text-gray-200">${AppState.activeModule || AppState.getTranslation?.('release.management') || 'Release Management'}
            <span id="rmUnsavedDot" class="hidden align-middle ml-2 inline-block w-2 h-2 rounded-full bg-amber-400 dark:bg-amber-300" title="${AppState.getTranslation?.('release.unsaved_changes') || 'You have unsaved changes.'}"></span>
            ${canary ? '<span class="ml-2 align-middle text-xs px-2 py-1 rounded bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100">Canary</span>' : ''}
          </h1>
          <div class="relative flex items-center gap-2 justify-end">
            <button id="toggleFiltersBtn" type="button" class="sm:hidden inline-flex items-center rounded-md border px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700">
              ${AppState.getTranslation?.('release.filter_by') || 'Filters'}
            </button>
            <span role="group" class="inline-flex shadow-sm align-middle">
              <button id="actionMenuBtnMain" type="button" class="inline-flex items-center rounded-l-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700">${actionsText}</button>
              <button id="actionMenuBtn" type="button" aria-haspopup="menu" aria-expanded="false" class="inline-flex items-center rounded-r-md bg-white p-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 -ml-px hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700">
                <svg id="actionCaret" class="h-4 w-4 text-gray-400 transition-transform duration-100" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
              </button>
            </span>
            <div id="actionPopover" role="menu" aria-label="${AppState.getTranslation?.('release.actions') || 'Actions'}" class="hidden absolute right-0 top-full mt-2 z-[2000] block w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl ring-1 ring-black/10 p-1 opacity-0 transition-opacity ease-out duration-100 divide-y divide-gray-100 dark:divide-gray-800 box-border">
              <div id="actionBar" class="py-1 text-[13px] leading-5">
                <button id="newReleaseBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-plus inline-block"></span>
                  <span>${AppState.getTranslation?.('release.new') || 'New Release'}</span>
                </button>
                <button id="importJsonBtn" type="button" role="menuitem" tabindex="-1" title="${AppState.getTranslation?.('release.import_json') || 'Import JSON'}" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-download inline-block"></span>
                  <span>${AppState.getTranslation?.('release.import_json') || 'Import JSON'}</span>
                </button>
                <input id="importFile" type="file" accept="application/json" class="hidden" />
              </div>
              <div class="py-1">
              <div class="px-3 py-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">${AppState.getTranslation?.('release.menu_export') || 'Export'}</div>
                <button id="exportBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-csv inline-block"></span>
                  <span>${AppState.getTranslation?.('release.export_csv') || 'CSV exportieren'}</span>
                </button>
                <button id="copyCsvBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-csv inline-block"></span>
                  <span>${(AppState.getTranslation?.('release.copy') || 'Copy')} CSV</span>
                </button>
                <button id="exportJsonBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-json inline-block"></span>
                  <span>${AppState.getTranslation?.('release.export_json') || 'JSON exportieren'}</span>
                </button>
                <button id="exportMetaBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-json inline-block"></span>
                  <span>Export Meta (JSON)</span>
                </button>
                <button id="exportMdPublicBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-md inline-block"></span>
                  <span>${AppState.getTranslation?.('release.export_md_public') || 'Export MD (Public)'}</span>
                </button>
                <button id="exportMdBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-md inline-block"></span>
                  <span>${AppState.getTranslation?.('release.export_md') || 'Markdown exportieren'}</span>
                </button>
                <button id="copyMdBtnClip" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-md inline-block"></span>
                  <span>${(AppState.getTranslation?.('release.copy') || 'Copy')} MD</span>
                </button>
              </div>
              <div class="py-1">
                <div class="px-3 py-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">${AppState.getTranslation?.('release.menu_views') || 'Views'}</div>
                <button id="exportViewsBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-json inline-block"></span>
                  <span>${AppState.getTranslation?.('release.views_export') || 'Export Views'}</span>
                </button>
                <button id="importViewsBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-download inline-block"></span>
                  <span>${AppState.getTranslation?.('release.views_import') || 'Import Views'}</span>
                </button>
                <button id="copyViewLinkBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-link inline-block"></span>
                  <span>${AppState.getTranslation?.('release.copy_view_link') || 'Copy View Link'}</span>
                </button>
                <button id="applyViewLinkBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-link inline-block"></span>
                  <span>${AppState.getTranslation?.('release.views_apply_link') || 'Apply Link'}</span>
                </button>
                <input id="importViewsFile" type="file" accept="application/json" class="hidden" />
              </div>
              <div class="py-1">
                <div class="px-3 py-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">${AppState.getTranslation?.('release.menu_display') || 'Display'}</div>
                <button id="densityStdBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-reset inline-block"></span>
                  <span>${AppState.getTranslation?.('release.density_standard') || 'Density: Standard'}</span>
                </button>
                <button id="densityCmpBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-reset inline-block"></span>
                  <span>${AppState.getTranslation?.('release.density_compact') || 'Density: Compact'}</span>
                </button>
                <button id="densityComfBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-reset inline-block"></span>
                  <span>${AppState.getTranslation?.('release.density_comfortable') || 'Density: Comfortable'}</span>
                </button>
              </div>
              <div class="py-1">
                <button id="resetBtn" type="button" role="menuitem" tabindex="-1" class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span class="rm-ico rm-ico-reset inline-block"></span>
                  <span>${AppState.getTranslation?.('release.reset_filters') || 'Filter zurücksetzen'}</span>
                </button>
                <button id="persistJsonBtn" type="button" role="menuitem" tabindex="-1" class="hidden group w-full items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800" title="${AppState.getTranslation?.('release.save_json') || 'Save updated JSON'}">
                  <span class="rm-ico rm-ico-save inline-block"></span>
                  <span>${AppState.getTranslation?.('release.save_json') || 'Save JSON'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div id="unsavedBanner" class="hidden mb-4 rounded-md border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700 p-3 flex items-center justify-between" role="status" aria-live="polite">
          <div class="text-sm">${AppState.getTranslation?.('release.unsaved_changes') || 'You have unsaved changes.'}</div>
          <div class="flex items-center gap-2">
            <button id="unsavedSaveBtn" type="button" class="px-3 py-1 rounded border border-amber-400 bg-white/80 hover:bg-white dark:bg-transparent">${AppState.getTranslation?.('release.save_json') || 'Save JSON'}</button>
            <button id="unsavedDismissBtn" type="button" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.cancel') || 'Cancel'}</button>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div class="bg-white dark:bg-gray-800 shadow rounded p-4 text-center border dark:border-gray-700">
            <div class="text-sm text-gray-500 flex items-center justify-center gap-2">
              <span class="rm-card-icon rm-ico-total text-blue-600" aria-hidden="true"></span>
              <span class="inline-block">${AppState.getTranslation?.('release.total') || 'Total Releases'}</span>
            </div>
            <div class="text-xl font-bold text-blue-600 font-mono tabular-nums" id="releaseCount">0</div>
            <div class="text-xs text-gray-500" id="releaseTrend">—</div>
          </div>
          <div class="bg-white dark:bg-gray-800 shadow rounded p-4 text-center border dark:border-gray-700">
            <div class="text-sm text-gray-500 flex items-center justify-center gap-2">
              <span class="rm-card-icon rm-ico-stable text-green-600" aria-hidden="true"></span>
              <span class="inline-block">${AppState.getTranslation?.('release.stable') || 'Stable Releases'}</span>
            </div>
            <div class="text-xl font-bold text-green-600 font-mono tabular-nums" id="stableCount">0</div>
            <div class="text-xs text-gray-500" id="stableTrend">—</div>
          </div>
          <div class="bg-white dark:bg-gray-800 shadow rounded p-4 text-center border dark:border-gray-700">
            <div class="text-sm text-gray-500 flex items-center justify-center gap-2">
              <span class="rm-card-icon rm-ico-latest text-gray-600 dark:text-gray-300" aria-hidden="true"></span>
              <span>${AppState.getTranslation?.('release.latest') || 'Latest Version'}</span>
            </div>
            <div class="text-xl font-bold text-gray-800 dark:text-gray-200 font-mono tabular-nums" id="latestVersion">-</div>
          </div>
        </div>
        <form id="filterForm" class="rm-filters grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
          <div>
            <label for="statusFilter" class="block text-gray-700 dark:text-gray-200 mb-1 font-medium">${AppState.getTranslation?.('release.status') || 'Status'}</label>
            <select id="statusFilter" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">${AppState.getTranslation?.('release.all_statuses') || 'All Statuses'}</option>
            </select>
          </div>
          <div>
            <label for="authorFilter" class="block text-gray-700 dark:text-gray-200 mb-1 font-medium">${AppState.getTranslation?.('release.author') || 'Author'}</label>
            <select id="authorFilter" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">${AppState.getTranslation?.('release.all_authors') || 'All Authors'}</option>
            </select>
          </div>
          <div>
            <label for="moduleSelect" class="block text-gray-700 dark:text-gray-200 mb-1 font-medium">${AppState.getTranslation?.('release.modules') || 'Modules'}</label>
            <select id="moduleSelect" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">${AppState.getTranslation?.('release.all_modules') || 'All Modules'}</option>
            </select>
          </div>
          <div>
            <label for="searchFilter" class="block text-gray-700 dark:text-gray-200 mb-1 font-medium">${AppState.getTranslation?.('release.search') || 'Search'}</label>
            <input type="search" id="searchFilter" placeholder="${AppState.getTranslation?.('release.search_placeholder') || 'Search description...'}" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 placeholder-gray-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <details id="advFilters" class="md:col-span-4">
            <summary class="cursor-pointer select-none px-3 py-2 rounded border dark:border-gray-700">Advanced Filters</summary>
            <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label for="versionFilter" class="block text-gray-700 dark:text-gray-200 mb-1 font-medium">${AppState.getTranslation?.('release.version') || 'Version'}</label>
                <select id="versionFilter" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">${AppState.getTranslation?.('release.all_versions') || 'All Versions'}</option>
                </select>
              </div>
              <div>
                <label for="fromDate" class="block text-gray-700 dark:text-gray-200 mb-1 font-medium">${AppState.getTranslation?.('release.from_date') || 'From'}</label>
                <input type="date" id="fromDate" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label for="toDate" class="block text-gray-700 dark:text-gray-200 mb-1 font-medium">${AppState.getTranslation?.('release.to_date') || 'To'}</label>
                <input type="date" id="toDate" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
          </details>
        </form>
        <!-- Quick filter presets -->
        <div id="quickFilters" class="flex flex-wrap items-center gap-2 mb-6 text-sm">
          <span class="text-gray-500">${AppState.getTranslation?.('release.quick_filters') || 'Quick filters'}:</span>
          <button id="qfStable" type="button" class="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.status') || 'Status'}: Stable</button>
          <button id="qfLast30" type="button" class="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.last_30_days') || 'Last 30 days'}</button>
          <label class="ml-2 inline-flex items-center gap-2 px-2 py-1 rounded border border-gray-300 dark:border-gray-700">
            <input id="qfFilesOnly" type="checkbox" /> <span>${AppState.getTranslation?.('release.files_only') || 'Files only'}</span>
          </label>
        </div>
        
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
            <details>
              <summary class="cursor-pointer select-none px-2 py-1 rounded border dark:border-gray-700">${AppState.getTranslation?.('release.columns') || 'Columns'}</summary>
              <div class="mt-2 p-2 border rounded bg-white dark:bg-gray-800 dark:border-gray-700 shadow grid grid-cols-2 gap-1">
                <label class="flex items-center gap-2 text-xs"><input type="checkbox" id="colDate" ${visible.date ? 'checked' : ''} /> ${AppState.getTranslation?.('release.date') || 'Date'}</label>
                <label class="flex items-center gap-2 text-xs"><input type="checkbox" id="colStatus" ${visible.status ? 'checked' : ''} /> ${AppState.getTranslation?.('release.status') || 'Status'}</label>
                <label class="flex items-center gap-2 text-xs"><input type="checkbox" id="colAuthor" ${visible.author ? 'checked' : ''} /> ${AppState.getTranslation?.('release.author') || 'Author'}</label>
                <label class="flex items-center gap-2 text-xs"><input type="checkbox" id="colModules" ${visible.modules ? 'checked' : ''} /> ${AppState.getTranslation?.('release.modules') || 'Modules'}</label>
                <label class="flex items-center gap-2 text-xs"><input type="checkbox" id="colDesc" ${visible.description ? 'checked' : ''} /> ${AppState.getTranslation?.('release.description') || 'Description'}</label>
              </div>
            </details>
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
            <label>${AppState.getTranslation?.('release.total') || 'Total Releases'}:</label>
            <span id="pageInfo" aria-live="polite">0</span>
            <span class="ml-4">${AppState.getTranslation?.('release.compare') || 'Compare'}:</span>
            <select id="cmpA" class="border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700"></select>
            <select id="cmpB" class="border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700"></select>
            <button id="cmpBtn" class="px-2 py-1 border rounded">${AppState.getTranslation?.('release.diff') || 'Diff'}</button>
            <a id="cmpGh" href="#" target="_blank" rel="noopener noreferrer" class="hidden underline text-blue-600">${AppState.getTranslation?.('release.github') || 'GitHub'}</a>
            <label class="ml-3">${AppState.getTranslation?.('release.rows') || 'Rows'}:</label>
            <select id="pageSize" class="border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700">
              <option ${pageSize===5?'selected':''}>5</option>
              <option ${pageSize===10?'selected':''}>10</option>
              <option ${pageSize===20?'selected':''}>20</option>
              <option ${pageSize===50?'selected':''}>50</option>
              <option value="All" ${pageSize>1000?'selected':''}>All</option>
            </select>
            <button id="prevPage" class="ml-2 px-2 py-1 border rounded disabled:opacity-50" aria-label="${AppState.getTranslation?.('release.prev') || 'Prev'}">◀</button>
            <button id="nextPage" class="px-2 py-1 border rounded disabled:opacity-50" aria-label="${AppState.getTranslation?.('release.next') || 'Next'}">▶</button>
            <span class="ml-4">${AppState.getTranslation?.('release.view') || 'View'}:</span>
            <select id="viewSelect" class="border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700"></select>
            <input id="viewNameInput" class="w-36 border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700" placeholder="Name" />
            <button id="saveViewBtn" class="px-2 py-1 border rounded" title="${AppState.getTranslation?.('release.save_view') || 'Save View'}">${AppState.getTranslation?.('release.save_view') || 'Save View'}</button>
            <button id="deleteViewBtn" class="px-2 py-1 border rounded" title="${AppState.getTranslation?.('release.delete_view') || 'Delete View'}">${AppState.getTranslation?.('release.delete_view') || 'Delete'}</button>
            <span class="ml-3">${AppState.getTranslation?.('release.go') || 'Go'}:</span>
            <input id="gotoVersion" list="versionsList" class="w-28 border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700" placeholder="${AppState.getTranslation?.('release.goto_placeholder') || 'vX.Y.Z'}" />
            <datalist id="versionsList"></datalist>
            <button id="gotoBtn" class="px-2 py-1 border rounded">Go</button>
          </div>
        </div>
        <div id="tableWrap" class="overflow-x-auto overflow-y-auto rm-table-wrap border border-gray-300 dark:border-gray-700 rounded">
          <table id="dataTable" class="rm-table min-w-[820px] w-full text-left text-sm divide-y divide-gray-200 dark:divide-gray-700" aria-label="Release Logs Table">
            <thead class="sticky top-0 bg-gray-50 dark:bg-gray-700">
              <tr id="theadRow"></tr>
            </thead>
            <tbody id="tableBody" class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"></tbody>
          </table>
          <div id="noResults" class="rm-empty hidden p-6 text-center" role="status" aria-live="polite">
            <div class="rm-empty-icon" aria-hidden="true"></div>
            <div class="rm-empty-title">${AppState.getTranslation?.('release.no_results') || 'No releases found.'}</div>
            <div class="rm-empty-sub">${AppState.getTranslation?.('release.no_results_hint') || 'Try adjusting filters or clearing modules.'}</div>
            <div class="mt-3 flex flex-wrap gap-2 items-center justify-center text-sm">
              <span class="text-gray-500">${AppState.getTranslation?.('release.quick_filters') || 'Quick filters'}:</span>
              <button id="noResSuggestStable" class="rm-empty-btn">${AppState.getTranslation?.('release.status') || 'Status'}: Stable</button>
              <button id="noResSuggest30" class="rm-empty-btn">${AppState.getTranslation?.('release.last_30_days') || 'Last 30 days'}</button>
            </div>
            <button id="noResReset" class="rm-empty-btn">${AppState.getTranslation?.('release.reset_filters') || 'Reset Filters'}</button>
          </div>
        </div>
        <!-- Centered Details Modal -->
        <div id="releaseDetails" class="hidden fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/40" data-close="backdrop" aria-hidden="true"></div>
          <div class="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[95%] max-w-[840px] max-h-[80vh] overflow-y-auto p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 id="rmDetailsTitle" class="text-lg font-semibold text-gray-800 dark:text-gray-100">${AppState.getTranslation?.('release.details') || 'Details'}</h2>
              <button id="detailsClose" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.close') || 'Close'}</button>
            </div>
            <div id="detailsBody" class="text-sm text-gray-700 dark:text-gray-200"></div>
            <div class="mt-6 flex flex-wrap gap-2">
              <button id="copyJsonBtn" class="bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-800">${AppState.getTranslation?.('release.export_json') || 'Export JSON'}</button>
              <button id="copyMdBtn" class="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700">${AppState.getTranslation?.('release.export_md') || 'Export MD'}</button>
            <button id="copyTxtBtn" class="bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600">${AppState.getTranslation?.('release.copy') || 'Copy'}</button>
            </div>
          </div>
        </div>
        <!-- Compare Modal -->
        <div id="compareModal" class="hidden fixed inset-0 z-[1500]">
          <div class="absolute inset-0 bg-black/40" data-close="backdrop" aria-hidden="true"></div>
          <div class="absolute right-0 top-0 h-full w-full sm:w-[720px] bg-white dark:bg-gray-900 border-l dark:border-gray-700 shadow-xl p-6 overflow-y-auto">
          <div class="sticky top-0 z-10 -mx-6 px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 id="compareTitle" class="text-lg font-semibold text-gray-800 dark:text-gray-100">
              ${AppState.getTranslation?.('release.compare') || 'Compare'}
              <span id="cmpBadges" class="inline-flex items-center gap-2 ml-3 align-middle text-xs">
                <span id="cmpBadgeA" class="px-2 py-[2px] rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100"></span>
                <span id="cmpBadgeB" class="px-2 py-[2px] rounded bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-100"></span>
              </span>
            </h2>
            <div class="flex items-center gap-2">
              <label class="text-xs opacity-75 flex items-center gap-1"><input id="cmpDiffOnly" type="checkbox"/> ${AppState.getTranslation?.('release.diff_only') || 'Diff only'}</label>
              <label class="text-xs opacity-75 flex items-center gap-1"><input id="cmpFilesOnly" type="checkbox"/> ${AppState.getTranslation?.('release.files_only') || 'Files only'}</label>
              <button id="cmpOpenA" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.open_a') || 'Open A'}</button>
              <button id="cmpOpenB" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.open_b') || 'Open B'}</button>
              <button id="cmpSwap" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.swap') || 'Swap'}</button>
              <button id="cmpExportMd" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.export_compare_md') || 'Export Compare (MD)'}</button>
              <button id="cmpCopyLink" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.copy_link') || 'Copy Link'}</button>
              <button id="compareClose" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.close') || 'Close'}</button>
            </div>
          </div>
            <div id="compareBody" class="text-sm text-gray-700 dark:text-gray-200"></div>
            <!-- Sticky bottom action bar for long content -->
            <div class="sticky bottom-0 z-10 -mx-6 px-6 py-3 bg-white/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm flex flex-wrap gap-2 justify-end">
              <button id="cmpOpenABtm" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.open_a') || 'Open A'}</button>
              <button id="cmpOpenBBtm" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.open_b') || 'Open B'}</button>
              <button id="cmpSwapBtm" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.swap') || 'Swap'}</button>
              <button id="cmpExportMdBtm" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.export_compare_md') || 'Export Compare (MD)'}</button>
              <button id="cmpCopyLinkBtm" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.copy_link') || 'Copy Link'}</button>
              <button id="compareCloseBtm" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.close') || 'Close'}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const versionFilter = target.querySelector('#versionFilter');
    const fromDate = target.querySelector('#fromDate');
    const toDate = target.querySelector('#toDate');
    const statusFilter = target.querySelector('#statusFilter');
    const authorFilter = target.querySelector('#authorFilter');
    const moduleSelect = target.querySelector('#moduleSelect');
    const searchFilter = target.querySelector('#searchFilter');
    const qfStable = target.querySelector('#qfStable');
    const qfLast30 = target.querySelector('#qfLast30');
    const qfFilesOnly = target.querySelector('#qfFilesOnly');
    let filterFilesOnly = false;
    const resetBtn = target.querySelector('#resetBtn');
    const exportBtn = target.querySelector('#exportBtn');
    const actionMenuBtn = target.querySelector('#actionMenuBtn');
    const actionMenuBtnMain = target.querySelector('#actionMenuBtnMain');
    const actionPopover = target.querySelector('#actionPopover');
    const importBtn = target.querySelector('#importJsonBtn');
    const importFile = target.querySelector('#importFile');
    const newReleaseBtn = target.querySelector('#newReleaseBtn');
    const persistJsonBtn = target.querySelector('#persistJsonBtn');
    const unsavedBanner = target.querySelector('#unsavedBanner');
    const unsavedSaveBtn = target.querySelector('#unsavedSaveBtn');
    const unsavedDismissBtn = target.querySelector('#unsavedDismissBtn');
    const unsavedDot = target.querySelector('#rmUnsavedDot');
    const toggleFiltersBtn = target.querySelector('#toggleFiltersBtn');
    let hasUnsaved = false;
    const markUnsaved = () => {
      hasUnsaved = true;
      try { persistJsonBtn?.classList.remove('hidden'); } catch {}
      try { unsavedBanner?.classList.remove('hidden'); } catch {}
      try { unsavedDot?.classList.remove('hidden'); } catch {}
    };
    const clearUnsaved = () => {
      hasUnsaved = false;
      try { persistJsonBtn?.classList.add('hidden'); } catch {}
      try { unsavedBanner?.classList.add('hidden'); } catch {}
      try { unsavedDot?.classList.add('hidden'); } catch {}
    };
    const releaseCount = target.querySelector('#releaseCount');
    const stableCount = target.querySelector('#stableCount');
    const latestVersion = target.querySelector('#latestVersion');
    const tableBody = target.querySelector('#tableBody');
    const theadRow = target.querySelector('#theadRow');

    // Advanced filters: open/closed durumunu hatırla
    try {
      const adv = target.querySelector('#advFilters');
      if (adv) {
        const saved = localStorage.getItem('RM_AdvFiltersOpen');
        if (saved === 'true') adv.open = true;
        adv.addEventListener('toggle', () => {
          try { localStorage.setItem('RM_AdvFiltersOpen', String(adv.open)); } catch {}
        });
      }
    } catch {}

    // Mobilde filtreleri göster/gizle
    try {
      const form = target.querySelector('form#filterForm');
      const isSmall = () => window.innerWidth < 640;
      const applyVis = () => {
        if (!form) return;
        if (isSmall()) {
          const open = (localStorage.getItem('RM_FiltersOpen') !== 'false');
          form.classList.toggle('hidden', !open);
          try { toggleFiltersBtn?.setAttribute('aria-expanded', String(open)); } catch {}
        } else {
          form.classList.remove('hidden');
          try { toggleFiltersBtn?.setAttribute('aria-expanded', 'true'); } catch {}
        }
      };
      applyVis();
      window.addEventListener('resize', () => applyVis(), { passive: true });
      try { toggleFiltersBtn?.setAttribute('aria-controls','filterForm'); } catch {}
      toggleFiltersBtn?.addEventListener('click', () => {
        if (!form) return;
        const nowHidden = form.classList.toggle('hidden');
        try { localStorage.setItem('RM_FiltersOpen', String(!nowHidden)); } catch {}
        try { toggleFiltersBtn?.setAttribute('aria-expanded', String(!nowHidden)); } catch {}
      });
    } catch {}

    // Kolon genişliklerini hatırlamak için basit yardımcılar
    const loadColWidths = () => { try { return JSON.parse(localStorage.getItem('RM_ColWidths')||'{}'); } catch { return {}; } };
    const saveColWidths = (obj) => { try { localStorage.setItem('RM_ColWidths', JSON.stringify(obj)); } catch {} };
    let colWidths = loadColWidths();
    const applyColWidths = () => {
      try {
        // Header
        if (Array.isArray(headerCells)) {
          const map = new Map(headerCells.map(th => [th.dataset.key, th]));
          Object.entries(colWidths || {}).forEach(([k, w]) => {
            const px = parseInt(w,10);
            const th = map.get(k);
            if (th && px) th.style.width = px + 'px';
          });
        }
        // Body
        Object.entries(colWidths || {}).forEach(([k, w]) => {
          const px = parseInt(w,10);
          if (!px) return;
          tableBody?.querySelectorAll(`td[data-key="${k}"]`)?.forEach(td => { td.style.width = px + 'px'; });
        });
      } catch {}
    };
    const clearColWidths = () => {
      try {
        if (Array.isArray(headerCells)) headerCells.forEach(th => { try { th.style.width = ''; } catch {} });
        tableBody?.querySelectorAll('td')?.forEach(td => { try { td.style.width = ''; } catch {} });
        tableBody?.querySelectorAll('th[scope="row"]')?.forEach(td => { try { td.style.width = ''; } catch {} });
      } catch {}
    };

    // Compute width that fits current content (header + visible rows)
    function autoFitColumn(key){
      try {
        // Map header cells by key
        const headMap = new Map(headerCells.map(th => [th.dataset.key, th]));
        const th = headMap.get(key);
        let maxW = 0;
        if (th) maxW = Math.max(maxW, th.scrollWidth || 0);
        // Collect body cells for the key
        let cells;
        if (key === 'version') {
          cells = tableBody ? Array.from(tableBody.querySelectorAll('th[scope="row"]')) : [];
        } else {
          cells = tableBody ? Array.from(tableBody.querySelectorAll(`td[data-key="${key}"]`)) : [];
        }
        // Measure up to first 250 rows for performance
        const limit = 250;
        for (let i = 0; i < cells.length && i < limit; i++) {
          const c = cells[i];
          const w = c ? (c.scrollWidth || 0) : 0;
          if (w > maxW) maxW = w;
        }
        // Padding + clamp
        let wpx = Math.round(maxW + 24);
        const MIN = 80; const MAX = key === 'description' ? 720 : 600;
        wpx = Math.max(MIN, Math.min(MAX, wpx));
        if (th) th.style.width = wpx + 'px';
        if (key === 'version') {
          tableBody?.querySelectorAll('th[scope="row"]')?.forEach(td => { td.style.width = wpx + 'px'; });
        } else {
          tableBody?.querySelectorAll(`td[data-key="${key}"]`)?.forEach(td => { td.style.width = wpx + 'px'; });
        }
        colWidths[key] = wpx; saveColWidths(colWidths);
      } catch {}
    }
    function buildHeader(){
      if (!theadRow) return [];
      theadRow.innerHTML = '';
      // Ensure a hidden help text for draggable columns (for screen readers)
      function ensureColDragHelp(){
        let el = document.getElementById('rmColDragHelp');
        if (!el) {
          el = document.createElement('div');
          el.id = 'rmColDragHelp';
          el.className = 'sr-only';
          el.setAttribute('aria-hidden','true');
          el.textContent = AppState.getTranslation?.('release.aria_col_drag_help') || 'Drag to reorder columns.';
          document.body.appendChild(el);
        }
        return el.id;
      }
      const thV = document.createElement('th');
      thV.className = 'px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 sticky left-0 bg-gray-50 dark:bg-gray-700';
      thV.innerHTML = `${AppState.getTranslation?.('release.version') || 'Version'} <span class="sort-ico ml-1 opacity-40">⇅</span>`;
      thV.setAttribute('data-key','version');
      thV.setAttribute('scope','col');
      theadRow.appendChild(thV);
      const labels = {
        date: AppState.getTranslation?.('release.date') || 'Date',
        status: AppState.getTranslation?.('release.status') || 'Status',
        author: AppState.getTranslation?.('release.author') || 'Author',
        modules: AppState.getTranslation?.('release.modules') || 'Modules',
        description: AppState.getTranslation?.('release.description') || 'Description'
      };
      const makeTh = (key) => {
        const th = document.createElement('th');
        th.className = 'px-4 py-3 font-semibold text-gray-700 dark:text-gray-200';
        th.draggable = true;
        th.setAttribute('data-key', key);
        th.setAttribute('scope','col');
        try { th.setAttribute('aria-grabbed','false'); th.setAttribute('aria-describedby', ensureColDragHelp()); } catch {}
        th.innerHTML = `${labels[key] || key} <span class="sort-ico ml-1 opacity-40">⇅</span>`;
        // Kolon genişletme tutacağı
        const rz = document.createElement('div');
        rz.className = 'rm-col-resizer';
        rz.addEventListener('mousedown', (e) => {
          e.preventDefault(); e.stopPropagation();
          const startX = e.clientX;
          const startW = th.getBoundingClientRect().width;
          const min = 80, max = 600;
          const onMove = (ev) => {
            const w = Math.max(min, Math.min(max, Math.round(startW + (ev.clientX - startX))));
            th.style.width = w + 'px';
            colWidths[key] = w;
            tableBody?.querySelectorAll(`td[data-key="${key}"]`)?.forEach(td => { td.style.width = w + 'px'; });
          };
          const onUp = () => { saveColWidths(colWidths); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp, { once: true });
        });
        // Çift tık: otomatik sığdır; Shift+çift tık: sıfırla
        rz.addEventListener('dblclick', (e) => {
          e.preventDefault(); e.stopPropagation();
          if (e.shiftKey) {
            delete colWidths[key]; saveColWidths(colWidths);
            th.style.width = '';
            tableBody?.querySelectorAll(`td[data-key="${key}"]`)?.forEach(td => { td.style.width = ''; });
            if (key === 'version') tableBody?.querySelectorAll('th[scope="row"]')?.forEach(td => { td.style.width = ''; });
          } else {
            autoFitColumn(key);
          }
        });
        th.appendChild(rz);
        // Context menu (right click) for quick freeze/auto-fit
        th.addEventListener('contextmenu', (e) => { e.preventDefault(); openColCtxMenu(key, e); });
        th.addEventListener('dragstart', (e)=>{ e.dataTransfer.setData('text/plain', key); th.classList.add('opacity-50'); try { th.setAttribute('aria-grabbed','true'); } catch {} });
        th.addEventListener('dragend', ()=> { th.classList.remove('opacity-50'); try { th.setAttribute('aria-grabbed','false'); } catch {} });
        th.addEventListener('dragover', (e)=>{ e.preventDefault(); th.classList.add('ring-2','ring-blue-400'); });
        th.addEventListener('dragleave', ()=> th.classList.remove('ring-2','ring-blue-400'));
        th.addEventListener('drop', (e)=>{
          e.preventDefault(); th.classList.remove('ring-2','ring-blue-400');
          const from = e.dataTransfer.getData('text/plain');
          const to = key;
          if (!from || from===to) return;
          const o = colOrder.filter(k=>k!==from);
          const idx = o.indexOf(to);
          if (idx>=0) o.splice(idx,0,from);
          colOrder = o;
          savePrefs({ visible, pageSize, order: colOrder });
          headerCells = buildHeader();
          bindSortHeaders();
          applyColWidths();
          renderRows(filterData());
        });
        return th;
      };
      colOrder.forEach(k => theadRow.appendChild(makeTh(k)));
      // Column visibility quick menu trigger (at end of header)
      const thCtrl = document.createElement('th');
      thCtrl.className = 'px-2 py-3 text-right align-middle';
      thCtrl.setAttribute('scope','col');
      thCtrl.innerHTML = `<button id="colMenuBtn" type="button" class="rm-colbtn" aria-haspopup="menu" aria-expanded="false" title="${AppState.getTranslation?.('release.columns') || 'Columns'}" aria-label="${AppState.getTranslation?.('release.columns') || 'Columns'}">⋯</button>`;
      theadRow.appendChild(thCtrl);
      return Array.from(theadRow.querySelectorAll('th'));
    }
    // Header column context menu
    function openColCtxMenu(key, evt){
      try {
        const allowed = { date: 'freezeDate', status: 'freezeStatus', author: 'freezeAuthor', modules: 'freezeModules' };
        const labelMap = { date: (AppState.getTranslation?.('release.date')||'Date'), status: (AppState.getTranslation?.('release.status')||'Status'), author: (AppState.getTranslation?.('release.author')||'Author'), modules: (AppState.getTranslation?.('release.modules')||'Modules') };
        let el = document.getElementById('rmColCtx');
        if (!el) { el = document.createElement('div'); el.id = 'rmColCtx'; el.className = 'rm-colctx hidden'; document.body.appendChild(el); }
        const isFrozen = (key==='date'&&freezeDate)||(key==='status'&&freezeStatus)||(key==='author'&&freezeAuthor)||(key==='modules'&&freezeModules);
        const canFreeze = !!allowed[key];
        const items = [];
        if (canFreeze) items.push(`<button data-act="toggle">${isFrozen ? (AppState.getTranslation?.('release.unfreeze')||'Unfreeze') : (AppState.getTranslation?.('release.freeze_'+key) || ('Freeze '+(labelMap[key]||key)))}</button>`);
        items.push(`<button data-act="autofit">${AppState.getTranslation?.('release.autofit_col')||'Auto-fit column'}</button>`);
        items.push(`<button data-act="resetw">${AppState.getTranslation?.('release.reset_width')||'Reset width'}</button>`);
        el.innerHTML = items.join('');
        const posX = evt.clientX, posY = evt.clientY;
        el.style.left = Math.max(8, posX - 10) + 'px';
        el.style.top = Math.max(8, posY - 10) + 'px';
        el.classList.remove('hidden');
        const close = () => { try { el.classList.add('hidden'); } catch {} document.removeEventListener('click', onDoc, true); };
        const onDoc = (e) => { if (!el.contains(e.target)) close(); };
        document.addEventListener('click', onDoc, true);
        el.querySelector('[data-act="autofit"]')?.addEventListener('click', () => { try { autoFitColumn(key); updateStickyOffsets(); } catch {} close(); });
        el.querySelector('[data-act="resetw"]')?.addEventListener('click', () => { try { delete colWidths[key]; saveColWidths(colWidths); const map = new Map(headerCells.map(th => [th.dataset.key, th])); const th = map.get(key); if (th) th.style.width=''; tableBody?.querySelectorAll(`td[data-key="${key}"]`)?.forEach(td=> td.style.width=''); updateStickyOffsets(); } catch {} close(); });
        el.querySelector('[data-act="toggle"]')?.addEventListener('click', () => {
          try {
            if (key==='date') { freezeDate = !freezeDate; localStorage.setItem('RM_FreezeDate', String(freezeDate)); }
            else if (key==='status') { freezeStatus = !freezeStatus; localStorage.setItem('RM_FreezeStatus', String(freezeStatus)); }
            else if (key==='author') { freezeAuthor = !freezeAuthor; localStorage.setItem('RM_FreezeAuthor', String(freezeAuthor)); }
            else if (key==='modules') { freezeModules = !freezeModules; localStorage.setItem('RM_FreezeModules', String(freezeModules)); }
            applyFreezeClass(); updateStickyOffsets();
          } catch {}
          close();
        });
      } catch {}
    }
    // Quick column visibility menu init
    function initColMenu(){
      const btn = theadRow?.querySelector && theadRow.querySelector('#colMenuBtn');
      if (!btn) return;
      const ensureMenu = () => {
        let el = document.getElementById('rmColMenu');
        if (!el) {
          el = document.createElement('div');
          el.id = 'rmColMenu';
          el.className = 'rm-colmenu hidden';
          document.body.appendChild(el);
        }
        return el;
      };
      const close = () => {
        const el = document.getElementById('rmColMenu');
        if (!el) return;
        el.classList.add('hidden');
        try { btn.setAttribute('aria-expanded','false'); } catch {}
        document.removeEventListener('click', onDoc, true);
        window.removeEventListener('resize', close);
        window.removeEventListener('scroll', close, true);
      };
      const onDoc = (e) => {
        const m = document.getElementById('rmColMenu');
        if (!m) return;
        if (m.contains(e.target) || btn.contains(e.target)) return;
        close();
      };
      btn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const menu = ensureMenu();
        const items = [
          { key:'date', label: AppState.getTranslation?.('release.date') || 'Date' },
          { key:'status', label: AppState.getTranslation?.('release.status') || 'Status' },
          { key:'author', label: AppState.getTranslation?.('release.author') || 'Author' },
          { key:'modules', label: AppState.getTranslation?.('release.modules') || 'Modules' },
          { key:'description', label: AppState.getTranslation?.('release.description') || 'Description' }
        ];
        menu.innerHTML = items.map(it => `
          <label class=\"rm-colmenu-item\"><input type=\"checkbox\" data-key=\"${it.key}\" ${visible[it.key]!==false?'checked':''}/> ${it.label}</label>
        `).join('') + `
          <label class=\"rm-colmenu-item\" style=\"margin-top:.25rem;\"><input type=\"checkbox\" id=\"rmFreezeDate\" ${freezeDate?'checked':''}/> ${AppState.getTranslation?.('release.freeze_date') || 'Freeze Date'}</label>
          <label class=\"rm-colmenu-item\"><input type=\"checkbox\" id=\"rmFreezeAuthor\" ${freezeAuthor?'checked':''}/> ${AppState.getTranslation?.('release.freeze_author') || 'Freeze Author'}</label>
          <label class=\"rm-colmenu-item\"><input type=\"checkbox\" id=\"rmExportVisible\" ${exportVisibleOnly?'checked':''}/> ${AppState.getTranslation?.('release.export_visible') || 'Export visible columns'}</label>
          <div class=\"rm-colmenu-actions\">
            <button id=\"rmColAutoFit\" type=\"button\" class=\"rm-colmenu-apply\">Auto-fit</button>
            <button id=\"rmColReset\" type=\"button\" class=\"rm-colmenu-reset\">Reset</button>
          </div>
        `;
        // Inject Go direction radios just before actions
        try {
          const act = menu.querySelector('.rm-colmenu-actions');
          const holder = document.createElement('div');
          holder.innerHTML = `
            <div class=\"rm-colmenu-item\" style=\"margin-top:.25rem;display:block;\">
              <div style=\"font-size:12px;opacity:.75;margin-bottom:.25rem;\">${AppState.getTranslation?.('release.go_dir') || 'Go direction'}</div>
              <label style=\"margin-right:.5rem;\"><input type=\"radio\" name=\"rmGoDir\" value=\"down\" ${goDirection==='down'?'checked':''}/> ${AppState.getTranslation?.('release.go_dir_down') || 'Nearest lower'}</label>
              <label><input type=\"radio\" name=\"rmGoDir\" value=\"up\" ${goDirection==='up'?'checked':''}/> ${AppState.getTranslation?.('release.go_dir_up') || 'Nearest higher'}</label>
            </div>`;
          if (act) menu.insertBefore(holder.firstElementChild, act);
        } catch {}
        // Inject Freeze Status checkbox just before actions
        try {
          const act = menu.querySelector('.rm-colmenu-actions');
          const el = document.createElement('div');
          el.innerHTML = `<label class=\"rm-colmenu-item\"><input type=\"checkbox\" id=\"rmFreezeStatus\" ${freezeStatus?'checked':''}/> ${AppState.getTranslation?.('release.freeze_status') || 'Freeze Status'}</label>`;
          if (act) menu.insertBefore(el.firstElementChild, act);
        } catch {}
        // Inject Freeze Modules checkbox just before actions
        try {
          const act = menu.querySelector('.rm-colmenu-actions');
          const el = document.createElement('div');
          el.innerHTML = `<label class=\"rm-colmenu-item\"><input type=\"checkbox\" id=\"rmFreezeModules\" ${freezeModules?'checked':''}/> ${AppState.getTranslation?.('release.freeze_modules') || 'Freeze Modules'}</label>`;
          if (act) menu.insertBefore(el.firstElementChild, act);
        } catch {}
        menu.querySelectorAll('input[type="checkbox"]').forEach(input => {
          input.addEventListener('change', (ev) => {
            const k = ev.target.getAttribute('data-key');
            visible[k] = ev.target.checked;
            try { savePrefs({ visible, pageSize, order: colOrder }); } catch {}
            try { headerCells = buildHeader(); bindSortHeaders(); applyColWidths(); renderRows(filterData()); initColMenu(); } catch {}
          });
        });
        // Freeze Status toggle
        menu.querySelector('#rmFreezeStatus')?.addEventListener('change', (ev) => {
          freezeStatus = !!ev.target.checked;
          try { localStorage.setItem('RM_FreezeStatus', String(freezeStatus)); } catch {}
          applyFreezeClass(); updateStickyOffsets();
        });
        menu.querySelector('#rmColReset')?.addEventListener('click', () => {
          try {
            visible = { ...defaultPrefs.visible };
            colOrder = [...defaultPrefs.order];
            colWidths = {}; saveColWidths(colWidths); clearColWidths();
            savePrefs({ visible, pageSize, order: colOrder });
            headerCells = buildHeader(); bindSortHeaders(); applyColWidths(); renderRows(filterData()); initColMenu();
          } catch {}
        });
        // Freeze & export toggles
        menu.querySelector('#rmFreezeDate')?.addEventListener('change', (ev) => {
          freezeDate = !!ev.target.checked;
          try { localStorage.setItem('RM_FreezeDate', String(freezeDate)); } catch {}
          applyFreezeClass(); updateStickyOffsets();
        });
        menu.querySelector('#rmExportVisible')?.addEventListener('change', (ev) => {
          exportVisibleOnly = !!ev.target.checked;
          try { localStorage.setItem('RM_ExportVisible', String(exportVisibleOnly)); } catch {}
        });
        menu.querySelector('#rmFreezeStatus')?.addEventListener('change', (ev) => {
          freezeStatus = !!ev.target.checked;
          try { localStorage.setItem('RM_FreezeStatus', String(freezeStatus)); } catch {}
          applyFreezeClass(); updateStickyOffsets();
        });
        menu.querySelector('#rmFreezeAuthor')?.addEventListener('change', (ev) => {
          freezeAuthor = !!ev.target.checked;
          try { localStorage.setItem('RM_FreezeAuthor', String(freezeAuthor)); } catch {}
          applyFreezeClass(); updateStickyOffsets();
        });
        menu.querySelector('#rmFreezeModules')?.addEventListener('change', (ev) => {
          freezeModules = !!ev.target.checked;
          try { localStorage.setItem('RM_FreezeModules', String(freezeModules)); } catch {}
          applyFreezeClass(); updateStickyOffsets();
        });
        // Go direction radios
        try {
          menu.querySelectorAll('input[name="rmGoDir"]').forEach(r => {
            r.addEventListener('change', (ev) => {
              goDirection = ev.target.value === 'up' ? 'up' : 'down';
              try { localStorage.setItem('RM_GoDirection', goDirection); } catch {}
            });
          });
        } catch {}
        // Auto-fit
        menu.querySelector('#rmColAutoFit')?.addEventListener('click', () => {
          try {
            try { autoFitColumn('version'); } catch {}
            ;['date','status','author','modules','description'].forEach(k => { if (visible[k]!==false) { try { autoFitColumn(k); } catch {} } });
            updateStickyOffsets();
          } catch {}
        });
        const rect = btn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 6) + 'px';
        menu.style.left = Math.max(8, rect.right - 180) + 'px';
        menu.classList.remove('hidden');
        try { btn.setAttribute('aria-expanded','true'); } catch {}
        document.addEventListener('click', onDoc, true);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
      };
    }
    let headerCells = buildHeader();
    applyColWidths();
    initColMenu();
    const noResults = target.querySelector('#noResults');
    const exportJsonBtn = target.querySelector('#exportJsonBtn');
    const exportMetaBtn = target.querySelector('#exportMetaBtn');
    const exportMdBtn = target.querySelector('#exportMdBtn');
    const exportMdPublicBtn = target.querySelector('#exportMdPublicBtn');
    const exportViewsBtn = target.querySelector('#exportViewsBtn');
    const importViewsBtn = target.querySelector('#importViewsBtn');
    const copyViewLinkBtn = target.querySelector('#copyViewLinkBtn');
    const importViewsFile = target.querySelector('#importViewsFile');
    // Ensure details modal is attached to <body> to avoid stacking/transform issues
    let details = target.querySelector('#releaseDetails') || document.body.querySelector('#releaseDetails');
    const localDetails = target.querySelector('#releaseDetails');
    const existingDetails = document.body.querySelector('#releaseDetails');
    if (existingDetails && localDetails && existingDetails !== localDetails) {
      // Remove duplicate created by re-render
      try { localDetails.remove(); } catch {}
      details = existingDetails;
    } else if (details && details.parentElement !== document.body) {
      try { document.body.appendChild(details); } catch {}
    } else if (!details) {
      // Fallback: create modal if missing for any reason
      details = document.createElement('div');
      details.id = 'releaseDetails';
      details.className = 'hidden fixed inset-0 z-[2000] flex items-center justify-center p-4';
      details.innerHTML = `
        <div class="absolute inset-0 bg-black/40" data-close="backdrop" aria-hidden="true"></div>
        <div class="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[95%] max-w-[840px] max-h-[80vh] overflow-y-auto p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">${AppState.getTranslation?.('release.details') || 'Details'}</h2>
            <button id="detailsClose" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.close') || 'Close'}</button>
          </div>
          <div id="detailsBody" class="text-sm text-gray-700 dark:text-gray-200"></div>
          <div class="mt-6 flex flex-wrap gap-2">
            <button id="copyJsonBtn" class="bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-800">${AppState.getTranslation?.('release.export_json') || 'Export JSON'}</button>
            <button id="copyMdBtn" class="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700">${AppState.getTranslation?.('release.export_md') || 'Export MD'}</button>
            <button id="copyTxtBtn" class="bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600">${AppState.getTranslation?.('release.copy') || 'Copy'}</button>
          </div>
        </div>`;
      try { document.body.appendChild(details); } catch {}
    }
    const detailsClose = details ? details.querySelector('#detailsClose') : null;
    const cmpA = target.querySelector('#cmpA');
    const cmpB = target.querySelector('#cmpB');
    const cmpBtn = target.querySelector('#cmpBtn');
    const cmpGh = target.querySelector('#cmpGh');
    // Reparent compare modal to body to avoid stacking issues
    let compareModal = target.querySelector('#compareModal') || document.body.querySelector('#compareModal');
    const localCompare = target.querySelector('#compareModal');
    const existingCompare = document.body.querySelector('#compareModal');
    if (existingCompare && localCompare && existingCompare !== localCompare) {
      try { localCompare.remove(); } catch {}
      compareModal = existingCompare;
    } else if (compareModal && compareModal.parentElement !== document.body) {
      try { document.body.appendChild(compareModal); } catch {}
    }
    const compareBody = compareModal ? compareModal.querySelector('#compareBody') : null;
    const compareClose = compareModal ? compareModal.querySelector('#compareClose') : null;
    const pageInfo = target.querySelector('#pageInfo');
    const prevBtn = target.querySelector('#prevPage');
    const nextBtn = target.querySelector('#nextPage');
    const pageSizeSel = target.querySelector('#pageSize');
    const viewSelect = target.querySelector('#viewSelect');
    const saveViewBtn = target.querySelector('#saveViewBtn');
    const gotoInput = target.querySelector('#gotoVersion');
    const gotoBtn = target.querySelector('#gotoBtn');
    const colDate = target.querySelector('#colDate');
    const colStatus = target.querySelector('#colStatus');
    const colAuthor = target.querySelector('#colAuthor');
    const colDesc = target.querySelector('#colDesc');

    const fillSelect = (selectEl, options) => {
      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        selectEl.appendChild(option);
      });
    };

    fillSelect(versionFilter, uniqueValues(releases, 'version'));
    fillSelect(statusFilter, uniqueValues(releases, 'status'));
    fillSelect(authorFilter, uniqueValues(releases, 'author'));
    // Modules select (unique list from computeReleaseModules)
    if (moduleSelect) {
      const allMods = Array.from(new Set(releases.flatMap(r => computeReleaseModules(r))))
        .filter(Boolean).sort();
      fillSelect(moduleSelect, allMods);
    }
    // Fill compare selects with versions (newest first)
    const versions = uniqueValues(releases, 'version').sort((a,b)=>compareVersion(b,a));
    const fillCmp = (sel, vals) => { sel.innerHTML=''; vals.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent='v'+v; sel.appendChild(o); }); };
    if (cmpA && cmpB) {
      fillCmp(cmpA, versions);
      fillCmp(cmpB, versions);
      if (versions.length>=2) { cmpA.value = versions[1]; cmpB.value = versions[0]; }
    }
    // Fill datalist for quick jump
    try {
      const dl = target.querySelector('#versionsList');
      if (dl) { dl.innerHTML = versions.map(v=>`<option value="${v}"></option>`).join(''); }
    } catch {}

    function gotoVersion(ver){
      if (!ver) return;
      ver = String(ver).replace(/^v/i,'');
      // If current DOM has the row, focus it; else compute index and scroll wrapper
      const tr = tableBody.querySelector(`tr[data-version="${ver}"]`);
      const wrap = document.getElementById('tableWrap');
      if (tr) {
        try { tr.scrollIntoView({ block: 'nearest' }); tr.focus(); } catch {}
        return;
      }
      // Approximate index via sorted list
      const idx = versions.indexOf(ver);
      if (idx >= 0 && wrap) {
        const probe = tableBody.querySelector('tr:not(.rm-inline-details)');
        const rowH = Math.max(1, Math.round((probe?.getBoundingClientRect().height)||48));
        wrap.scrollTop = idx * rowH;
        setTimeout(()=>{
          const tr2 = tableBody.querySelector(`tr[data-version="${ver}"]`);
          if (tr2) { try { tr2.scrollIntoView({ block:'nearest' }); tr2.focus(); } catch {} }
        }, 50);
      } else if (wrap) {
        // Nearest version jump: respect preferred direction
        let target = null;
        if (goDirection === 'up') {
          // first strictly higher
          for (let i = versions.length - 1; i >= 0; i--) {
            if (compareVersion(versions[i], ver) > 0) { target = versions[i]; break; }
          }
          if (!target && versions.length) target = versions[versions.length - 1];
        } else {
          // first lower or equal
          for (let i = 0; i < versions.length; i++) {
            if (compareVersion(versions[i], ver) <= 0) { target = versions[i]; break; }
          }
          if (!target && versions.length) target = versions[0];
        }
        if (target) {
          const probe = tableBody.querySelector('tr:not(.rm-inline-details)');
          const rowH = Math.max(1, Math.round((probe?.getBoundingClientRect().height)||48));
          const i = versions.indexOf(target);
          if (i >= 0) {
            wrap.scrollTop = i * rowH;
            setTimeout(()=>{
              const tr2 = tableBody.querySelector(`tr[data-version=\"${target}\"]`);
              if (tr2) { try { tr2.scrollIntoView({ block:'nearest' }); tr2.focus(); } catch {} }
            }, 60);
            try { Toast?.show?.(`→ v${target}`, 'info'); } catch {}
          }
        } else {
          try { Toast?.show?.(AppState.getTranslation?.('release.version_not_found') || 'Version not found', 'error'); } catch {}
        }
      } else {
        try { Toast?.show?.(AppState.getTranslation?.('release.version_not_found') || 'Version not found', 'error'); } catch {}
      }
    }
    gotoBtn?.addEventListener('click', ()=> gotoVersion(gotoInput?.value?.trim()));
    gotoInput?.addEventListener('keydown', (e)=>{ if (e.key==='Enter') { e.preventDefault(); gotoVersion(gotoInput.value.trim()); }});

    // Freeze Date/Status (ek sütunlar)
    let freezeDate = (localStorage.getItem('RM_FreezeDate') === 'true');
    let freezeStatus = (localStorage.getItem('RM_FreezeStatus') === 'true');
    let freezeAuthor = (localStorage.getItem('RM_FreezeAuthor') === 'true');
    let freezeModules = (localStorage.getItem('RM_FreezeModules') === 'true');
    // Export only visible columns (for CSV)
    let exportVisibleOnly = (localStorage.getItem('RM_ExportVisible') === 'true');
    let autoLink = (localStorage.getItem('RM_AutoLink') === 'true');
    // Go direction preference: 'down' | 'up'
    let goDirection = (localStorage.getItem('RM_GoDirection') || 'down');
    function applyFreezeClass(){
      try {
        const tbl = theadRow?.closest && theadRow.closest('table');
        if (!tbl) return;
        tbl.classList.toggle('rm-freeze-date', !!freezeDate);
        tbl.classList.toggle('rm-freeze-status', !!freezeStatus);
        tbl.classList.toggle('rm-freeze-author', !!freezeAuthor);
        tbl.classList.toggle('rm-freeze-modules', !!freezeModules);
      } catch {}
    }
    applyFreezeClass();

    function updateStickyOffsets(){
      try {
        const tbl = theadRow?.closest && theadRow.closest('table');
        if (!tbl) return;
        const first = tbl.querySelector('tbody th[scope="row"], thead th[data-key="version"]');
        const w = first ? Math.round(first.getBoundingClientRect().width) : 160;
        tbl.style.setProperty('--rm-left1', w + 'px');
        let l2 = w;
        if (freezeDate) {
          const dth = tbl.querySelector('thead th[data-key="date"]');
          const dtd = tbl.querySelector('tbody td[data-key="date"]');
          const wd = Math.round((dth?.getBoundingClientRect().width || dtd?.getBoundingClientRect().width || 120));
          l2 += wd;
        }
        tbl.style.setProperty('--rm-left2', l2 + 'px');
        let l3 = l2;
        if (freezeStatus) {
          const sth = tbl.querySelector('thead th[data-key="status"]');
          const std = tbl.querySelector('tbody td[data-key="status"]');
          const ws = Math.round((sth?.getBoundingClientRect().width || std?.getBoundingClientRect().width || 120));
          l3 += ws;
        }
        tbl.style.setProperty('--rm-left3', l3 + 'px');
        let l4 = l3;
        if (freezeAuthor) {
          const ath = tbl.querySelector('thead th[data-key="author"]');
          const atd = tbl.querySelector('tbody td[data-key="author"]');
          const wa = Math.round((ath?.getBoundingClientRect().width || atd?.getBoundingClientRect().width || 120));
          l4 += wa;
        }
        tbl.style.setProperty('--rm-left4', l4 + 'px');
        if (freezeDate) {
          try { const dth = tbl.querySelector('thead th[data-key="date"]'); if (dth) dth.setAttribute('title', AppState.getTranslation?.('release.frozen') || 'Frozen'); } catch {}
        }
        if (freezeStatus) {
          try { const sth = tbl.querySelector('thead th[data-key="status"]'); if (sth) sth.setAttribute('title', AppState.getTranslation?.('release.frozen') || 'Frozen'); } catch {}
        }
        if (freezeAuthor) {
          try { const ath = tbl.querySelector('thead th[data-key="author"]'); if (ath) ath.setAttribute('title', AppState.getTranslation?.('release.frozen') || 'Frozen'); } catch {}
        }
        if (freezeModules) {
          try { const mth = tbl.querySelector('thead th[data-key="modules"]'); if (mth) mth.setAttribute('title', AppState.getTranslation?.('release.frozen') || 'Frozen'); } catch {}
        }
      } catch {}
    }

    // URL state helpers (auto link)
    function encodeStateToHash(){
      try {
        const st = serializeState();
        const enc = btoa(unescape(encodeURIComponent(JSON.stringify(st)))).replace(/=+$/,'');
        setHashParam('state', enc);
      } catch {}
    }

    function renderRows(data) {
      const tableEl = theadRow && theadRow.closest ? theadRow.closest('table') : null;
      const wrapEl = tableEl ? tableEl.parentElement : null;
      // Cleanup previous virtual scroll listeners if any
      try { if (wrapEl && wrapEl.__rmVirtCleanup) { wrapEl.__rmVirtCleanup(); wrapEl.__rmVirtCleanup = null; } } catch {}
      try { tableEl?.setAttribute('aria-busy','true'); } catch {}
      tableBody.innerHTML = '';
      if (!data.length) {
        noResults.classList.remove('hidden');
        return;
      }
      noResults.classList.add('hidden');
      const rowsAll = applySort(data);
      const total = rowsAll.length;
      const isVirtual = (pageSizeSel?.value === 'All');
      let start = 0, end = total;
      if (!isVirtual) {
        const maxPage = Math.max(1, Math.ceil(total / pageSize));
        if (page > maxPage) page = maxPage;
        start = (page - 1) * pageSize;
        end = Math.min(total, start + pageSize);
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page >= maxPage;
      } else {
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
      }
      let rows = rowsAll.slice(start, end);
      pageInfo.textContent = `${total ? (isVirtual ? 1 : start + 1) : 0}-${isVirtual ? 0 : end} / ${total}`;
      // update aria-sort indicators
      const keys = ['version', ...colOrder];
      headerCells.forEach((th, idx) => {
        const k = keys[idx];
        if (!k || k === 'description') { th.removeAttribute('aria-sort'); return; }
        th.setAttribute('aria-sort', sortState.key === k ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : 'none');
        // column visibility on header (skip version)
        if (k==='date') th.classList.toggle('hidden', !visible.date);
        if (k==='status') th.classList.toggle('hidden', !visible.status);
        if (k==='author') th.classList.toggle('hidden', !visible.author);
        if (k==='modules') th.classList.toggle('hidden', !visible.modules);
        if (k==='description') th.classList.toggle('hidden', !visible.description);
      });
      applyFreezeClass();
      updateStickyOffsets();
      const frag = document.createDocumentFragment();
      const buildRow = (r) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700 h-12 align-middle';
        tr.setAttribute('role','row');
        tr.setAttribute('tabindex','-1');
        tr.dataset.version = String(r.version || '');
        const statusClass = r.status === 'Stable'
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        const desc = resolveDesc(r);
        const modNames = computeReleaseModules(r);
        const verrs = validateRelease(r);
        const tds = [];
        tds.push(`
          <th scope=\"row\" class=\"px-4 py-2 font-semibold text-blue-700 dark:text-blue-400 sticky left-0 bg-white dark:bg-gray-800 whitespace-nowrap\">
            <button type=\"button\" class=\"js-open-details underline decoration-dotted text-left focus-visible:ring-2 focus-visible:ring-blue-500 rounded\" data-version=\"${r.version}\">v${r.version}</button>
            ${verrs.length ? `<span title=\\\"${AppState.getTranslation?.('release.invalid_entry') || 'Invalid entry'}\\\" class=\\\"ml-2 inline-block align-middle text-[10px] px-1.5 py-[1px] rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100\\\">!\u2009Schema</span>` : ''}
          </th>`);
        const searchTerm = (searchFilter?.value || '').trim();
        colOrder.forEach(k => {
          if (k==='date') tds.push(`<td data-key=\"date\" class=\"px-4 py-2 dark:text-gray-300 ${visible.date ? '' : 'hidden'}\"><div>${r.date || ''}</div><div class=\"text-[10px] opacity-70\">${formatTime(r)}</div></td>`);
          else if (k==='status') tds.push(`<td data-key=\"status\" class=\"px-4 py-2 ${visible.status ? '' : 'hidden'}\"><span class=\"inline-block px-2 py-1 rounded text-xs font-semibold ${statusClass}\">${r.status}</span></td>`);
          else if (k==='author') tds.push(`<td data-key=\"author\" class=\"px-4 py-2 dark:text-gray-300 ${visible.author ? '' : 'hidden'}\">${highlightText(r.author, searchTerm)}</td>`);
          else if (k==='modules') tds.push(`<td data-key=\"modules\" class=\"px-4 py-2 dark:text-gray-300 ${visible.modules ? '' : 'hidden'}\">${modNames.length ? modNames.map(n=>{ const h=[...n].reduce((a,c)=> (a*31 + c.charCodeAt(0))>>>0,0); const c=(h%8)+1; return `<button type=\\\"button\\\" class=\\\"js-mod-chip inline-flex items-center gap-1 text-[11px] px-2 py-[2px] rounded rm-chip-${c} hover:opacity-90 mr-1 mb-1\\\" data-mod=\\\"${n}\\\" title=\\\"${(AppState.getTranslation?.('release.filter_by') || 'Filter by')} ${n}\\\">${n}<span class=\\\"opacity-70 js-mod-ver\\\" data-mod=\\\"${n}\\\"></span></button>`; }).join('') : '—'}</td>`);
          else if (k==='description') tds.push(`<td data-key=\"description\" class=\"px-4 py-2 dark:text-gray-300 ${visible.description ? '' : 'hidden'} whitespace-nowrap overflow-hidden text-ellipsis\">${highlightText(desc, searchTerm)}</td>`);
        });
        tr.innerHTML = tds.join('');
        try {
          const btn = tr.querySelector('.js-open-details');
          if (btn) {
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', (ev) => {
              try { ev.preventDefault(); ev.stopPropagation(); } catch {}
              openDetails(r);
            }, { passive: true });
          }
        } catch {}
        return tr;
      };
      if (isVirtual) {
        // Windowed virtual scroll inside wrapper
        const wrapper = wrapEl;
        if (!wrapper) {
          rows.forEach(r => frag.appendChild(buildRow(r)));
          tableBody.appendChild(frag);
        } else {
          // Measure row height using a temp row
          const measure = () => {
            const tmp = buildRow(rowsAll[0]);
            tableBody.appendChild(tmp);
            const h = Math.max(1, Math.round(tmp.getBoundingClientRect().height) || 48);
            try { tmp.remove(); } catch {}
            return h;
          };
          let rowH = measure();
          const OVERSCAN = 8;
          let first = 0;
          const renderWindow = () => {
            const vh = wrapper.clientHeight || 400;
            const startIdx = Math.max(0, Math.floor((wrapper.scrollTop || 0) / rowH) - OVERSCAN);
            const visibleCount = Math.ceil(vh / rowH) + OVERSCAN * 2;
            const endIdx = Math.min(total, startIdx + visibleCount);
            first = startIdx;
            const topPad = startIdx * rowH;
            const botPad = (total - endIdx) * rowH;
            const local = document.createDocumentFragment();
            // Top spacer
            const topTr = document.createElement('tr');
            topTr.className = 'rm-spacer-row';
            const topTd = document.createElement('td'); topTd.colSpan = (1 + colOrder.length + 1); topTd.style.padding = '0'; topTd.style.border = '0'; topTd.style.height = topPad + 'px'; topTr.appendChild(topTd);
            local.appendChild(topTr);
            // Visible rows
            for (let i=startIdx; i<endIdx; i++) local.appendChild(buildRow(rowsAll[i]));
            // Bottom spacer
            const botTr = document.createElement('tr');
            botTr.className = 'rm-spacer-row';
            const botTd = document.createElement('td'); botTd.colSpan = (1 + colOrder.length + 1); botTd.style.padding = '0'; botTd.style.border = '0'; botTd.style.height = botPad + 'px'; botTr.appendChild(botTd);
            local.appendChild(botTr);
            tableBody.innerHTML = '';
            tableBody.appendChild(local);
            try { pageInfo.textContent = `${total ? (startIdx + 1) : 0}-${endIdx} / ${total}`; } catch {}
            // Adaptive row height: recompute average of rendered rows
            try {
              const rowsVis = Array.from(tableBody.querySelectorAll('tr:not(.rm-spacer-row)'));
              if (rowsVis.length) {
                const sum = rowsVis.reduce((s, r) => s + (r.getBoundingClientRect().height || 0), 0);
                const avg = Math.max(1, Math.round(sum / rowsVis.length));
                if (Math.abs(avg - rowH) > 1) { rowH = avg; renderWindow(); return; }
              }
            } catch {}
            // Hydrate module versions in window
            (async () => {
              try {
                const spans = Array.from(tableBody.querySelectorAll('.js-mod-ver'));
                const names = Array.from(new Set(spans.map(el => el.getAttribute('data-mod')).filter(Boolean)));
                const versions = new Map();
                await Promise.all(names.map(async (n) => { const v = await getModuleVersion(n); if (v) versions.set(n, v); }));
                spans.forEach(el => { const name = el.getAttribute('data-mod'); const v = versions.get(name); if (v) el.textContent = ' v' + v; });
              } catch {}
            })();
          };
          renderWindow(); updateStickyOffsets();
          const onScroll = () => renderWindow();
          const onResize = () => { rowH = measure(); renderWindow(); };
          wrapper.addEventListener('scroll', onScroll, { passive: true });
          window.addEventListener('resize', onResize);
          wrapper.__rmVirtCleanup = () => { try { wrapper.removeEventListener('scroll', onScroll); } catch {} try { window.removeEventListener('resize', onResize); } catch {} };
        }
      } else {
        rows.forEach(r => frag.appendChild(buildRow(r)));
        tableBody.appendChild(frag);
        updateStickyOffsets();
      }
      applyColWidths();
      try { tableEl?.removeAttribute('aria-busy'); } catch {}
      // hydrate module versions async (batched)
      (async () => {
        const spans = Array.from(tableBody.querySelectorAll('.js-mod-ver'));
        const names = Array.from(new Set(spans.map(el => el.getAttribute('data-mod')).filter(Boolean)));
        const versions = new Map();
        await Promise.all(names.map(async (n) => { const v = await getModuleVersion(n); if (v) versions.set(n, v); }));
        spans.forEach(el => { const name = el.getAttribute('data-mod'); const v = versions.get(name); if (v) el.textContent = ' v' + v; });
      })();
      // 🧮 Bilgi kutuları güncelle
      if (releaseCount && stableCount && latestVersion) {
        releaseCount.textContent = data.length;
        stableCount.textContent = data.filter(r => r.status === 'Stable').length;
        if (data.length) {
          const sorted = [...data].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          latestVersion.textContent = sorted[0]?.version || '-';
        } else {
          latestVersion.textContent = '-';
        }
      }
      // Keyboard default focus on first row when (re)rendered
      try {
        const rowsNow = Array.from(tableBody.querySelectorAll('tr')).filter(r=>!r.classList.contains('rm-inline-details'));
        if (rowsNow.length) { rowsNow[0].setAttribute('tabindex','0'); rowsNow[0].classList.add('rm-row-selected'); rowsNow[0].focus(); }
      } catch {}
    }

    // Module chip filters (toggle set)
    const moduleFilter = new Set();
    const loadModFilter = () => { try { return JSON.parse(localStorage.getItem('RM_ModFilter')||'[]'); } catch { return []; } };
    const saveModFilter = () => { try { localStorage.setItem('RM_ModFilter', JSON.stringify(Array.from(moduleFilter))); } catch {} };
    const activeModsBar = document.createElement('div');
    activeModsBar.className = 'mb-3 flex flex-wrap gap-2 text-xs';
    activeModsBar.setAttribute('aria-live','polite');
    target.querySelector('form#filterForm')?.after(activeModsBar);
    function renderActiveMods(){
      activeModsBar.innerHTML = '';
      if (!moduleFilter.size) return;
      const badge = (name)=>{
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 hover:opacity-90';
        el.textContent = `mod:${name} ✕`;
        el.addEventListener('click', ()=>{ moduleFilter.delete(name); saveModFilter(); renderActiveMods(); renderRows(filterData()); });
        return el;
      };
      moduleFilter.forEach(m=> activeModsBar.appendChild(badge(m)));
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:opacity-90';
      clear.textContent = AppState.getTranslation?.('release.clear_modules') || 'Clear modules';
      clear.addEventListener('click', ()=>{ moduleFilter.clear(); saveModFilter(); renderActiveMods(); renderRows(filterData()); updateFilterBadge(); });
      activeModsBar.appendChild(clear);
    }
    tableBody.addEventListener('click', (e) => {
      const chip = e.target.closest && e.target.closest('.js-mod-chip');
      if (!chip) return;
      const name = chip.getAttribute('data-mod');
      if (moduleFilter.has(name)) moduleFilter.delete(name); else moduleFilter.add(name);
      saveModFilter();
      renderActiveMods();
      renderRows(filterData());
      updateFilterBadge();
      try{ window.Telemetry?.log('rm_mod_filter', Array.from(moduleFilter)); }catch{}
    });
    // Load persisted module filter on init
    try {
      const savedMods = loadModFilter();
      if (Array.isArray(savedMods) && savedMods.length) {
        savedMods.forEach(m => moduleFilter.add(m));
        renderActiveMods();
        renderRows(filterData());
        updateFilterBadge();
      }
    } catch {}

    function filterData() {
      const v = versionFilter.value.trim();
      const df = fromDate?.value || '';
      const dt = toDate?.value || '';
      const s = statusFilter.value.trim();
      const a = authorFilter.value.trim();
      const search = searchFilter.value.trim().toLowerCase();
      const msel = moduleSelect && moduleSelect.value ? new Set([moduleSelect.value]) : null;
      const mset = moduleFilter.size ? moduleFilter : msel;

      return releases.filter(r => {
        const desc = resolveDesc(r).toLowerCase();
        const matchVersion = !v || r.version === v;
        const rd = r.date || '';
        const matchDate = (!df || (rd >= df)) && (!dt || (rd <= dt));
        const matchStatus = !s || r.status === s;
        const matchAuthor = !a || r.author === a;
        const matchModules = !mset || computeReleaseModules(r).some(x => mset.has(x));
        const matchSearch =
          !search ||
          (desc && desc.includes(search)) ||
          (r.version && r.version.toLowerCase().includes(search)) ||
          (r.author && r.author.toLowerCase().includes(search)) ||
          (r.status && r.status.toLowerCase().includes(search));
        const matchFiles = !filterFilesOnly || (Array.isArray(r._files) && r._files.length>0);
        return matchVersion && matchDate && matchStatus && matchAuthor && matchModules && matchSearch && matchFiles;
      });
    }

    function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; }
    // Filtre rozeti (mobil buton) güncelle
    function updateFilterBadge(){
      if (!toggleFiltersBtn) return;
      const label = AppState.getTranslation?.('release.filter_by') || 'Filters';
      const hasDate = !!(fromDate?.value || toDate?.value);
      let count = 0;
      if (versionFilter?.value) count++;
      if (hasDate) count++;
      if (statusFilter?.value) count++;
      if (authorFilter?.value) count++;
      if (moduleSelect?.value) count++;
      if (moduleFilter.size) count++;
      if (searchFilter?.value) count++;
      const activeFiltersLbl = AppState.getTranslation?.('release.active_filters') || 'active filters';
      toggleFiltersBtn.innerHTML = count ? `${label} <span class="rm-badge" aria-label="${count} ${activeFiltersLbl}">${count}</span>` : label;
    }
    const onFilterChange = debounce(() => { renderRows(filterData()); updateFilterBadge(); if (autoLink) encodeStateToHash(); }, 200);

    // Quick filters events
    qfStable?.addEventListener('click', () => {
      try { statusFilter.value = 'Stable'; } catch {}
      onFilterChange();
    });
    qfLast30?.addEventListener('click', () => {
      try {
        const now = new Date();
        const day = 24*60*60*1000;
        const start = new Date(now - 30*day).toISOString().slice(0,10);
        if (fromDate) fromDate.value = start;
        if (toDate) toDate.value = '';
      } catch {}
      onFilterChange();
    });
    qfFilesOnly?.addEventListener('change', () => {
      filterFilesOnly = !!qfFilesOnly.checked;
      onFilterChange();
    });

    [versionFilter, fromDate, toDate, statusFilter, authorFilter, searchFilter, moduleSelect].filter(Boolean).forEach(el => {
      el.addEventListener('input', onFilterChange);
    });
    // Empty state reset button
    target.querySelector('#noResReset')?.addEventListener('click', () => resetBtn?.click());
    // Empty state suggestions
    target.querySelector('#noResSuggestStable')?.addEventListener('click', () => { try { statusFilter.value='Stable'; } catch {} onFilterChange(); });
    target.querySelector('#noResSuggest30')?.addEventListener('click', () => { try { const now=new Date(); const day=24*60*60*1000; const start=new Date(now-30*day).toISOString().slice(0,10); if (fromDate) fromDate.value=start; if (toDate) toDate.value=''; } catch {} onFilterChange(); });

    resetBtn.addEventListener('click', () => {
      versionFilter.value = '';
      if (fromDate) fromDate.value = '';
      if (toDate) toDate.value = '';
      statusFilter.value = '';
      authorFilter.value = '';
      if (moduleSelect) moduleSelect.value = '';
      searchFilter.value = '';
      // also clear active module chips
      try { moduleFilter.clear(); renderActiveMods(); } catch {}
      renderRows(releases);
      if (window.updateMainMargin) window.updateMainMargin();
      updateFilterBadge();
    });

    renderRows(releases);
    updateFilterBadge();

    // Actions popover toggle
    if (actionMenuBtn && actionPopover) {
      const caret = target.querySelector('#actionCaret');
      const setExpanded = (val) => { actionMenuBtn.setAttribute('aria-expanded', String(val)); };
      let lastTrigger = actionMenuBtn;
      const ensurePortal = () => {
        // Do NOT move popover to body; keep it as absolute under its relative wrapper.
        // Only ensure a backdrop exists (optional).
        if (!document.getElementById('actionBackdrop')){
          const bd = document.createElement('div');
          bd.id = 'actionBackdrop';
          bd.className = 'hidden fixed inset-0 z-[1999] bg-black/20 dark:bg-black/50 backdrop-blur-[2px] opacity-0 transition-opacity duration-100';
          document.body.appendChild(bd);
        }
      };
      const getBackdrop = () => document.getElementById('actionBackdrop');
      const positionPop = () => { /* CSS-only absolute positioning under trigger */ };
      const openPop = () => {
        ensurePortal();
        const bd=getBackdrop();
        if (bd){
          bd.classList.remove('hidden');
          requestAnimationFrame(()=>{ bd.classList.add('opacity-100'); bd.classList.remove('opacity-0'); });
          bd.onclick = ()=> closePop();
        }
        actionPopover.classList.remove('hidden');
        positionPop();
        requestAnimationFrame(()=>{ actionPopover.classList.remove('opacity-0'); actionPopover.classList.add('opacity-100'); });
        actionMenuBtn.classList.add('bg-gray-50','text-gray-900','ring-blue-500');
        caret && caret.classList.add('rotate-180');
        setExpanded(true);
      };
      const closePop = () => {
        const bd=getBackdrop();
        if (bd){ bd.classList.remove('opacity-100'); bd.classList.add('opacity-0'); setTimeout(()=>{ bd.classList.add('hidden'); },120);} 
        actionPopover.classList.add('opacity-0');
        actionPopover.classList.remove('opacity-100');
        setTimeout(()=>{ actionPopover.classList.add('hidden'); }, 120);
        actionMenuBtn.classList.remove('bg-gray-50','text-gray-900','ring-blue-500');
        caret && caret.classList.remove('rotate-180');
        setExpanded(false);
        try { lastTrigger && lastTrigger.focus && lastTrigger.focus(); } catch {}
      };
      const togglePop = () => { if (actionPopover.classList.contains('hidden')) openPop(); else closePop(); };
      const trigger = (e) => { e.preventDefault(); e.stopPropagation(); lastTrigger = e?.currentTarget || actionMenuBtn; togglePop(); };
      actionMenuBtn.addEventListener('click', trigger);
      actionMenuBtnMain?.addEventListener('click', trigger);
      document.addEventListener('click', (e) => {
        if (actionPopover.classList.contains('hidden')) return;
        const inside = actionPopover.contains(e.target) || actionMenuBtn.contains(e.target);
        if (!inside) closePop();
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
      // Keyboard navigation for menu items
      const items = () => Array.from(actionPopover.querySelectorAll('[role="menuitem"]')).filter(el => !el.classList.contains('hidden'));
      const focusItem = (idx) => { const arr = items(); if (!arr.length) return; const i = (idx+arr.length)%arr.length; arr[i].focus(); actionPopover.dataset.focus = String(i); };
      actionMenuBtn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown'){ e.preventDefault(); openPop(); focusItem(0); }
      });
      actionPopover.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown'){ e.preventDefault(); focusItem(Number(actionPopover.dataset.focus||0)+1); }
        else if (e.key === 'ArrowUp'){ e.preventDefault(); focusItem(Number(actionPopover.dataset.focus||0)-1); }
        else if (e.key === 'Home'){ e.preventDefault(); focusItem(0); }
        else if (e.key === 'End'){ e.preventDefault(); const arr=items(); focusItem(arr.length-1); }
      });
      // No scroll/resize reposition to avoid layout thrash; menu is absolutely positioned under its trigger
    }

    // Density toggle (Standard / Compact)
    const DENSITY_KEY = 'RM_Density';
    const applyDensity = (mode) => {
      const t = document.getElementById('dataTable');
      if (!t) return;
      t.classList.remove('rm-density-compact','rm-density-comfortable');
      if (mode === 'compact') t.classList.add('rm-density-compact');
      else if (mode === 'comfortable') t.classList.add('rm-density-comfortable');
    };
    try { applyDensity(localStorage.getItem(DENSITY_KEY) || 'standard'); } catch {}
    const densityStdBtn = target.querySelector('#densityStdBtn');
    const densityCmpBtn = target.querySelector('#densityCmpBtn');
    const densityComfBtn = target.querySelector('#densityComfBtn');
    densityStdBtn?.addEventListener('click', ()=>{ try{ localStorage.setItem(DENSITY_KEY,'standard'); }catch{} applyDensity('standard'); });
    densityCmpBtn?.addEventListener('click', ()=>{ try{ localStorage.setItem(DENSITY_KEY,'compact'); }catch{} applyDensity('compact'); });
    densityComfBtn?.addEventListener('click', ()=>{ try{ localStorage.setItem(DENSITY_KEY,'comfortable'); }catch{} applyDensity('comfortable'); });

    // Click-to-sort on headers
    const bindSort = (th, key) => {
      th.setAttribute('tabindex', '0');
      th.setAttribute('role', 'button');
      th.classList.add('cursor-pointer');
      const toggle = () => {
        if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        else { sortState.key = key; sortState.dir = 'desc'; }
        renderRows(filterData());
        try { bindSortHeaders(); } catch {}
      };
      th.addEventListener('click', toggle);
      th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    };
    function bindSortHeaders(){
      headerCells = Array.from(theadRow.querySelectorAll('th'));
      const map = new Map(headerCells.map(th=>[th.dataset.key, th]));
      const thVersion = map.get('version');
      if (thVersion) bindSort(thVersion, 'version');
      ['date','status','author'].forEach(k=>{ const th=map.get(k); if (th) bindSort(th, k); });
      // update sort icons: only active column shows direction
      const keys = ['version', ...colOrder];
      headerCells.forEach((th, idx) => {
        const k = keys[idx];
        const ico = th.querySelector('.sort-ico');
        if (!ico) return;
        if (sortState.key === k && k !== 'description') {
          ico.textContent = sortState.dir === 'asc' ? '↑' : '↓';
          ico.classList.remove('opacity-40', 'invisible');
        } else {
          ico.textContent = '';
          ico.classList.add('invisible');
          ico.classList.remove('opacity-40');
        }
      });
      // update aria-sort attributes for accessibility
      const sortable = new Set(['version','date','status','author']);
      headerCells.forEach((th) => {
        const k = th.dataset.key;
        if (!k || !sortable.has(k)) { try { th.removeAttribute('aria-sort'); } catch {} return; }
        if (sortState.key === k) { th.setAttribute('aria-sort', sortState.dir === 'asc' ? 'ascending' : 'descending'); }
        else { th.setAttribute('aria-sort', 'none'); }
      });
      initColMenu();
    }
    bindSortHeaders();

    // Bilgi kutuları ilk yüklemede de güncellensin
    if (releaseCount && stableCount && latestVersion) {
      releaseCount.textContent = releases.length;
      stableCount.textContent = releases.filter(r => r.status === 'Stable').length;
      if (releases.length) {
        const sorted = [...releases].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        latestVersion.textContent = sorted[0]?.version || '-';
      } else {
        latestVersion.textContent = '-';
      }
      // 7-gün trendi
      try {
        const now = new Date();
        const day = 24*60*60*1000;
        const start = new Date(now - 7*day).toISOString().slice(0,10);
        const prevStart = new Date(now - 14*day).toISOString().slice(0,10);
        const prevEnd = new Date(now - 7*day).toISOString().slice(0,10);
        const inRange = (d,s,e) => d>=s && d<e;
        const cur = releases.filter(r=> inRange(String(r.date||'').slice(0,10), start, now.toISOString().slice(0,10)) ).length;
        const prv = releases.filter(r=> inRange(String(r.date||'').slice(0,10), prevStart, prevEnd) ).length;
        const pct = prv===0 ? (cur>0?100:0) : Math.round(((cur-prv)/prv)*100);
        const el = document.getElementById('releaseTrend');
        if (el) { const up = pct>=0; el.innerHTML = `${up?'▲':'▼'} ${up?`+${pct}%`:`${pct}%`}`; el.className = up ? 'rm-trend-up' : 'rm-trend-down'; }
        const curS = releases.filter(r=> r.status==='Stable' && inRange(String(r.date||'').slice(0,10), start, now.toISOString().slice(0,10))).length;
        const prvS = releases.filter(r=> r.status==='Stable' && inRange(String(r.date||'').slice(0,10), prevStart, prevEnd)).length;
        const pctS = prvS===0 ? (curS>0?100:0) : Math.round(((curS-prvS)/prvS)*100);
        const elS = document.getElementById('stableTrend');
        if (elS) { const upS = pctS>=0; elS.innerHTML = `${upS?'▲':'▼'} ${upS?`+${pctS}%`:`${pctS}%`}`; elS.className = upS ? 'rm-trend-up' : 'rm-trend-down'; }
      } catch {}
    }

    // 📤 CSV Export
    if (exportBtn) {
      try { exportBtn.setAttribute('title', AppState.getTranslation?.('release.export_csv') || 'Export CSV'); } catch {}
      exportBtn.addEventListener('click', () => {
        // Export filtrelenmiş ve sıralanmış veriler
        const data = applySort(filterData());
        const fieldsOrder = ['version','date','status','author','modules','description'];
        const visibleFields = exportVisibleOnly
          ? fieldsOrder.filter(k => k==='version' ? true : (k==='modules' ? (visible.modules!==false) : (visible[k]!==false)))
          : ['version','date','status','author','description'];
        const headerLabels = {
          version: AppState.getTranslation?.('release.version') || 'Version',
          date: AppState.getTranslation?.('release.date') || 'Date',
          status: AppState.getTranslation?.('release.status') || 'Status',
          author: AppState.getTranslation?.('release.author') || 'Author',
          modules: AppState.getTranslation?.('release.modules') || 'Modules',
          description: AppState.getTranslation?.('release.description') || 'Description'
        };
        const csvHeader = visibleFields.map(k => headerLabels[k]).join(',');
        const meta = []; try {
          if (versionFilter?.value) meta.push(`# version: ${versionFilter.value}`);
          const df = fromDate?.value || '', dt = toDate?.value || '';
          if (df||dt) meta.push(`# date: ${df||'..'}..${dt||'..'}`);
          if (statusFilter?.value) meta.push(`# status: ${statusFilter.value}`);
          if (authorFilter?.value) meta.push(`# author: ${authorFilter.value}`);
          if (moduleSelect?.value) meta.push(`# module: ${moduleSelect.value}`);
          const cols = Object.entries(visible).filter(([,v])=>v).map(([k])=>k).join(', ');
          if (cols) meta.push(`# columns: ${cols}`);
        } catch {}
        const csvRows = data.map(r => {
          const desc = resolveDesc(r);
          const mods = computeReleaseModules(r).join(' ');
          const rowObj = { version: r.version, date: r.date, status: r.status, author: r.author, modules: mods, description: desc };
          const fields = visibleFields.map(k => csvQuote(csvSafe(rowObj[k] ?? '')));
          return fields.join(',');
        });
        const bom = '\ufeff';
        const header = (meta && meta.length) ? (meta.join('\n') + '\n') : '';
        const blob = new Blob([bom + header + csvHeader + "\n" + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "release-log.csv";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 100);
        try { window.Telemetry?.log('rm_export', { type: 'csv', count: data.length }); } catch {}
      });
    }
    // Copy CSV to clipboard (visible/filtered)
    try {
      const copyCsv = document.getElementById('copyCsvBtn');
      copyCsv?.addEventListener('click', () => {
        try {
          const data = applySort(filterData());
          const fieldsOrder = ['version','date','status','author','modules','description'];
          const visibleFields = exportVisibleOnly
            ? fieldsOrder.filter(k => k==='version' ? true : (k==='modules' ? (visible.modules!==false) : (visible[k]!==false)))
            : ['version','date','status','author','description'];
          const headerLabels = { version: AppState.getTranslation?.('release.version')||'Version', date: AppState.getTranslation?.('release.date')||'Date', status: AppState.getTranslation?.('release.status')||'Status', author: AppState.getTranslation?.('release.author')||'Author', modules: AppState.getTranslation?.('release.modules')||'Modules', description: AppState.getTranslation?.('release.description')||'Description' };
          const header = visibleFields.map(k => headerLabels[k]).join(',');
          const rows = data.map(r => {
            const desc = resolveDesc(r);
            const mods = computeReleaseModules(r).join(' ');
            const rowObj = { version: r.version, date: r.date, status: r.status, author: r.author, modules: mods, description: desc };
            return visibleFields.map(k => csvQuote(csvSafe(rowObj[k] ?? ''))).join(',');
          });
          const text = header + '\n' + rows.join('\n');
          navigator.clipboard?.writeText(text);
          Toast?.show?.(AppState.getTranslation?.('release.copied') || 'Copied');
        } catch {}
      });
    } catch {}

    // Export JSON (filtered + sorted)
    if (exportJsonBtn) {
      try { exportJsonBtn.setAttribute('title', AppState.getTranslation?.('release.export_json') || 'Export JSON'); } catch {}
      exportJsonBtn.addEventListener('click', () => {
        const arr = applySort(filterData());
        let data = arr;
        if (exportVisibleOnly) {
          const pick = (r) => {
            const obj = { version: r.version };
            if (visible.date !== false) obj.date = r.date;
            if (visible.status !== false) obj.status = r.status;
            if (visible.author !== false) obj.author = r.author;
            if (visible.modules !== false) {
              const mods = computeReleaseModules(r);
              if (mods && mods.length) obj.modules = mods;
            }
            if (visible.description !== false) obj.description = r.description;
            return obj;
          };
          data = arr.map(pick);
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = exportVisibleOnly ? 'release-log.visible.json' : 'release-log.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
        try { window.Telemetry?.log('rm_export', { type: exportVisibleOnly?'json-visible':'json', count: arr.length }); } catch {}
      });
    }
    // Export Meta (filters + columns + counts)
    if (exportMetaBtn) {
      exportMetaBtn.addEventListener('click', () => {
        try {
          const filtered = filterData();
          const meta = {
            generatedAt: new Date().toISOString(),
            total: releases.length,
            filtered: filtered.length,
            filters: {
              version: versionFilter?.value || '',
              dateFrom: fromDate?.value || '',
              dateTo: toDate?.value || '',
              status: statusFilter?.value || '',
              author: authorFilter?.value || '',
              module: moduleSelect?.value || '',
              modulesActive: Array.from(moduleFilter)
            },
            columns: { ...visible },
            sort: { ...sortState },
            pageSize,
            exportVisibleOnly: !!exportVisibleOnly,
            freezes: { date: !!freezeDate, status: !!freezeStatus, author: !!freezeAuthor, modules: !!freezeModules },
            goDirection
          };
          const blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'release-meta.json';
          document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a), 100);
        } catch {}
      });
    }

    // Export Markdown (filtered + sorted)
    const toMd = (arr) => {
      const lines = ['# Changelog', ''];
      try {
        const meta = [];
        if (versionFilter?.value) meta.push(`version: ${versionFilter.value}`);
        const df = fromDate?.value || '', dt = toDate?.value || '';
        if (df||dt) meta.push(`date: ${df||'..'}..${dt||'..'}`);
        if (statusFilter?.value) meta.push(`status: ${statusFilter.value}`);
        if (authorFilter?.value) meta.push(`author: ${authorFilter.value}`);
        if (moduleSelect?.value) meta.push(`module: ${moduleSelect.value}`);
        const cols = Object.entries(visible).filter(([,v])=>v).map(([k])=>k).join(', ');
        if (cols) meta.push(`columns: ${cols}`);
        if (meta.length) { lines.push('> ' + meta.join(' • ')); lines.push(''); }
      } catch {}
      const showDate = !exportVisibleOnly || visible.date !== false;
      const showStatus = !exportVisibleOnly || visible.status !== false;
      const showAuthor = !exportVisibleOnly || visible.author !== false;
      const showModules = !exportVisibleOnly || visible.modules !== false;
      arr.forEach(r => {
        const desc = resolveDesc(r);
        const titleBits = [`v${r.version}`];
        if (showDate) titleBits.push(r.date);
        if (showStatus) titleBits.push(`(${r.status})`);
        lines.push(`## ${titleBits.filter(Boolean).join(' - ')}`);
        if (showAuthor) lines.push(`- Author: ${r.author}`);
        if (showModules) {
          const mods = computeReleaseModules(r);
          if (mods.length) lines.push(`- Modules: ${mods.join(', ')}`);
        }
        if (desc) lines.push(`- ${desc}`);
        lines.push('');
      });
      return lines.join('\n');
    };
    if (exportMdBtn) {
      try { exportMdBtn.setAttribute('title', AppState.getTranslation?.('release.export_md') || 'Export Markdown'); } catch {}
      exportMdBtn.addEventListener('click', () => {
        const data = applySort(filterData());
        const blob = new Blob([toMd(data)], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'CHANGELOG.md';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
        try { window.Telemetry?.log('rm_export', { type: 'md', count: data.length }); } catch {}
      });
    }
    // Copy Markdown to clipboard (visible/filtered)
    try {
      const copyMd = document.getElementById('copyMdBtnClip');
      copyMd?.addEventListener('click', () => {
        try {
          const data = applySort(filterData());
          const text = toMd(data);
          navigator.clipboard?.writeText(text);
          Toast?.show?.(AppState.getTranslation?.('release.copied') || 'Copied');
        } catch {}
      });
    } catch {}

    // Export Public Markdown (uses descriptionPublic)
    const toMdPublic = (arr) => {
      const lang = (AppState.language||'en').split('-')[0];
      const lines = ['# Release Notes (Public)', ''];
      try {
        const meta = [];
        if (versionFilter?.value) meta.push(`version: ${versionFilter.value}`);
        const df = fromDate?.value || '', dt = toDate?.value || '';
        if (df||dt) meta.push(`date: ${df||'..'}..${dt||'..'}`);
        if (statusFilter?.value) meta.push(`status: ${statusFilter.value}`);
        if (authorFilter?.value) meta.push(`author: ${authorFilter.value}`);
        if (moduleSelect?.value) meta.push(`module: ${moduleSelect.value}`);
        const cols = Object.entries(visible).filter(([,v])=>v).map(([k])=>k).join(', ');
        if (cols) meta.push(`columns: ${cols}`);
        if (meta.length) { lines.push('> ' + meta.join(' • ')); lines.push(''); }
      } catch {}
      const showDate = !exportVisibleOnly || visible.date !== false;
      const showStatus = !exportVisibleOnly || visible.status !== false;
      const showAuthor = !exportVisibleOnly || visible.author !== false;
      const showModules = !exportVisibleOnly || visible.modules !== false;
      arr.forEach(r => {
        const desc = (r.descriptionPublic && (r.descriptionPublic[lang] || r.descriptionPublic.en)) || resolveDesc(r);
        const titleBits = [`v${r.version}`];
        if (showDate) titleBits.push(r.date);
        if (showStatus) titleBits.push(`(${r.status})`);
        lines.push(`## ${titleBits.filter(Boolean).join(' - ')}`);
        if (r.impact || r.risk) {
          const tags = [r.impact?`impact:${r.impact}`:'', r.risk?`risk:${r.risk}`:''].filter(Boolean).join(' ');
          if (tags) lines.push(`- ${tags}`);
        }
        if (showAuthor) lines.push(`- Author: ${r.author}`);
        if (showModules) {
          const mods = computeReleaseModules(r);
          if (mods.length) lines.push(`- Modules: ${mods.join(', ')}`);
        }
        if (desc) lines.push(desc);
        lines.push('');
      });
      return lines.join('\n');
    };
    if (exportMdPublicBtn) {
      try { exportMdPublicBtn.setAttribute('title', 'Export Public Release Notes'); } catch {}
      exportMdPublicBtn.addEventListener('click', () => {
        const data = applySort(filterData());
        const blob = new Blob([toMdPublic(data)], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'RELEASE_NOTES.md';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
        try { window.Telemetry?.log('rm_export', { type: 'md-public', count: data.length }); } catch {}
      });
    }

    // Details drawer
    const findRelease = (version) => releases.find(r => String(r.version) === String(version));
    let _prevFocus = null;

    // Inline details (mobile-first)
    function closeInlineDetails(){
      try { tableBody?.querySelectorAll('tr.rm-inline-details')?.forEach(r => r.remove()); } catch {}
    }
    function openInlineDetails(rel, anchorTr){
      if (!rel || !anchorTr) return;
      // Toggle behavior: if already open for this row, close it
      const next = anchorTr.nextElementSibling;
      if (next && next.classList && next.classList.contains('rm-inline-details')) { next.remove(); return; }
      // Only one inline at a time
      closeInlineDetails();
      const tr = document.createElement('tr');
      tr.className = 'rm-inline-details';
      const td = document.createElement('td');
      const span = Array.isArray(headerCells) ? headerCells.length : (1 + (Array.isArray(colOrder)?colOrder.length:4));
      td.setAttribute('colspan', String(span));
      const desc = resolveDesc(rel);
      const errs = validateRelease(rel);
      // Previous release for mini diff
      function getPrevRelease(cur){
        try {
          const sorted = [...releases].sort((a,b)=> compareVersion(b.version, a.version));
          const idx = sorted.findIndex(x => String(x.version) === String(cur.version));
          return idx >= 0 ? sorted[idx+1] : null;
        } catch { return null; }
      }
      const prev = getPrevRelease(rel);
      const prevDesc = prev ? resolveDesc(prev) : '';
      let diffBlock = '';
      if (prev && prevDesc && prevDesc !== desc) {
        try {
          const { aHtml, bHtml } = diffHighlight(prevDesc, desc);
          const accId = `acc-desc-${String(rel.version).replace(/[^a-z0-9_\-]/gi,'_')}`;
          diffBlock = `
            <div class="rm-acc" data-acc="desc">
              <button type="button" class="rm-acc-header" aria-expanded="false" aria-controls="${accId}">${AppState.getTranslation?.('release.compare') || 'Compare'} — ${AppState.getTranslation?.('release.description') || 'Description'}</button>
              <div id="${accId}" class="rm-acc-body">
                <div class="rm-collapsible rm-collapsed" data-collapsible="desc">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="text-sm p-2 rounded bg-gray-50 dark:bg-gray-800"><div class="opacity-60 mb-1">Before</div>${aHtml}</div>
                    <div class="text-sm p-2 rounded bg-gray-50 dark:bg-gray-800"><div class="opacity-60 mb-1">After</div>${bHtml}</div>
                  </div>
                </div>
                <button type="button" class="rm-collapser" data-target="desc">Show more</button>
              </div>
            </div>`;
        } catch {}
      }
      // Files accordion (grouped)
      let filesBlock = '';
      try {
        const html = renderFiles(rel);
        const c = (function(){ try { const g = countFiles(rel); return g; } catch { return {added:0,modified:0,removed:0}; } })();
        const accIdF = `acc-files-${String(rel.version).replace(/[^a-z0-9_\-]/gi,'_')}`;
        if (html && html.trim()) {
          filesBlock = `
            <div class="rm-acc" data-acc="files">
              <button type="button" class="rm-acc-header" aria-expanded="false" aria-controls="${accIdF}">
                ${AppState.getTranslation?.('release.files') || 'Files'}
                <span class="rm-pills">
                  <span class="rm-pill rm-pill-add">+${c.added||0}</span>
                  <span class="rm-pill rm-pill-mod">~${c.modified||0}</span>
                  <span class="rm-pill rm-pill-del">-${c.removed||0}</span>
                </span>
              </button>
              <div id="${accIdF}" class="rm-acc-body">${html}</div>
            </div>`;
        }
      } catch {}
      td.innerHTML = `
        <div class="rm-inline-card">
          <div class="rm-inline-head">
            <strong>v${rel.version}</strong>
            <span>${rel.date || ''}</span>
            <span>${rel.status || ''}</span>
            <button type="button" class="rm-inline-close" aria-label="Close">×</button>
          </div>
          <div class="rm-inline-body">
            <div class="rm-inline-row"><span>Author:</span> ${rel.author || '-'}</div>
            <div class="rm-inline-row"><span>${AppState.getTranslation?.('release.description') || 'Description'}:</span> ${escapeHtml(desc || '-')}</div>
            ${errs.length ? `<div class=\"rm-inline-warn\">Schema: ${errs.join(', ')}</div>` : ''}
          </div>
          ${diffBlock}
          ${filesBlock}
          <div class="rm-inline-actions">
            <button type="button" class="js-inline-copy-json">JSON</button>
            <button type="button" class="js-inline-copy-md">MD</button>
            <button type="button" class="js-inline-copy-txt">TXT</button>
          </div>
        </div>`;
      tr.appendChild(td);
      anchorTr.after(tr);
      // Bind actions
      td.querySelector('.rm-inline-close')?.addEventListener('click', () => tr.remove());
      td.querySelector('.js-inline-copy-json')?.addEventListener('click', () => {
        try { navigator.clipboard?.writeText(JSON.stringify(rel, null, 2)); Toast?.show?.('Copied'); } catch {}
      });
      td.querySelector('.js-inline-copy-md')?.addEventListener('click', () => {
        try {
          const d = resolveDesc(rel);
          const md = `## v${rel.version} - ${rel.date||'-'} (${rel.status||'-'})\n- Author: ${rel.author||'-'}\n- ${d||''}\n`;
          navigator.clipboard?.writeText(md); Toast?.show?.('Copied');
        } catch {}
      });
      td.querySelector('.js-inline-copy-txt')?.addEventListener('click', () => {
        try {
          const d = resolveDesc(rel);
          const text = `v${rel.version} — ${rel.date||'-'} — ${rel.status||'-'}\n${d||''}`;
          navigator.clipboard?.writeText(text); Toast?.show?.('Copied');
        } catch {}
      });
      // Accordion toggle
      td.querySelectorAll('.rm-acc').forEach(acc => {
        const head = acc.querySelector('.rm-acc-header');
        const body = acc.querySelector('.rm-acc-body');
        head?.addEventListener('click', () => {
          const open = acc.classList.toggle('rm-open');
          try { head.setAttribute('aria-expanded', String(open)); } catch {}
          if (body && head && head.getAttribute('aria-controls')) {
            // no-op; just keeping attributes consistent
          }
        });
      });
      // Collapser for long diff blocks
      td.querySelectorAll('.rm-collapser').forEach(btn => {
        const t = btn.getAttribute('data-target');
        const wrap = t ? td.querySelector(`.rm-collapsible[data-collapsible="${t}"]`) : null;
        const setTxt = () => { btn.textContent = (wrap && wrap.classList.contains('rm-expanded')) ? 'Show less' : 'Show more'; };
        btn.addEventListener('click', () => { if (!wrap) return; wrap.classList.toggle('rm-expanded'); setTxt(); });
        // Hide button if not overflowing
        try { if (!wrap || wrap.scrollHeight <= 220) btn.style.display = 'none'; } catch {}
        setTxt();
      });
    }
    function ensureDetails() {
      let d = document.getElementById('releaseDetails');
      if (!d) {
        // Create if missing
        d = document.createElement('div');
        d.id = 'releaseDetails';
        d.className = 'hidden fixed inset-0 z-[2000] flex items-center justify-center p-4';
        d.innerHTML = `
          <div class="absolute inset-0 bg-black/40" data-close="backdrop" aria-hidden="true"></div>
          <div class="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[95%] max-w-[840px] max-h-[80vh] overflow-y-auto p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 id="rmDetailsTitle" class="text-lg font-semibold text-gray-800 dark:text-gray-100">${AppState.getTranslation?.('release.details') || 'Details'}</h2>
              <button id="detailsClose" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.close') || 'Close'}</button>
            </div>
            <div id="detailsBody" class="text-sm text-gray-700 dark:text-gray-200"></div>
          </div>`;
        try { document.body.appendChild(d); } catch {}
      }
      return d;
    }
    const setHashParam = (key, val) => {
      try {
        const h = location.hash || '';
        const route = (h.replace(/^#/, '').split('?')[0] || '/');
        const sp = new URLSearchParams(h.includes('?') ? h.split('?')[1] : '');
        if (val == null || val === '') sp.delete(key); else sp.set(key, String(val));
        const qs = sp.toString();
        const nh = '#' + route + (qs ? ('?' + qs) : '');
        (window.history && window.history.replaceState) ? window.history.replaceState(null, '', nh) : (location.hash = nh.replace(/^#/, ''));
      } catch {}
    };
    const openDetails = (rel) => {
      if (!rel) return;
      const details = ensureDetails();
      const detailsBody = details.querySelector('#detailsBody');
      const detailsClose = details.querySelector('#detailsClose');
      const desc = resolveDesc(rel);
      const errs = validateRelease(rel);
      // Categories and counts
      const cats = (Array.isArray(rel.categories) && rel.categories.length) ? rel.categories : (()=>{
        const arr = Array.isArray(rel?._files) ? rel._files : [];
        const map = new Map();
        arr.forEach(line => { const p=(String(line).split(':',2)[1]||'').trim();
          const k = p.includes('core.footer') ? 'ui_footer' : p.includes('core.header') ? 'ui_header' : p.includes('core.sidebar') ? 'ui_sidebar' : p.startsWith('modules/ReleaseManagement') ? 'release_mgmt' : p.startsWith('locales/') ? 'i18n' : p.startsWith('scripts/') ? 'automation' : p === 'sw.js' ? 'service_worker' : p === 'index.html' ? 'html_csp' : p.startsWith('src/styles/')|| p==='tailwind.config.js' ? 'styles' : 'other';
          map.set(k,(map.get(k)||0)+1);
        });
        return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
      })();
      const counts = rel.counts || {};
      const filesTop = Array.isArray(rel.filesTop) ? rel.filesTop : [];
      detailsBody.innerHTML = `
        <div class="space-y-2">
          <div><span class="text-gray-500">Version:</span> <strong>v${rel.version}</strong></div>
          <div><span class="text-gray-500">Date:</span> ${rel.date || '-'}</div>
          <div><span class="text-gray-500">Status:</span> ${rel.status || '-'}</div>
          <div><span class="text-gray-500">Author:</span> ${rel.author || '-'}</div>
          ${cats && cats.length ? `<div><span class=\"text-gray-500\">${AppState.getTranslation?.('release.highlights') || 'Highlights'}:</span> ${cats.map(c=>`<span class=\"ml-1 text-[10px] px-2 py-[2px] rounded bg-gray-100 dark:bg-gray-800\">${escapeHtml(c)}</span>`).join('')}</div>` : ''}
          ${counts && (counts.added||counts.modified||counts.removed) ? `<div><span class=\"text-gray-500\">${AppState.getTranslation?.('release.counts') || 'Counts'}:</span> +${counts.added||0}, ~${counts.modified||0}, -${counts.removed||0}</div>` : ''}
          ${filesTop && filesTop.length ? `<div><span class=\"text-gray-500\">${AppState.getTranslation?.('release.files') || 'Files'}:</span> ${filesTop.map(f=>`<code class=\"text-xs\">${escapeHtml(f)}</code>`).join(', ')}</div>` : ''}
          ${rel.impact ? `<div><span class=\"text-gray-500\">Impact:</span> <span class=\"text-xs uppercase rounded bg-indigo-100 dark:bg-indigo-900 px-2 py-[2px]\">${escapeHtml(rel.impact)}</span></div>` : ''}
          ${rel.risk ? `<div><span class=\"text-gray-500\">Risk:</span> <span class=\"text-xs uppercase rounded ${rel.risk==='high'?'bg-red-100 dark:bg-red-900':(rel.risk==='medium'?'bg-yellow-100 dark:bg-yellow-900':'bg-green-100 dark:bg-green-900')} px-2 py-[2px]\">${escapeHtml(rel.risk)}</span></div>` : ''}
          <div><span class=\"text-gray-500\">${AppState.getTranslation?.('release.description_internal') || 'Description (Internal)'}:</span> ${escapeHtml(desc || '-')}</div>
          ${rel.descriptionPublic ? `<div><span class=\"text-gray-500\">${AppState.getTranslation?.('release.description_public') || 'Description (Public)'}:</span> ${escapeHtml((rel.descriptionPublic[(AppState.language||'en').split('-')[0]] || rel.descriptionPublic.en || ''))}</div>` : ''}
          ${rel.quality === 'auto' ? `<div class=\"text-[10px] text-amber-600\">(Auto‑generated — you can edit and mark as Final)</div>` : ''}
          ${errs.length ? `<div class=\"mt-3 p-2 rounded border border-red-300 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-100\"><strong>Schema issues:</strong> ${errs.join(', ')}</div>` : ''}
          <div class=\"pt-3 flex gap-2\">
            <button id=\"rmEdit\" class=\"px-3 py-1 rounded border dark:border-gray-700\">${AppState.getTranslation?.('release.edit') || 'Edit'}</button>
            ${rel.state!=='final'?`<button id=\\\"rmMarkFinal\\\" class=\\\"px-3 py-1 rounded border\\\">${AppState.getTranslation?.('release.mark_final') || 'Mark Final'}</button>`:''}
            <button id=\"rmDelete\" class=\"px-3 py-1 rounded border border-red-400 text-red-700\">${AppState.getTranslation?.('release.delete') || 'Delete'}</button>
          </div>
        </div>
      `;
      // Append Copy Link button to actions
      try {
        const bar = detailsBody?.querySelector('.pt-3.flex.gap-2') || details.querySelector('.pt-3.flex.gap-2');
        if (bar && !bar.querySelector('#rmCopyLink')) {
          const btn = document.createElement('button');
          btn.id = 'rmCopyLink';
          btn.className = 'px-3 py-1 rounded border';
          btn.textContent = AppState.getTranslation?.('release.copy_link') || 'Copy Link';
          btn.addEventListener('click', () => {
            try {
              const base = location.origin + location.pathname + '#/releases?v=' + encodeURIComponent(rel.version);
              navigator.clipboard?.writeText(base);
              Toast?.show?.(AppState.getTranslation?.('release.link_copied') || 'Link copied');
            } catch {}
          });
          bar.appendChild(btn);
        }
      } catch {}
      // Centered modal with background dimming
      _prevFocus = document.activeElement;
      details.classList.remove('hidden');
      try { details.style.display = 'flex'; } catch {}
      details.setAttribute('aria-modal', 'true');
      details.setAttribute('role', 'dialog');
      details.setAttribute('aria-labelledby', 'rmDetailsTitle');
      details.setAttribute('aria-describedby', 'detailsBody');
      try { document.body.classList.add('overflow-hidden'); } catch {}
      // Reflect selection in URL (?v=<version>) and clear compare
      setHashParam('cmp', null);
      setHashParam('v', rel.version);
      // Improve a11y attributes on action buttons
      try {
        const closeBtn = details.querySelector('#detailsClose');
        closeBtn?.setAttribute?.('type','button');
        closeBtn?.setAttribute?.('aria-label', AppState.getTranslation?.('release.close') || 'Close');
        const editBtn = details.querySelector('#rmEdit');
        editBtn?.setAttribute?.('type','button');
        editBtn?.setAttribute?.('aria-label', AppState.getTranslation?.('release.aria_edit_release') || 'Edit release');
        const markBtn = details.querySelector('#rmMarkFinal');
        markBtn?.setAttribute?.('type','button');
        markBtn?.setAttribute?.('aria-label', AppState.getTranslation?.('release.aria_mark_final') || 'Mark release final');
        const delBtn = details.querySelector('#rmDelete');
        delBtn?.setAttribute?.('type','button');
        delBtn?.setAttribute?.('aria-label', AppState.getTranslation?.('release.aria_delete_release') || 'Delete release');
      } catch {}
      detailsClose?.focus?.();
      if (!details.dataset.bound) {
        details.dataset.bound = '1';
        detailsClose?.addEventListener('click', () => closeDetails());
        details?.addEventListener('click', (e) => { if (e.target?.dataset?.close === 'backdrop') closeDetails(); });
        document.addEventListener('keydown', (e) => { const d = document.getElementById('releaseDetails'); if (e.key === 'Escape' && d && !d.classList.contains('hidden')) closeDetails(); });
        // Focus trap inside modal
        details.addEventListener('keydown', (e) => {
          if (e.key !== 'Tab') return;
          const root = details.querySelector('[role="dialog"]') || details;
          const focusables = Array.from(root.querySelectorAll('a,button,input,select,textarea,[tabindex]'))
            .filter(el => !el.hasAttribute('disabled'));
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const active = document.activeElement;
          if (e.shiftKey) {
            if (active === first || !root.contains(active)) { e.preventDefault(); last.focus(); }
          } else {
            if (active === last || !root.contains(active)) { e.preventDefault(); first.focus(); }
          }
        });
      }
      details.querySelector('#rmEdit')?.addEventListener('click', () => { closeDetails(); openNewReleaseModal({ ...rel, _edit: rel.version }); });
      details.querySelector('#rmMarkFinal')?.addEventListener('click', () => { rel.state = 'final'; markUnsaved(); openDetails(rel); });
      details.querySelector('#rmDelete')?.addEventListener('click', () => {
        const tmpl = AppState.getTranslation?.('release.delete_confirm') || 'Delete release v{version}?';
        const msg = tmpl.replace('{version}', String(rel.version));
        if (!confirm(msg)) return;
        releases = releases.filter(x => String(x.version) !== String(rel.version));
        renderRows(filterData());
        markUnsaved();
        closeDetails();
      });
    };
    const closeDetails = () => {
      const details = document.getElementById('releaseDetails');
      if (details) {
        details.classList.add('hidden');
        details.removeAttribute('aria-modal');
        try { details.style.display = 'none'; } catch {}
      }
      try { document.body.classList.remove('overflow-hidden'); } catch {}
      try { _prevFocus && _prevFocus.focus && _prevFocus.focus(); } catch {}
      // Clean deep-link parameter when modal closes
      setHashParam('v', null);
    };
    const closeAllOverlays = () => { try { closeDetails(); } catch {} try { closeCompare(); } catch {} try { closeInlineDetails(); } catch {} };
    const focusRowByEl = (el) => {
      try {
        const rows = Array.from(tableBody.querySelectorAll('tr')).filter(r=>!r.classList.contains('rm-inline-details'));
        rows.forEach(r=>{ r.classList.remove('rm-row-selected'); r.setAttribute('tabindex','-1'); });
        if (!el) return;
        const tr = el.closest('tr');
        if (!tr) return;
        tr.classList.add('rm-row-selected');
        tr.setAttribute('tabindex','0');
        tr.focus({ preventScroll: false });
      } catch {}
    };

    tableBody.addEventListener('click', (e) => {
      const a = e.target.closest('a.js-open-details');
      if (a) {
        e.preventDefault();
        focusRowByEl(a);
        const v = a.getAttribute('data-version');
        const rel = findRelease(v);
        const tr = e.target.closest('tr');
        if (window.innerWidth < 640 && tr) openInlineDetails(rel, tr); else openDetails(rel);
        return;
      }
      // Fallback: click anywhere on the row opens details for that row's version
      const tr = e.target.closest('tr');
      if (tr) {
        focusRowByEl(tr);
        const link = tr.querySelector('.js-open-details');
        if (link) {
          e.preventDefault();
          const v = link.getAttribute('data-version');
          const rel = findRelease(v);
          if (window.innerWidth < 640) openInlineDetails(rel, tr); else openDetails(rel);
        }
      }
    });

    // Keyboard navigation within table
    tableBody.addEventListener('keydown', (e) => {
      const rows = Array.from(tableBody.querySelectorAll('tr')).filter(r=>!r.classList.contains('rm-inline-details'));
      if (!rows.length) return;
      const currentIndex = rows.findIndex(r => r.classList.contains('rm-row-selected'));
      const focusAt = (idx) => {
        const i = Math.max(0, Math.min(rows.length-1, idx));
        focusRowByEl(rows[i]);
        try { rows[i].scrollIntoView({ block: 'nearest' }); } catch {}
      };
      if (e.key === 'ArrowDown') { e.preventDefault(); focusAt((currentIndex>=0?currentIndex:0) + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt((currentIndex>=0?currentIndex:0) - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
      else if (e.key === 'End') { e.preventDefault(); focusAt(rows.length-1); }
      else if (e.key === 'PageDown') { e.preventDefault(); nextBtn?.click(); setTimeout(()=>{ try { const rs = Array.from(tableBody.querySelectorAll('tr')).filter(r=>!r.classList.contains('rm-inline-details')); if (rs[0]) focusRowByEl(rs[0]); } catch {} }, 0); }
      else if (e.key === 'PageUp') { e.preventDefault(); prevBtn?.click(); setTimeout(()=>{ try { const rs = Array.from(tableBody.querySelectorAll('tr')).filter(r=>!r.classList.contains('rm-inline-details')); if (rs[0]) focusRowByEl(rs[0]); } catch {} }, 0); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const row = rows[(currentIndex>=0?currentIndex:0)] || rows[0];
        if (!row) return;
        const link = row.querySelector('.js-open-details');
        const v = link ? link.getAttribute('data-version') : row.dataset.version;
        const rel = findRelease(v);
        if (window.innerWidth < 640) openInlineDetails(rel, row); else openDetails(rel);
      }
    });
    detailsClose?.addEventListener('click', closeDetails);
    details?.addEventListener('click', (e) => { if (e.target?.dataset?.close === 'backdrop') closeDetails(); });
    document.addEventListener('keydown', (e) => { const d = document.getElementById('releaseDetails'); if (e.key === 'Escape' && d && !d.classList.contains('hidden')) closeDetails(); });
    if (!window.__RM_HashBound) {
      window.addEventListener('hashchange', () => closeAllOverlays());
      window.__RM_HashBound = true;
    }
    // Global delegate: ensure clicking any version link opens the modal (defensive)
    if (!window.__RM_GlobalClickBound) {
      window.__RM_GlobalClickBound = true;
      const handler = (e) => {
        try {
          const el = e.target && e.target.closest ? e.target.closest('.js-open-details') : null;
          if (!el) return;
          // Allow both direct open and hash deep-link as fallback
          try { e.preventDefault(); e.stopPropagation(); } catch {}
          const v = el.getAttribute('data-version') || '';
          const rel = releases.find(r => String(r.version) === String(v));
          if (rel) openDetails(rel);
        } catch {}
      };
      // Capture phase to survive aggressive handlers
      document.addEventListener('click', handler, true);
      document.addEventListener('pointerdown', handler, true);
    }
    // Defensive delegate removed to avoid duplicate global listeners; capture-phase handler above is sufficient.
    // Keyboard shortcuts: '/' focuses search, 'n' opens new release, 'g' or Cmd/Ctrl+K focuses Go-to (when not typing)
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.isComposing;
      if (!typing && e.key === '/') { e.preventDefault(); searchFilter?.focus(); }
      if (!typing && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); newReleaseBtn?.click(); }
      if (!typing && (e.key === 'g' || ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)))) { e.preventDefault(); try { gotoInput?.focus(); gotoInput?.select?.(); } catch {} }
      if (!typing && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); try { resetBtn?.click(); } catch {} }
      if (!typing && (e.key === '?' || (e.key === '/' && e.shiftKey))) { e.preventDefault(); try { openHotkeys(); } catch {} }
    });

    // Hotkeys help modal
    function ensureHotkeys(){
      let d = document.getElementById('rmHotkeys');
      if (!d) {
        d = document.createElement('div');
        d.id = 'rmHotkeys';
        d.className = 'hidden fixed inset-0 z-[3000] flex items-center justify-center p-4';
        d.innerHTML = `
          <div class="absolute inset-0 bg-black/40" data-close="backdrop" aria-hidden="true"></div>
          <div class="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[95%] max-w-[520px] p-6">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">${AppState.getTranslation?.('release.hotkeys') || 'Keyboard Shortcuts'}</h2>
              <button id="hkClose" class="px-3 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.close') || 'Close'}</button>
            </div>
            <ul class="text-sm text-gray-700 dark:text-gray-200 space-y-1">
              <li><kbd>/</kbd> — ${AppState.getTranslation?.('release.search') || 'Search'}</li>
              <li><kbd>n</kbd> — ${AppState.getTranslation?.('release.new') || 'New Release'}</li>
              <li><kbd>g</kbd> / <kbd>Cmd/Ctrl + K</kbd> — ${AppState.getTranslation?.('release.go') || 'Go'}</li>
              <li><kbd>r</kbd> — ${AppState.getTranslation?.('release.reset_filters') || 'Reset Filters'}</li>
              <li><kbd>?</kbd> — ${AppState.getTranslation?.('release.hotkeys') || 'Keyboard Shortcuts'}</li>
            </ul>
          </div>`;
        document.body.appendChild(d);
        const close = () => { try { d.classList.add('hidden'); } catch {} };
        d.querySelector('#hkClose')?.addEventListener('click', close);
        d.addEventListener('click', (e) => { if (e.target?.dataset?.close==='backdrop') close(); });
        document.addEventListener('keydown', (e) => { if (e.key==='Escape' && !d.classList.contains('hidden')) close(); });
      }
      return d;
    }
    function openHotkeys(){ const d = ensureHotkeys(); try { d.classList.remove('hidden'); } catch {} }

    // Warn on navigation refresh/close if there are unsaved changes
    if (!window.__RM_BeforeUnloadBound) {
      window.addEventListener('beforeunload', (e) => {
        if (!hasUnsaved) return;
        e.preventDefault();
        e.returnValue = '';
      });
      window.__RM_BeforeUnloadBound = true;
    }

    // Pagination & column toggles
    pageSizeSel?.addEventListener('change', () => {
      const val = pageSizeSel.value;
      pageSize = (val === 'All') ? Number.MAX_SAFE_INTEGER : (parseInt(val,10)||10);
      page = 1;
      savePrefs({ visible, pageSize, order: colOrder });
      renderRows(filterData());
    });
    prevBtn?.addEventListener('click', () => { if (page>1){ page--; renderRows(filterData()); try{window.Telemetry?.log('rm_page',{page,pageSize});}catch{}} });
    nextBtn?.addEventListener('click', () => { page++; renderRows(filterData()); try{window.Telemetry?.log('rm_page',{page,pageSize});}catch{}} );
    const syncCols = () => { savePrefs({ visible, pageSize, order: colOrder }); headerCells = buildHeader(); bindSortHeaders(); applyColWidths(); renderRows(filterData()); };
    colDate?.addEventListener('change', e => { visible.date = e.target.checked; syncCols(); try{window.Telemetry?.log('rm_cols',visible);}catch{}});
    colStatus?.addEventListener('change', e => { visible.status = e.target.checked; syncCols(); try{window.Telemetry?.log('rm_cols',visible);}catch{}});
    colAuthor?.addEventListener('change', e => { visible.author = e.target.checked; syncCols(); try{window.Telemetry?.log('rm_cols',visible);}catch{}});
    const colModules = target.querySelector('#colModules');
    colModules?.addEventListener('change', e => { visible.modules = e.target.checked; syncCols(); try{window.Telemetry?.log('rm_cols',visible);}catch{}});
    colDesc?.addEventListener('change', e => { visible.description = e.target.checked; syncCols(); try{window.Telemetry?.log('rm_cols',visible);}catch{}});

    // Deep link (?v= or ?cmp=a..b): open requested detail/compare only (no auto-open otherwise)
    try {
      const openFromHash = () => {
        const h = location.hash || '';
        const q = h.includes('?') ? h.split('?')[1] : '';
        const sp = new URLSearchParams(q);
        const vq = sp.get('v');
        const cmp = sp.get('cmp');
        const state = sp.get('state');
        if (cmp && /^\d+\.\d+\.\d+\.\.\d+\.\d+\.\d+$/.test(cmp)) {
          const [a,b] = cmp.split('..');
          if (a && b) showCompare(a,b);
        } else if (vq) {
          const rel = findRelease(vq);
          if (rel) openDetails(rel);
        } else if (state) {
          try {
            const json = JSON.parse(decodeURIComponent(escape(atob(state))));
            restoreState(json);
          } catch {}
        }
      };
      setTimeout(openFromHash, 0);
    } catch {}

    // Compare panel logic
    // list(): removed (unused)
    function renderFiles(r){
      const arr = Array.isArray(r?._files) ? r._files : [];
      const groups = { added: [], modified: [], removed: [], other: [] };
      arr.forEach(line => {
        const m = String(line).match(/^(added|modified|removed):\s*(.*)$/i);
        if (m) {
          const k = m[1].toLowerCase();
          groups[k]?.push(m[2]);
        } else {
          groups.other.push(line);
        }
      });
      const pill = (txt, cls) => `<span class="text-[10px] px-2 py-[2px] rounded ${cls}">${txt}</span>`;
      const block = (title, items, cls) => items.length ? `<div class="mb-2">${pill(title, cls)}<ul class="ml-5 list-disc">${items.slice(0,50).map(f=>`<li>${f}</li>`).join('')}</ul></div>` : '';
      const lblAdded = AppState.getTranslation?.('release.added') || 'added';
      const lblModified = AppState.getTranslation?.('release.modified') || 'modified';
      const lblRemoved = AppState.getTranslation?.('release.removed') || 'removed';
      const lblOther = AppState.getTranslation?.('release.other') || 'other';
      return [
        block(lblAdded, groups.added, 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'),
        block(lblModified, groups.modified, 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'),
        block(lblRemoved, groups.removed, 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'),
        block(lblOther, groups.other, 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200')
      ].join('') || '-';
    }
    // use shared diffHighlight from utils.js

    function countFiles(r){
      const arr = Array.isArray(r?._files) ? r._files : [];
      const groups = { added: 0, modified: 0, removed: 0 };
      arr.forEach(line => {
        const m = String(line).match(/^(added|modified|removed):/i);
        if (m) groups[m[1].toLowerCase()]++;
      });
      return groups;
    }
    let _prevFocusCompare = null;
    function showCompare(va,vb){
      const A = releases.find(r=>String(r.version)===String(va));
      const B = releases.find(r=>String(r.version)===String(vb));
      if (!A || !B) return;
      const row = (label, av, bv, key) => `<tr data-k="${key||''}"><th class="text-left pr-3 py-1 text-gray-500 dark:text-gray-400">${label}</th><td class="pr-3 py-1 align-top">${av||'-'}</td><td class="py-1 align-top">${bv||'-'}</td></tr>`;
      const ddesc = diffHighlight(resolveDesc(A), resolveDesc(B));
      const ca = countFiles(A), cb = countFiles(B);
      function renderCompareBody(diffOnly, filesOnly){
        const diffs = {
          date: (A.date||'') !== (B.date||''),
          status: (A.status||'') !== (B.status||''),
          author: (A.author||'') !== (B.author||'')
        };
        const rows = [
          row('Date', A.date, B.date, 'date'),
          row('Status', A.status, B.status, 'status'),
          row('Author', A.author, B.author, 'author'),
          row('Description', ddesc.aHtml, ddesc.bHtml, 'description'),
          row('Files', renderFiles(A), renderFiles(B), 'files')
        ];
        const top = `<div class="mb-2 text-xs text-gray-600 dark:text-gray-300">`+
          `<span class=\"mr-4\">v${A.version}: +${ca.added} ~${ca.modified} -${ca.removed}</span>`+
          `<span>v${B.version}: +${cb.added} ~${cb.modified} -${cb.removed}</span>`+
          `</div>`;
        const table = `
          <table class="w-full text-sm"><thead><tr><th></th><th class="text-left">v${A.version}</th><th class="text-left">v${B.version}</th></tr></thead><tbody>
            ${rows.filter(r => !filesOnly && (!diffOnly || /data-k=\"(description|files|date|status|author)\"/.test(r)) || /data-k=\"files\"/.test(r)).join('')}
          </tbody></table>`;
        compareBody.innerHTML = top + table;
        if (diffOnly) {
          // hide equal simple fields
          try {
            if (!filesOnly) {
              if (!diffs.date) compareBody.querySelector('tr[data-k="date"]')?.remove();
              if (!diffs.status) compareBody.querySelector('tr[data-k="status"]')?.remove();
              if (!diffs.author) compareBody.querySelector('tr[data-k="author"]')?.remove();
            }
          } catch {}
        }
      }
      renderCompareBody(false, false);
      compareModal.setAttribute('role','dialog');
      compareModal.setAttribute('aria-modal','true');
      try { compareModal.setAttribute('aria-labelledby','compareTitle'); } catch {}
      try {
        const bA = compareModal.querySelector('#cmpBadgeA');
        const bB = compareModal.querySelector('#cmpBadgeB');
        if (bA) { bA.textContent = `A: v${A.version}`; bA.setAttribute('aria-label', `A: v${A.version}`); }
        if (bB) { bB.textContent = `B: v${B.version}`; bB.setAttribute('aria-label', `B: v${B.version}`); }
      } catch {}
      compareModal.classList.remove('hidden');
      _prevFocusCompare = document.activeElement;
      try { document.body.classList.add('overflow-hidden'); } catch {}
      compareClose?.focus?.();
      try{ window.Telemetry?.log('rm_compare',{a:va,b:vb}); }catch{}
      try { setHashParam('v', null); setHashParam('cmp', `${va}..${vb}`); } catch {}
      // Copy compare link buttons (top + bottom)
      try {
        const attachCopy = (sel) => {
          const btn = compareModal.querySelector(sel);
          btn?.addEventListener('click', () => {
            try {
              const link = location.origin + location.pathname + '#/releases?cmp=' + encodeURIComponent(`${va}..${vb}`);
              navigator.clipboard?.writeText(link);
              Toast?.show?.(AppState.getTranslation?.('release.link_copied') || 'Link copied');
            } catch {}
          });
        };
        attachCopy('#cmpCopyLink');
        attachCopy('#cmpCopyLinkBtm');
      } catch {}
      try {
        const chk = compareModal.querySelector('#cmpDiffOnly');
        const cf = compareModal.querySelector('#cmpFilesOnly');
        const apply = () => renderCompareBody(!!chk?.checked, !!cf?.checked);
        chk?.addEventListener('change', apply);
        cf?.addEventListener('change', apply);
      } catch {}
      // Export compare as Markdown
      try {
        compareModal.querySelector('#cmpExportMd')?.addEventListener('click', () => {
          try {
            const diffOnly = !!compareModal.querySelector('#cmpDiffOnly')?.checked;
            const filesOnly = !!compareModal.querySelector('#cmpFilesOnly')?.checked;
            const lines = [`# Compare v${A.version} vs v${B.version}`, ''];
            const diffs = { date: (A.date||'') !== (B.date||''), status: (A.status||'') !== (B.status||''), author: (A.author||'') !== (B.author||'') };
            if (!filesOnly) {
              if (!diffOnly || diffs.date) lines.push(`- Date: ${A.date||'-'} → ${B.date||'-'}`);
              if (!diffOnly || diffs.status) lines.push(`- Status: ${A.status||'-'} → ${B.status||'-'}`);
              if (!diffOnly || diffs.author) lines.push(`- Author: ${A.author||'-'} → ${B.author||'-'}`);
              lines.push('');
            }
            if (!filesOnly && (!diffOnly || (resolveDesc(A)||'') !== (resolveDesc(B)||''))){
              lines.push('## Description');
              lines.push('### A'); lines.push(resolveDesc(A)||'-');
              lines.push('');
              lines.push('### B'); lines.push(resolveDesc(B)||'-');
              lines.push('');
            }
            lines.push('## Files');
            lines.push(`- A: +${ca.added} ~${ca.modified} -${ca.removed}`);
            lines.push(`- B: +${cb.added} ~${cb.modified} -${cb.removed}`);
            const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `compare_v${A.version}_v${B.version}.md`;
            document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a), 100);
          } catch {}
        });
      } catch {}
      // Also bind bottom bar Export MD
      try {
        compareModal.querySelector('#cmpExportMdBtm')?.addEventListener('click', () => {
          try {
            const diffOnly = !!compareModal.querySelector('#cmpDiffOnly')?.checked;
            const filesOnly = !!compareModal.querySelector('#cmpFilesOnly')?.checked;
            const lines = [`# Compare v${A.version} vs v${B.version}`, ''];
            const diffs = { date: (A.date||'') !== (B.date||'') , status: (A.status||'') !== (B.status||'') , author: (A.author||'') !== (B.author||'') };
            if (!filesOnly) {
              if (!diffOnly || diffs.date) lines.push(`- Date: ${A.date||'-'} → ${B.date||'-'}`);
              if (!diffOnly || diffs.status) lines.push(`- Status: ${A.status||'-'} → ${B.status||'-'}`);
              if (!diffOnly || diffs.author) lines.push(`- Author: ${A.author||'-'} → ${B.author||'-'}`);
              lines.push('');
            }
            if (!filesOnly && (!diffOnly || (resolveDesc(A)||'') !== (resolveDesc(B)||''))){
              lines.push('## Description');
              lines.push('### A'); lines.push(resolveDesc(A)||'-');
              lines.push('');
              lines.push('### B'); lines.push(resolveDesc(B)||'-');
              lines.push('');
            }
            lines.push('## Files');
            lines.push(`- A: +${ca.added} ~${ca.modified} -${ca.removed}`);
            lines.push(`- B: +${cb.added} ~${cb.modified} -${cb.removed}`);
            const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `compare_v${A.version}_v${B.version}.md`;
            document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a), 100);
          } catch {}
        });
      } catch {}
      // Swap / Open A / Open B
      try {
        compareModal.querySelector('#cmpSwap')?.addEventListener('click', () => showCompare(vb, va));
        compareModal.querySelector('#cmpOpenA')?.addEventListener('click', () => { try { closeCompare(); } catch {} try { openDetails(A); } catch {} });
        compareModal.querySelector('#cmpOpenB')?.addEventListener('click', () => { try { closeCompare(); } catch {} try { openDetails(B); } catch {} });
      } catch {}
      // Also bind bottom bar actions
      try {
        compareModal.querySelector('#cmpSwapBtm')?.addEventListener('click', () => showCompare(vb, va));
        compareModal.querySelector('#cmpOpenABtm')?.addEventListener('click', () => { try { closeCompare(); } catch {} try { openDetails(A); } catch {} });
        compareModal.querySelector('#cmpOpenBBtm')?.addEventListener('click', () => { try { closeCompare(); } catch {} try { openDetails(B); } catch {} });
        compareModal.querySelector('#compareCloseBtm')?.addEventListener('click', () => closeCompare());
      } catch {}
      // Focus trap inside compare modal
      compareModal.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const root = compareModal.querySelector('[role="dialog"]') || compareModal;
        const els = Array.from(root.querySelectorAll('a,button,input,select,textarea,[tabindex]')).filter(el => !el.hasAttribute('disabled'));
        if (!els.length) return;
        const first = els[0]; const last = els[els.length-1];
        const active = document.activeElement;
        if (e.shiftKey) { if (active === first || !root.contains(active)) { e.preventDefault(); last.focus(); } }
        else { if (active === last || !root.contains(active)) { e.preventDefault(); first.focus(); } }
      }, { once: false });
      // GitHub compare link (optional)
      try {
        const repo = window.AppConfigRef?.repoUrl; // e.g., https://github.com/org/repo
        if (repo && cmpGh) {
          cmpGh.href = `${repo.replace(/\/$/,'')}/compare/v${va}...v${vb}`;
          cmpGh.classList.remove('hidden');
        }
      } catch {}
    }
    cmpBtn?.addEventListener('click', () => {
      const va = cmpA.value; const vb = cmpB.value;
      if (va && vb && va!==vb) showCompare(va,vb);
    });
    const closeCompare = () => {
      compareModal.classList.add('hidden');
      compareModal.removeAttribute('aria-modal');
      try { document.body.classList.remove('overflow-hidden'); } catch {}
      try { _prevFocusCompare && _prevFocusCompare.focus && _prevFocusCompare.focus(); } catch {}
      try { setHashParam('cmp', null); } catch {}
    };
    compareClose?.addEventListener('click', closeCompare);
    compareModal?.addEventListener('click', (e) => { if (e.target?.dataset?.close==='backdrop') closeCompare(); });
    document.addEventListener('keydown', (e) => { const c = document.getElementById('compareModal'); if (e.key === 'Escape' && c && !c.classList.contains('hidden')) closeCompare(); });

    // Row actions (single item export/copy)
    tableBody.addEventListener('click', (e) => {
      const jsonBtn = e.target.closest && e.target.closest('.js-row-json');
      const mdBtn = e.target.closest && e.target.closest('.js-row-md');
      const cpBtn = e.target.closest && e.target.closest('.js-row-copy');
      if (!jsonBtn && !mdBtn && !cpBtn) return;
      e.preventDefault();
      const v = (jsonBtn||mdBtn||cpBtn).getAttribute('data-version');
      const r = findRelease(v);
      if (!r) return;
      if (jsonBtn) {
        const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `release-${v}.json`; a.click();
        try{ window.Telemetry?.log('rm_export',{type:'row-json', v}); }catch{}
      } else if (mdBtn) {
        const desc = resolveDesc(r);
        const md = `## v${r.version} - ${r.date||'-'} (${r.status||'-'})\n- Author: ${r.author||'-'}\n- ${desc||''}\n`;
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `release-${v}.md`; a.click();
        try{ window.Telemetry?.log('rm_export',{type:'row-md', v}); }catch{}
      } else if (cpBtn) {
        const desc = resolveDesc(r);
        const text = `v${r.version} — ${r.date||'-'} — ${r.status||'-'}\n${desc||''}`;
        try { navigator.clipboard?.writeText(text); } catch {}
        try{ window.Telemetry?.log('rm_copy',{v}); }catch{}
      }
    });

    // New Release modal (accessible) and persistence
    function openNewReleaseModal(initial){
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40';
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-900 rounded shadow-lg w-full max-w-2xl p-4 outline-none" tabindex="-1">
          <div class="flex items-center justify-between mb-3">
            <h2 id="nrTitle" class="text-lg font-semibold">${initial && initial._edit ? (AppState.getTranslation?.('release.edit') || 'Edit Release') : (AppState.getTranslation?.('release.new') || 'New Release')}</h2>
            <button type="button" class="js-close px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">✕</button>
          </div>
          <form class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="text-sm">Version<input required aria-required="true" id="nr_version" class="mt-1 w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700" placeholder="1.3.5" /></label>
            <label class="text-sm">Date<input required aria-required="true" id="nr_date" type="date" class="mt-1 w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700" /></label>
            <label class="text-sm">Status<select id="nr_status" class="mt-1 w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700"><option>Stable</option><option>Beta</option></select></label>
            <label class="text-sm">Author<input id="nr_author" class="mt-1 w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700" placeholder="Your name" /></label>
            <div class="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label class="text-sm">TR<textarea id="nr_tr" rows="3" class="mt-1 w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700" placeholder="Açıklama (TR)"></textarea></label>
              <label class="text-sm">DE<textarea id="nr_de" rows="3" class="mt-1 w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700" placeholder="Beschreibung (DE)"></textarea></label>
              <label class="text-sm">EN<textarea id="nr_en" rows="3" class="mt-1 w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700" placeholder="Description (EN)"></textarea></label>
            </div>
            <div class="sm:col-span-2 flex justify-end gap-2 mt-2">
              <button type="button" class="js-close px-4 py-2 rounded bg-gray-200 dark:bg-gray-700">${AppState.getTranslation?.('release.cancel') || 'Cancel'}</button>
              <button type="submit" class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">${AppState.getTranslation?.('release.add') || 'Add'}</button>
            </div>
            <div id="nr_error" class="sm:col-span-2 text-sm text-red-600 mt-1" role="alert" aria-live="assertive"></div>
          </form>
        </div>`;
      document.body.appendChild(modal);
      const dialog = modal.firstElementChild;
      // A11y bindings for dialog container
      try {
        dialog.setAttribute('role','dialog');
        dialog.setAttribute('aria-labelledby','nrTitle');
        dialog.setAttribute('aria-describedby','nr_error');
      } catch {}
      const firstFocus = dialog.querySelector('#nr_version');
      const form = dialog.querySelector('form');
      const err = dialog.querySelector('#nr_error');
      const closeBtns = dialog.querySelectorAll('.js-close');
      try { ['#nr_version','#nr_date'].forEach(sel => { const el = dialog.querySelector(sel); if (el) { el.setAttribute('aria-describedby','nr_error'); } }); } catch {}
      function close(){ try{ modal.remove(); }catch{} document.removeEventListener('keydown', onKey); }
      function onKey(e){ if (e.key === 'Escape') close(); if (e.key === 'Tab'){
        const f = dialog.querySelectorAll('a,button,input,select,textarea,[tabindex]');
        const focusables = Array.from(f).filter(x=>!x.hasAttribute('disabled'));
        if (!focusables.length) return;
        const idx = focusables.indexOf(document.activeElement);
        if (e.shiftKey && (idx<=0)){ e.preventDefault(); focusables[focusables.length-1].focus(); }
        else if (!e.shiftKey && (idx===focusables.length-1)){ e.preventDefault(); focusables[0].focus(); }
      }}
      document.addEventListener('keydown', onKey);
      closeBtns.forEach(b=> b.addEventListener('click', close));
      modal.addEventListener('click', (e)=>{ if (e.target===modal) close(); });
      // Prefill on edit
      if (initial) {
        dialog.querySelector('#nr_version').value = initial.version || '';
        dialog.querySelector('#nr_date').value = (initial.date || '').slice(0,10);
        dialog.querySelector('#nr_status').value = initial.status || 'Stable';
        dialog.querySelector('#nr_author').value = initial.author || '';
        const d = initial.description || {};
        dialog.querySelector('#nr_tr').value = d.tr || '';
        dialog.querySelector('#nr_de').value = d.de || '';
        dialog.querySelector('#nr_en').value = d.en || '';
      }
      setTimeout(()=> firstFocus?.focus(), 0);

      form.addEventListener('submit', (e)=>{
        e.preventDefault();
        err.textContent='';
        try { dialog.querySelector('#nr_version')?.setAttribute('aria-invalid','false'); dialog.querySelector('#nr_date')?.setAttribute('aria-invalid','false'); } catch {}
        const version = dialog.querySelector('#nr_version').value.trim();
        const date = dialog.querySelector('#nr_date').value.trim();
        const status = dialog.querySelector('#nr_status').value.trim() || 'Stable';
        const author = dialog.querySelector('#nr_author').value.trim() || 'System';
        const tr = dialog.querySelector('#nr_tr').value.trim();
        const de = dialog.querySelector('#nr_de').value.trim();
        const en = dialog.querySelector('#nr_en').value.trim();
        if (!version || !date){
          err.textContent = (AppState.getTranslation?.('release.form_required') || 'Version and Date are required.');
          if (!version) { try { const el = dialog.querySelector('#nr_version'); el?.setAttribute('aria-invalid','true'); el?.focus(); } catch {} }
          else { try { const el = dialog.querySelector('#nr_date'); el?.setAttribute('aria-invalid','true'); el?.focus(); } catch {} }
          return;
        }
        if (!/^\d+\.\d+\.\d+$/.test(version)) {
          err.textContent = (AppState.getTranslation?.('release.form_semver') || 'Version must be semver (x.y.z).');
          try { const el = dialog.querySelector('#nr_version'); el?.setAttribute('aria-invalid','true'); el?.focus(); } catch {}
          return;
        }
        // Duplicate version guard (allow same version only when editing the same entry)
        const isEditing = !!(initial && initial._edit);
        const duplicate = releases.some(x => String(x.version) === version && (!isEditing || String(initial._edit) !== version));
        if (duplicate) {
          const msg = (AppState.getTranslation?.('release.version_exists') || 'This version already exists.');
          err.textContent = msg;
          try { const el = dialog.querySelector('#nr_version'); el?.setAttribute('aria-invalid','true'); el?.focus(); } catch {}
          return;
        }
        if (initial && initial._edit) {
          const idx = releases.findIndex(x => String(x.version) === String(initial._edit));
          if (idx >= 0) {
            releases[idx].version = version;
            releases[idx].date = date;
            releases[idx].status = status;
            releases[idx].author = author;
            releases[idx].description = { tr, de, en };
            releases[idx].quality = 'edited';
            releases[idx].state = 'final';
          }
          try{ window.Telemetry?.log('rm_edit_release', { version }); }catch{}
        } else {
          const entry = { version, date, status, author, description: { tr, de, en }, quality: 'edited', state: 'final' };
          releases.push(entry);
          try{ window.Telemetry?.log('rm_add_release', entry); }catch{}
        }
        renderRows(filterData());
        markUnsaved();
        close();
      });
    }
    newReleaseBtn?.addEventListener('click', () => openNewReleaseModal());

    // Persist JSON (download updated file)
    persistJsonBtn?.addEventListener('click', async ()=>{
      const payload = JSON.stringify(releases, null, 2);
      let ok = false;
      try {
        const res = await fetch('/api/release-log', { method:'POST', headers: { 'Content-Type':'application/json' }, body: payload });
        ok = res.ok;
      } catch {}
      if (!ok) {
        // Fallback to download
        try{
          const blob = new Blob([payload], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'release-log.json'; a.click();
        }catch{}
      }
      try{ window.Telemetry?.log('rm_export',{type: ok?'write-json':'download-json'}); }catch{}
      try{
        const msg = ok
          ? (AppState.getTranslation?.('release.saved_json') || 'Saved to release-log.json')
          : (AppState.getTranslation?.('release.downloaded_json') || 'Downloaded release-log.json (dev write API unavailable)');
        Toast?.show?.(msg, ok ? 'info' : 'info');
      } catch {}
      clearUnsaved();
    });

    // Unsaved banner actions
    unsavedSaveBtn?.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); try { persistJsonBtn?.click(); } catch {} });
    unsavedDismissBtn?.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); try { unsavedBanner?.classList.add('hidden'); } catch {} });

    // Import JSON controls
    importBtn?.addEventListener('click', ()=> importFile?.click());
    importFile?.addEventListener('change', async () => {
      const f = importFile.files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const json = JSON.parse(text);
        if (!Array.isArray(json)) throw new Error('Invalid JSON (expected array)');
        releases = json;
        renderRows(filterData());
        markUnsaved();
        try { Toast?.show?.(AppState.getTranslation?.('release.import_ok') || 'Import completed'); } catch {}
      } catch (e) {
        try { Toast?.show?.((AppState.getTranslation?.('release.import_fail') || 'Import failed') + ': ' + (e?.message||e), 'error'); } catch {}
      } finally {
        try { importFile.value = ''; } catch {}
      }
    });

    // Saved Views (filters + columns + sort + page size + module chips)
    const VIEWS_KEY = 'RM_SavedViews';
    function loadViews(){ try{ return JSON.parse(localStorage.getItem(VIEWS_KEY)||'{}'); }catch{ return {}; } }
    function saveViews(obj){ try{ localStorage.setItem(VIEWS_KEY, JSON.stringify(obj)); }catch{} }
    function serializeState(){
      return {
        filters: {
          version: versionFilter.value.trim(),
          from: fromDate?.value || '',
          to: toDate?.value || '',
          status: statusFilter.value.trim(),
          author: authorFilter.value.trim(),
          search: searchFilter.value.trim(),
          module: moduleSelect?.value || ''
        },
        visible,
        order: Array.isArray(colOrder) ? colOrder.slice() : [],
        sort: { ...sortState },
        pageSize,
        modules: Array.from(moduleFilter),
        toggles: {
          freezeDate: !!freezeDate,
          freezeStatus: !!freezeStatus,
          freezeAuthor: !!freezeAuthor,
          freezeModules: !!freezeModules,
          exportVisibleOnly: !!exportVisibleOnly,
          goDirection: goDirection || 'down'
        }
      };
    }
    function restoreState(state){
      if (!state) return;
      const f = state.filters||{};
      versionFilter.value = f.version||'';
      if (fromDate) fromDate.value = f.from||'';
      if (toDate) toDate.value = f.to||'';
      statusFilter.value = f.status||'';
      authorFilter.value = f.author||'';
      searchFilter.value = f.search||'';
      if (moduleSelect) moduleSelect.value = f.module||'';
      Object.assign(visible, state.visible||{});
      if (state.order && Array.isArray(state.order) && state.order.length) {
        colOrder = state.order.slice();
        headerCells = buildHeader();
        bindSortHeaders();
      }
      if (state.sort) { sortState.key = state.sort.key||'date'; sortState.dir = state.sort.dir||'desc'; }
      pageSize = parseInt(state.pageSize||pageSize,10)||pageSize;
      moduleFilter.clear();
      (state.modules||[]).forEach(m=> moduleFilter.add(m));
      renderActiveMods();
      if (pageSizeSel) pageSizeSel.value = String(pageSize);
      // sync column checkboxes
      if (colDate) colDate.checked = !!visible.date;
      if (colStatus) colStatus.checked = !!visible.status;
      if (colAuthor) colAuthor.checked = !!visible.author;
      const colModules = target.querySelector('#colModules');
      colModules && (colModules.checked = !!visible.modules);
      colDesc && (colDesc.checked = !!visible.description);
      // toggles
      if (state.toggles) {
        freezeDate = !!state.toggles.freezeDate; try { localStorage.setItem('RM_FreezeDate', String(freezeDate)); } catch {}
        freezeStatus = !!state.toggles.freezeStatus; try { localStorage.setItem('RM_FreezeStatus', String(freezeStatus)); } catch {}
        freezeAuthor = !!state.toggles.freezeAuthor; try { localStorage.setItem('RM_FreezeAuthor', String(freezeAuthor)); } catch {}
        freezeModules = !!state.toggles.freezeModules; try { localStorage.setItem('RM_FreezeModules', String(freezeModules)); } catch {}
        exportVisibleOnly = !!state.toggles.exportVisibleOnly; try { localStorage.setItem('RM_ExportVisible', String(exportVisibleOnly)); } catch {}
        goDirection = state.toggles.goDirection === 'up' ? 'up' : 'down'; try { localStorage.setItem('RM_GoDirection', goDirection); } catch {}
        applyFreezeClass(); updateStickyOffsets();
      }
      renderRows(filterData());
    }
    function refreshViewSelect(){
      if (!viewSelect) return;
      const views = loadViews();
      const names = Object.keys(views);
      viewSelect.innerHTML = '';
      const def = document.createElement('option'); def.value=''; def.textContent= (AppState.getTranslation?.('release.view_placeholder') || '— Views —'); viewSelect.appendChild(def);
      names.forEach(n=>{ const o=document.createElement('option'); o.value = n; o.textContent = n; viewSelect.appendChild(o); });
    }
    refreshViewSelect();
    saveViewBtn?.addEventListener('click', () => {
      const nameField = document.getElementById('viewNameInput');
      const name = (nameField?.value || '').trim() || prompt('View name');
      if (!name) return;
      const views = loadViews();
      views[name] = serializeState();
      saveViews(views);
      refreshViewSelect();
      if (nameField) nameField.value = '';
    });
    const deleteViewBtn = target.querySelector('#deleteViewBtn');
    deleteViewBtn?.addEventListener('click', () => {
      const sel = viewSelect?.value || '';
      if (!sel) return;
      if (!confirm(`Delete view "${sel}"?`)) return;
      const views = loadViews();
      delete views[sel];
      saveViews(views);
      refreshViewSelect();
    });
    viewSelect?.addEventListener('change', () => {
      const sel = viewSelect.value;
      const views = loadViews();
      if (sel && views[sel]) restoreState(views[sel]);
    });

    // Export/Import/Share Saved Views
    exportViewsBtn?.addEventListener('click', () => {
      try {
        const data = loadViews();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'release-views.json';
        document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a), 100);
      } catch (e) { Toast?.show?.('Views export failed', 'error'); }
    });
    importViewsBtn?.addEventListener('click', () => importViewsFile?.click());
    importViewsFile?.addEventListener('change', async () => {
      const f = importViewsFile.files?.[0]; if (!f) return;
      try {
        const t = await f.text(); const j = JSON.parse(t);
        if (!j || typeof j !== 'object') throw new Error('invalid');
        const cur = loadViews(); const merged = { ...cur, ...j };
        saveViews(merged); refreshViewSelect();
        Toast?.show?.(AppState.getTranslation?.('release.views_import_ok') || 'Views imported');
      } catch (e) {
        Toast?.show?.((AppState.getTranslation?.('release.views_import_fail') || 'Views import failed') + ': ' + (e?.message||e), 'error');
      } finally { try { importViewsFile.value = ''; } catch {} }
    });
    copyViewLinkBtn?.addEventListener('click', () => {
      try {
        const st = serializeState();
        const enc = btoa(unescape(encodeURIComponent(JSON.stringify(st)))).replace(/=+$/,'');
        const link = location.origin + location.pathname + '#/releases?state=' + enc;
        navigator.clipboard?.writeText(link);
        Toast?.show?.(AppState.getTranslation?.('release.link_copied') || 'Link copied');
      } catch (e) { Toast?.show?.('Copy failed', 'error'); }
    });
    // Apply View from Link
    try {
      const applyBtn = document.getElementById('applyViewLinkBtn');
      applyBtn?.addEventListener('click', async () => {
        let link = '';
        try {
          link = await navigator.clipboard?.readText?.();
        } catch {}
        link = link || prompt('Paste link with ?state=...');
        if (!link) return;
        try {
          const u = new URL(link);
          const h = (u.hash || '').replace(/^#/, '');
          const q = h.includes('?') ? h.split('?')[1] : '';
          const sp = new URLSearchParams(q);
          const enc = sp.get('state');
          if (!enc) throw new Error('no state');
          const json = JSON.parse(decodeURIComponent(escape(atob(enc))));
          restoreState(json);
          Toast?.show?.(AppState.getTranslation?.('release.views_import_ok') || 'Views imported');
        } catch (e) {
          Toast?.show?.((AppState.getTranslation?.('release.views_import_fail') || 'Views import failed') + ': ' + (e?.message||e), 'error');
        }
      });
    } catch {}

    // Respect current layout; do not override main margin here.
  }
};

export default ReleaseManagerModule;
