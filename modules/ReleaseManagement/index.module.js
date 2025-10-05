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
    const sanitizeToken = (value, fallback = 'unknown') => {
      const token = String(value ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
      return token || fallback;
    };

    const csvSafe = (s) => { const v = String(s ?? ''); return v && /^[=+\-@]/.test(v) ? "'" + v : v; };
    const csvQuote = (s) => '"' + String(s ?? '').replace(/"/g,'""') + '"';

    // Module manifest cache for version lookup
    const manifestCache = new Map();
    const loadManifestCache = () => { try { return JSON.parse(sessionStorage.getItem('RM_ManifestCache')||'{}'); } catch { return {}; } };
    const saveManifestCache = (obj) => { try { sessionStorage.setItem('RM_ManifestCache', JSON.stringify(obj)); } catch {} };
    const manifestPersist = loadManifestCache();
    async function getModuleVersion(name){
      const raw = String(name ?? '').trim();
      if (!raw) return '';
      const decoded = raw
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      const segment = decoded.split(/[?#]/)[0].split(/[\s/]+/)[0];
      const clean = segment || '';
      if (!clean) return '';
      const cacheKey = clean;
      if (manifestCache.has(cacheKey)) return manifestCache.get(cacheKey);
      const persistedVal = manifestPersist[cacheKey] ?? manifestPersist[raw];
      if (persistedVal !== undefined) {
        manifestCache.set(cacheKey, persistedVal);
        manifestPersist[cacheKey] = persistedVal;
        if (manifestPersist[raw] !== undefined && cacheKey !== raw) {
          delete manifestPersist[raw];
        }
        saveManifestCache(manifestPersist);
        return persistedVal;
      }
      try{
        const url = new URL(`../${encodeURIComponent(cacheKey)}/module.manifest.json`, import.meta.url);
        const j = await fetch(url).then(r=>r.json());
        const v = j?.version || '';
        manifestCache.set(cacheKey, v);
        manifestPersist[cacheKey] = v; saveManifestCache(manifestPersist);
        return v;
      }catch{
        manifestCache.set(cacheKey, '');
        manifestPersist[cacheKey] = ''; saveManifestCache(manifestPersist);
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
    target.style.visibility = 'hidden';
    target.innerHTML = `
      <div class="rm-root rm-scope">
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
            <div id="actionPopover" role="menu" aria-label="${AppState.getTranslation?.('release.actions') || 'Actions'}" class="rm-menu hidden">
              <div id="actionBar" class="rm-menu-section rm-menu-section--primary">
                <button id="newReleaseBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-plus inline-block"></span>
                  <span>${AppState.getTranslation?.('release.new') || 'New Release'}</span>
                </button>
                <button id="importJsonBtn" type="button" role="menuitem" tabindex="-1" title="${AppState.getTranslation?.('release.import_json') || 'Import JSON'}" class="rm-menu-item">
                  <span class="rm-ico rm-ico-download inline-block"></span>
                  <span>${AppState.getTranslation?.('release.import_json') || 'Import JSON'}</span>
                </button>
                <input id="importFile" type="file" accept="application/json" class="hidden" />
              </div>
              <div class="rm-menu-section">
              <div class="rm-menu-heading">${AppState.getTranslation?.('release.menu_export') || 'Export'}</div>
                <button id="exportBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-csv inline-block"></span>
                  <span>${AppState.getTranslation?.('release.export_csv') || 'CSV exportieren'}</span>
                </button>
                <button id="copyCsvBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-csv inline-block"></span>
                  <span>${(AppState.getTranslation?.('release.copy') || 'Copy')} CSV</span>
                </button>
                <button id="exportJsonBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-json inline-block"></span>
                  <span>${AppState.getTranslation?.('release.export_json') || 'JSON exportieren'}</span>
                </button>
                <button id="exportMetaBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-json inline-block"></span>
                  <span>Export Meta (JSON)</span>
                </button>
                <button id="exportMdPublicBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-md inline-block"></span>
                  <span>${AppState.getTranslation?.('release.export_md_public') || 'Export MD (Public)'}</span>
                </button>
                <button id="exportMdBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-md inline-block"></span>
                  <span>${AppState.getTranslation?.('release.export_md') || 'Markdown exportieren'}</span>
                </button>
                <button id="copyMdBtnClip" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-md inline-block"></span>
                  <span>${(AppState.getTranslation?.('release.copy') || 'Copy')} MD</span>
                </button>
                <button id="exportHtmlBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-html inline-block"></span>
                  <span>${AppState.getTranslation?.('release.export_html') || 'Export HTML Report'}</span>
                </button>
              </div>
              <div class="rm-menu-section">
                <div class="rm-menu-heading">${AppState.getTranslation?.('release.menu_views') || 'Views'}</div>
                <button id="exportViewsBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-json inline-block"></span>
                  <span>${AppState.getTranslation?.('release.views_export') || 'Export Views'}</span>
                </button>
                <button id="importViewsBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-download inline-block"></span>
                  <span>${AppState.getTranslation?.('release.views_import') || 'Import Views'}</span>
                </button>
                <button id="copyViewLinkBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-link inline-block"></span>
                  <span>${AppState.getTranslation?.('release.copy_view_link') || 'Copy View Link'}</span>
                </button>
                <button id="applyViewLinkBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-link inline-block"></span>
                  <span>${AppState.getTranslation?.('release.views_apply_link') || 'Apply Link'}</span>
                </button>
                <input id="importViewsFile" type="file" accept="application/json" class="hidden" />
              </div>
              <div class="rm-menu-section">
                <button id="resetBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item">
                  <span class="rm-ico rm-ico-reset inline-block"></span>
                  <span>${AppState.getTranslation?.('release.reset_filters') || 'Filter zurücksetzen'}</span>
                </button>
                <button id="persistJsonBtn" type="button" role="menuitem" tabindex="-1" class="rm-menu-item hidden" title="${AppState.getTranslation?.('release.save_json') || 'Save updated JSON'}">
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
        <div id="filterPanel" class="rm-filter-panel mb-6" data-mode="desktop" hidden>
          <div class="rm-filter-panel__inner">
            <div class="rm-filter-panel__header">
              <div class="rm-filter-panel__head">
                <h2 class="rm-filter-panel__title text-base font-semibold text-gray-700 dark:text-gray-200">${AppState.getTranslation?.('release.filters') || 'Release Filters'}</h2>
                <p class="rm-filter-panel__caption text-xs text-gray-500 dark:text-gray-400">${AppState.getTranslation?.('release.filters_hint') || 'Refine releases by status, author, module or full-text search.'}</p>
              </div>
              <button id="closeFiltersBtn" type="button" class="rm-filter-close inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.close') || 'Close'}</button>
            </div>
            <form id="filterForm" class="rm-filters grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
            <summary class="cursor-pointer select-none px-3 py-2 rounded border dark:border-gray-700" title="${AppState.getTranslation?.('release.advanced_filters') || 'Advanced Filters'}">${AppState.getTranslation?.('release.advanced_filters') || 'Advanced Filters'}</summary>
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
        <div id="quickFilters" class="rm-quick-filter flex flex-wrap items-center gap-2 text-sm">
          <span class="rm-quick-label">${AppState.getTranslation?.('release.quick_filters') || 'Quick filters'}</span>
          <button id="qfStable" type="button" class="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.quick_stable') || 'Stable'}</button>
          <button id="qfLast30" type="button" class="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.quick_last30') || 'Last 30 days'}</button>
          <label class="ml-0 sm:ml-2 inline-flex items-center gap-2 px-2 py-1 rounded border border-gray-300 dark:border-gray-700">
            <input id="qfFilesOnly" type="checkbox" /> <span>${AppState.getTranslation?.('release.files_only') || 'Files only'}</span>
          </label>
        </div>
          </div>
        </div>
        <div id="filterBackdrop" class="rm-filter-backdrop hidden" data-close="backdrop" aria-hidden="true"></div>

        <div class="rm-toolbar-wrap" aria-label="Release controls">
          <div class="rm-info-bar" id="rmMetrics">
            <div class="rm-card-header">
              <div class="rm-card bg-white dark:bg-gray-900 border-0 shadow-none px-0 py-0">
                <div class="rm-metric-grid">
                  <div class="rm-metric">
                    <div class="rm-metric-label">${AppState.getTranslation?.('release.total') || 'Total Releases'}</div>
                    <div class="rm-metric-value" id="releaseCount">0</div>
                    <progress id="releaseRecentBar" class="rm-metric-progress" max="100" value="0" aria-hidden="true"></progress>
                    <div class="rm-metric-sub" id="releaseTrend">—</div>
                  </div>
                  <div class="rm-metric">
                    <div class="rm-metric-label">${AppState.getTranslation?.('release.stable') || 'Stable Releases'}</div>
                    <div class="rm-metric-value" id="stableCount">0</div>
                    <progress id="stableRatioBar" class="rm-metric-progress rm-metric-progress--green" max="100" value="0" aria-hidden="true"></progress>
                    <div class="rm-metric-sub" id="stableTrend">—</div>
                  </div>
                  <div class="rm-metric">
                    <div class="rm-metric-label">${AppState.getTranslation?.('release.latest') || 'Latest Version'}</div>
                    <div class="rm-metric-value" id="latestVersion">—</div>
                    <div class="rm-metric-sub"><span id="releaseLatestDate">—</span> · <span id="releaseAge">—</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="rm-toolbar-primary">
            <div class="rm-toolbar-primary__group">
              <button id="toggleFiltersBtn" type="button" class="rm-toolbar-btn" aria-expanded="false">
                <span class="rm-toolbar-btn__icon" aria-hidden="true">⚙️</span>
                ${AppState.getTranslation?.('release.filter_by') || 'Filters'}
              </button>
              <div class="rm-toolbar-primary__info">
                <span>${AppState.getTranslation?.('release.total') || 'Total Releases'}:</span>
                <strong id="pageInfo" aria-live="polite">0</strong>
              </div>
            </div>
            <div class="rm-toolbar-primary__actions">
              <button id="newReleaseMain" type="button" class="rm-btn rm-btn--primary">
                ${AppState.getTranslation?.('release.new') || 'New Release'}
              </button>
            </div>
          </div>

          <details class="rm-toolbar-group" data-group="view">
            <summary>${AppState.getTranslation?.('release.view') || 'View'}</summary>
            <div class="rm-toolbar-group__body">
              <div class="rm-toolbar-block">
                <span class="rm-toolbar-label">${AppState.getTranslation?.('release.layout') || 'Layout'}</span>
                <div class="rm-toolbar-controls">
                  <div class="rm-toggle-group" role="group" aria-label="${AppState.getTranslation?.('release.layout') || 'Layout'}">
                    <button type="button" id="rmViewAuto" class="rm-toggle-btn" data-mode="auto">${AppState.getTranslation?.('release.view_auto') || 'Auto'}</button>
                    <button type="button" id="rmViewTable" class="rm-toggle-btn" data-mode="table">${AppState.getTranslation?.('release.view_table') || 'Table'}</button>
                    <button type="button" id="rmViewCards" class="rm-toggle-btn" data-mode="card">${AppState.getTranslation?.('release.view_cards') || 'Cards'}</button>
                  </div>
                </div>
              </div>
              <div class="rm-toolbar-block">
                <label class="rm-toolbar-label" for="rmTheme">${AppState.getTranslation?.('release.theme') || 'Theme'}</label>
                <div class="rm-toolbar-controls">
                  <select id="rmTheme" class="rm-toolbar-select">
                    <option value="default">${AppState.getTranslation?.('release.theme_default') || 'Default'}</option>
                    <option value="contrast">${AppState.getTranslation?.('release.theme_contrast') || 'High Contrast'}</option>
                    <option value="brand">${AppState.getTranslation?.('release.theme_brand') || 'Brand'}</option>
                  </select>
                </div>
              </div>
              <div class="rm-toolbar-block">
                <span class="rm-toolbar-label">${AppState.getTranslation?.('release.columns') || 'Columns'}</span>
                <div class="rm-toolbar-controls">
                  <div class="rm-columns-grid">
                    <label class="rm-columns-item"><input type="checkbox" id="colDate" ${visible.date ? 'checked' : ''} /> ${AppState.getTranslation?.('release.date') || 'Date'}</label>
                    <label class="rm-columns-item"><input type="checkbox" id="colStatus" ${visible.status ? 'checked' : ''} /> ${AppState.getTranslation?.('release.status') || 'Status'}</label>
                    <label class="rm-columns-item"><input type="checkbox" id="colAuthor" ${visible.author ? 'checked' : ''} /> ${AppState.getTranslation?.('release.author') || 'Author'}</label>
                    <label class="rm-columns-item"><input type="checkbox" id="colModules" ${visible.modules ? 'checked' : ''} /> ${AppState.getTranslation?.('release.modules') || 'Modules'}</label>
                    <label class="rm-columns-item"><input type="checkbox" id="colDesc" ${visible.description ? 'checked' : ''} /> ${AppState.getTranslation?.('release.description') || 'Description'}</label>
                  </div>
                </div>
              </div>
              <div class="rm-toolbar-block">
                <span class="rm-toolbar-label">${AppState.getTranslation?.('release.density') || 'Density'}</span>
                <div class="rm-toolbar-controls">
                  <div class="rm-density-row">
                    <button id="densityStdBtn" type="button" class="rm-chip-btn">${AppState.getTranslation?.('release.density_standard') || 'Density: Standard'}</button>
                    <button id="densityCmpBtn" type="button" class="rm-chip-btn">${AppState.getTranslation?.('release.density_compact') || 'Density: Compact'}</button>
                    <button id="densityComfBtn" type="button" class="rm-chip-btn">${AppState.getTranslation?.('release.density_comfortable') || 'Density: Comfortable'}</button>
                  </div>
                </div>
              </div>
              <div class="rm-toolbar-block">
                <div class="rm-control-chip rm-control-chip--views">
                  <span>${AppState.getTranslation?.('release.view') || 'View'}:</span>
                  <select id="viewSelect" class="border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700"></select>
                  <input id="viewNameInput" class="w-32 sm:w-36 border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700" placeholder="${AppState.getTranslation?.('release.view_name') || 'Name'}" />
                  <button id="saveViewBtn" class="px-2 py-1 border rounded" title="${AppState.getTranslation?.('release.save_view') || 'Save View'}">${AppState.getTranslation?.('release.save_view') || 'Save View'}</button>
                  <button id="deleteViewBtn" class="px-2 py-1 border rounded" title="${AppState.getTranslation?.('release.delete_view') || 'Delete View'}">${AppState.getTranslation?.('release.delete_view') || 'Delete'}</button>
                  <span class="rm-control-chip__divider" aria-hidden="true">·</span>
                  <label for="gotoVersion">${AppState.getTranslation?.('release.go') || 'Go'}:</label>
                  <input id="gotoVersion" list="versionsList" class="w-24 sm:w-28 border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700" placeholder="${AppState.getTranslation?.('release.goto_placeholder') || 'vX.Y.Z'}" />
                  <datalist id="versionsList"></datalist>
                  <button id="gotoBtn" class="px-2 py-1 border rounded">Go</button>
                </div>
              </div>
            </div>
          </details>

          <details class="rm-toolbar-group" data-group="navigation">
            <summary>${AppState.getTranslation?.('release.navigation') || 'Navigate'}</summary>
            <div class="rm-toolbar-group__body">
              <div class="rm-control-chip rm-control-chip--rows">
                <span>${AppState.getTranslation?.('release.rows') || 'Rows'}:</span>
                <select id="pageSize" class="border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700">
                  <option ${pageSize===5?'selected':''}>5</option>
                  <option ${pageSize===10?'selected':''}>10</option>
                  <option ${pageSize===20?'selected':''}>20</option>
                  <option ${pageSize===50?'selected':''}>50</option>
                  <option value="All" ${pageSize>1000?'selected':''}>All</option>
                </select>
                <button id="prevPage" class="px-2 py-1 border rounded disabled:opacity-50" aria-label="${AppState.getTranslation?.('release.prev') || 'Prev'}">◀</button>
                <button id="nextPage" class="px-2 py-1 border rounded disabled:opacity-50" aria-label="${AppState.getTranslation?.('release.next') || 'Next'}">▶</button>
              </div>
            </div>
          </details>

          <details class="rm-toolbar-group" data-group="analysis">
            <summary>${AppState.getTranslation?.('release.analysis') || 'Analyse'}</summary>
            <div class="rm-toolbar-group__body">
              <div class="rm-control-chip rm-control-chip--compare">
                <span>${AppState.getTranslation?.('release.compare') || 'Compare'}:</span>
                <select id="cmpA" class="border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700"></select>
                <select id="cmpB" class="border rounded px-1 py-[2px] dark:bg-gray-800 dark:border-gray-700"></select>
                <button id="cmpBtn" class="px-2 py-1 border rounded">${AppState.getTranslation?.('release.diff') || 'Diff'}</button>
                <a id="cmpGh" href="#" target="_blank" rel="noopener noreferrer" class="hidden underline text-blue-600">${AppState.getTranslation?.('release.github') || 'GitHub'}</a>
                <span id="cmpGhHint" class="hidden flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
                  <span aria-hidden="true">⚠️</span>
                  ${AppState.getTranslation?.('release.repo_hint') || 'Set repoUrl via scripts/set_repo_url.py to enable the compare link.'}
                </span>
              </div>
            </div>
          </details>
        </div>
        <div class="rm-info-bar" id="rmInfoBar">
          <span id="rmRepoInfo" class="rm-info-pill" role="status"></span>
          <span id="rmBenchInfo" class="rm-info-pill" role="status"></span>
        </div>
        <div id="selectionBar" class="hidden mb-2 p-2 rounded border text-sm bg-white dark:bg-gray-800 dark:border-gray-700 flex flex-wrap items-center gap-2" role="status" aria-live="polite" aria-atomic="true">
          <span class="mr-2"><span id="selCount">0</span> ${AppState.getTranslation?.('release.selected') || 'selected'} <span class="opacity-60">(${AppState.getTranslation?.('release.filtered') || 'filtered'}: <span id="selTotal">0</span>)</span></span>
          <button id="selExportCsv" type="button" class="px-2 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 inline-flex items-center gap-2"><span class="rm-ico rm-ico-csv"></span>${AppState.getTranslation?.('release.export_csv') || 'Export CSV'}</button>
          <button id="selExportMd" type="button" class="px-2 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 inline-flex items-center gap-2"><span class="rm-ico rm-ico-md"></span>${AppState.getTranslation?.('release.export_md') || 'Export MD'}</button>
          <button id="selExportJson" type="button" class="px-2 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 inline-flex items-center gap-2"><span class="rm-ico rm-ico-json"></span>${AppState.getTranslation?.('release.export_json') || 'Export JSON'}</button>
          <button id="selCopyCsv" type="button" class="px-2 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 inline-flex items-center gap-2"><span class="rm-ico rm-ico-csv"></span>${(AppState.getTranslation?.('release.copy') || 'Copy')} CSV</button>
          <button id="selCopyMd" type="button" class="px-2 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 inline-flex items-center gap-2"><span class="rm-ico rm-ico-md"></span>${(AppState.getTranslation?.('release.copy') || 'Copy')} MD</button>
          <button id="selCompare" type="button" class="px-2 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 inline-flex items-center gap-2"><span class="rm-ico rm-ico-link"></span>${AppState.getTranslation?.('release.compare') || 'Compare'}</button>
          <button id="selDelete" type="button" class="px-2 py-1 rounded border border-red-400 text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 inline-flex items-center gap-2"><span class="rm-ico rm-ico-delete"></span>${AppState.getTranslation?.('release.delete') || 'Delete'}</button>
          <label class="inline-flex items-center gap-2 ml-2 opacity-80"><input id="selPageOnly" type="checkbox"/> ${AppState.getTranslation?.('release.page_only') || 'Page only'}</label>
          <button id="selClear" type="button" class="ml-2 px-2 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.clear_selection') || 'Clear selection'}</button>
          <button id="selInvert" type="button" class="ml-1 px-2 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.invert_selection') || 'Invert selection'}</button>
          <button id="selSelectFiltered" type="button" class="ml-1 px-2 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.select_filtered') || 'Select filtered'}</button>
          <button id="selClearFiltered" type="button" class="ml-1 px-2 py-1 rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${AppState.getTranslation?.('release.clear_filtered') || 'Clear filtered'}</button>
        </div>
        <div id="cardList" class="rm-card-list hidden" aria-live="polite"></div>
        <div id="tableWrap" class="rm-table-wrap">
          <div id="rmSkeleton" class="rm-skeleton hidden sm:block"></div>
          <table id="dataTable" class="rm-table" aria-label="Release Logs Table">
            <thead class="rm-table-head sticky">
              <tr id="theadRow"></tr>
            </thead>
            <tbody id="tableBody" class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"></tbody>
          </table>
        </div>
        <div id="noResults" class="rm-empty hidden" role="status" aria-live="polite">
          <div class="rm-empty-body">
            <div class="rm-empty-icon" aria-hidden="true"></div>
            <h3 class="rm-empty-title">${AppState.getTranslation?.('release.no_results') || 'No releases found.'}</h3>
            <p class="rm-empty-sub">${AppState.getTranslation?.('release.no_results_hint') || 'Try adjusting filters or clearing modules.'}</p>
            <div class="rm-empty-actions">
              <button id="noResNew" class="rm-empty-cta">
                <span class="rm-ico rm-ico-plus"></span>
                ${AppState.getTranslation?.('release.new') || 'New Release'}
              </button>
              <button id="noResReset" class="rm-empty-btn">${AppState.getTranslation?.('release.reset_filters') || 'Reset Filters'}</button>
            </div>
            <div class="rm-empty-quick text-sm">
              <span class="rm-empty-quick-label">${AppState.getTranslation?.('release.quick_filters') || 'Quick filters'}:</span>
              <button id="noResSuggestStable" class="rm-empty-chip">${AppState.getTranslation?.('release.status') || 'Status'}: Stable</button>
              <button id="noResSuggest30" class="rm-empty-chip">${AppState.getTranslation?.('release.last_30_days') || 'Last 30 days'}</button>
            </div>
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
              <label class="rm-compare-toggle"><input id="cmpDiffOnly" type="checkbox"/> <span aria-hidden="true" class="rm-compare-toggle__icon">≠</span><span>${AppState.getTranslation?.('release.diff_only') || 'Diff only'}</span></label>
              <label class="rm-compare-toggle"><input id="cmpFilesOnly" type="checkbox"/> <span aria-hidden="true" class="rm-compare-toggle__icon">Σ</span><span>${AppState.getTranslation?.('release.files_only') || 'Files only'}</span></label>
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

    const waitForLayoutReady = async () => {
      try {
        if (document.readyState !== 'complete') {
          await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
        }
        if (document.fonts?.ready) {
          await document.fonts.ready.catch(() => {});
        }
      } catch {}
    };
    await waitForLayoutReady();
    target.style.visibility = '';

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
    const selected = new Set();
    const exportBtn = target.querySelector('#exportBtn');
    let closeActionMenu = null;
    const actionMenuBtn = target.querySelector('#actionMenuBtn');
    const actionMenuBtnMain = target.querySelector('#actionMenuBtnMain');
    const actionPopover = target.querySelector('#actionPopover');
    const importBtn = target.querySelector('#importJsonBtn');
    const importFile = target.querySelector('#importFile');
    const newReleaseBtn = target.querySelector('#newReleaseBtn');
    const newReleaseMain = target.querySelector('#newReleaseMain');
    const persistJsonBtn = target.querySelector('#persistJsonBtn');
    const unsavedBanner = target.querySelector('#unsavedBanner');
    const unsavedSaveBtn = target.querySelector('#unsavedSaveBtn');
    const unsavedDismissBtn = target.querySelector('#unsavedDismissBtn');
    const unsavedDot = target.querySelector('#rmUnsavedDot');
    const selBar = target.querySelector('#selectionBar');
    const selCount = target.querySelector('#selCount');
    const selTotal = target.querySelector('#selTotal');
    const selClear = target.querySelector('#selClear');
    const selExportCsv = target.querySelector('#selExportCsv');
    const selExportMd = target.querySelector('#selExportMd');
    const selExportJson = target.querySelector('#selExportJson');
    const selCopyCsv = target.querySelector('#selCopyCsv');
    const selCopyMd = target.querySelector('#selCopyMd');
    const selInvert = target.querySelector('#selInvert');
    const selSelectFiltered = target.querySelector('#selSelectFiltered');
    const selClearFiltered = target.querySelector('#selClearFiltered');
    const selCompare = target.querySelector('#selCompare');
    const selDelete = target.querySelector('#selDelete');
    const toggleFiltersBtn = target.querySelector('#toggleFiltersBtn');
    const filterPanel = target.querySelector('#filterPanel');
    const filterBackdrop = target.querySelector('#filterBackdrop');
    const closeFiltersBtn = target.querySelector('#closeFiltersBtn');
    const exportHtmlBtn = target.querySelector('#exportHtmlBtn');
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

    function updateSelBar(){
      try { selBar?.classList.toggle('hidden', selected.size === 0); } catch {}
      try { if (selCount) selCount.textContent = String(selected.size); } catch {}
      try { if (selTotal) selTotal.textContent = String(applySort(filterData()).length); } catch {}
      try { if (selExportCsv) selExportCsv.disabled = selected.size===0; } catch {}
      try { if (selExportMd) selExportMd.disabled = selected.size===0; } catch {}
      try { if (selExportJson) selExportJson.disabled = selected.size===0; } catch {}
      try { if (selCopyCsv) selCopyCsv.disabled = selected.size===0; } catch {}
      try { if (selCopyMd) selCopyMd.disabled = selected.size===0; } catch {}
      try { if (selDelete) selDelete.disabled = selected.size===0; } catch {}
      try { if (selCompare) selCompare.disabled = selected.size!==2; } catch {}
    }
    const releaseCount = target.querySelector('#releaseCount');
    const stableCount = target.querySelector('#stableCount');
    const latestVersion = target.querySelector('#latestVersion');
    const releaseTrend = target.querySelector('#releaseTrend');
    const stableTrend = target.querySelector('#stableTrend');
    const releaseRecentBar = target.querySelector('#releaseRecentBar');
    const stableRatioBar = target.querySelector('#stableRatioBar');
    const releaseAge = target.querySelector('#releaseAge');
    const releaseLatestDate = target.querySelector('#releaseLatestDate');
    const tableBody = target.querySelector('#tableBody');
    const theadRow = target.querySelector('#theadRow');
    const tableWrap = target.querySelector('#tableWrap');
    const cardList = target.querySelector('#cardList');
    const themeSelect = target.querySelector('#rmTheme');
    const syncThemeAttr = (el, theme) => {
      if (!el) return;
      if (!theme || theme === 'default') el.removeAttribute('data-theme');
      else el.setAttribute('data-theme', theme);
    };
    const viewAutoBtn = target.querySelector('#rmViewAuto');
    const viewTableBtn = target.querySelector('#rmViewTable');
    const viewCardsBtn = target.querySelector('#rmViewCards');
    const repoInfo = target.querySelector('#rmRepoInfo');
    const benchInfo = target.querySelector('#rmBenchInfo');
    let cardPreference = 'auto';
    let currentTheme = 'default';

    const themeKey = 'RM_Theme';
    const applyThemeSetting = (value) => {
      const rootEl = target.querySelector('.rm-root');
      if (!rootEl) return;
      if (!value || value === 'default') rootEl.removeAttribute('data-theme');
      else rootEl.setAttribute('data-theme', value);
      currentTheme = value || 'default';
      syncThemeAttr(document.getElementById('detailsBody'), currentTheme);
      syncThemeAttr(document.getElementById('compareBody'), currentTheme);
      syncThemeAttr(document.getElementById('rmColMenu'), currentTheme);
    };
    const loadThemeSetting = () => {
      let saved = 'default';
      try { saved = localStorage.getItem(themeKey) || 'default'; } catch {}
      applyThemeSetting(saved);
      if (themeSelect) themeSelect.value = saved;
      return saved;
    };
    currentTheme = loadThemeSetting();
    themeSelect?.addEventListener('change', () => {
      const val = themeSelect.value || 'default';
      applyThemeSetting(val);
      try { localStorage.setItem(themeKey, val); } catch {}
    });

    const viewButtons = [viewAutoBtn, viewTableBtn, viewCardsBtn];
    const syncViewButtons = () => {
      viewButtons.forEach(btn => {
        if (!btn) return;
        const mode = btn.dataset.mode;
        const active = (cardPreference === mode) || (mode === 'auto' && cardPreference === 'auto');
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };
    const setViewPreference = (mode) => {
      cardPreference = mode;
      try { localStorage.setItem(CARD_PREF_KEY, mode); } catch {}
      syncViewButtons();
      cardLayoutActive = resolveCardView();
      renderRows(filterData());
    };
    viewAutoBtn?.addEventListener('click', () => setViewPreference('auto'));
    viewTableBtn?.addEventListener('click', () => setViewPreference('table'));
    viewCardsBtn?.addEventListener('click', () => setViewPreference('card'));
    syncViewButtons();

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

    // Filtre paneli (mobil için overlay, masaüstü için inline)
    const bodyEl = typeof document !== 'undefined' ? document.body : null;
    const FILTER_LOCK_CLASS = 'rm-scroll-lock';
    const isMobileFilters = () => window.innerWidth < 768;
    let filtersOpen = false;

    const setToggleAria = (open) => { try { toggleFiltersBtn?.setAttribute('aria-expanded', String(open)); } catch {} };

    const syncFilterPanelMode = () => {
      if (!filterPanel) return;
      const mobile = isMobileFilters();
      try { filterPanel.setAttribute('data-mode', mobile ? 'mobile' : 'desktop'); } catch {}
      if (filtersOpen) {
        filterPanel.removeAttribute('hidden');
        requestAnimationFrame(() => filterPanel.classList.add('rm-filter-panel--open'));
        if (mobile) {
          filterBackdrop?.classList.remove('hidden');
          bodyEl?.classList.add(FILTER_LOCK_CLASS);
        } else {
          filterBackdrop?.classList.add('hidden');
          bodyEl?.classList.remove(FILTER_LOCK_CLASS);
        }
      } else {
        filterPanel.classList.remove('rm-filter-panel--open');
        filterBackdrop?.classList.add('hidden');
        bodyEl?.classList.remove(FILTER_LOCK_CLASS);
        setTimeout(() => { if (!filtersOpen) filterPanel.setAttribute('hidden',''); }, 200);
      }
      setToggleAria(filtersOpen);
    };

    const focusFirstFilter = () => {
      try {
        const first = filterPanel?.querySelector('input,select,textarea,button');
        if (first && typeof first.focus === 'function') first.focus({ preventScroll: true });
      } catch {}
    };

    const openFilters = () => {
      if (!filterPanel) return;
      if (filtersOpen) {
        if (!isMobileFilters()) {
          try { filterPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
          filterPanel.classList.add('rm-filter-panel--spot');
          setTimeout(() => { try { filterPanel.classList.remove('rm-filter-panel--spot'); } catch {} }, 600);
        }
        return;
      }
      filtersOpen = true;
      syncFilterPanelMode();
      if (isMobileFilters()) {
        setTimeout(() => focusFirstFilter(), 200);
      } else {
        try { filterPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
        filterPanel.classList.add('rm-filter-panel--spot');
        setTimeout(() => { try { filterPanel.classList.remove('rm-filter-panel--spot'); } catch {} }, 600);
      }
    };

    const closeFilters = () => {
      if (!filterPanel) return;
      filtersOpen = false;
      syncFilterPanelMode();
      if (isMobileFilters()) {
        setTimeout(() => {
          if (!filtersOpen) {
            try { toggleFiltersBtn?.focus({ preventScroll: true }); } catch {}
          }
        }, 220);
      }
    };

    syncFilterPanelMode();
    window.addEventListener('resize', () => syncFilterPanelMode(), { passive: true });
    try { toggleFiltersBtn?.setAttribute('aria-controls','filterPanel'); } catch {}
    toggleFiltersBtn?.addEventListener('click', () => {
      if (!filterPanel) return;
      if (filtersOpen) closeFilters(); else openFilters();
    });
    closeFiltersBtn?.addEventListener('click', () => closeFilters());
    filterBackdrop?.addEventListener('click', (e) => {
      if (e.target?.dataset?.close === 'backdrop') closeFilters();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && filtersOpen) closeFilters();
    });

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
      thV.innerHTML = `<label class="inline-flex items-center gap-2 select-none">
        <input id="rmSelAll" type="checkbox" class="align-middle" aria-label="${AppState.getTranslation?.('release.select_all') || 'Select all'}"/>
        <span>${AppState.getTranslation?.('release.version') || 'Version'} <span class=\"sort-ico ml-1 opacity-40\">⇅</span></span>
      </label>`;
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
          el.className = 'rm-colmenu rm-scope hidden';
          syncThemeAttr(el, currentTheme);
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
        const options = [
          { key: 'date', label: AppState.getTranslation?.('release.date') || 'Date' },
          { key: 'status', label: AppState.getTranslation?.('release.status') || 'Status' },
          { key: 'author', label: AppState.getTranslation?.('release.author') || 'Author' },
          { key: 'modules', label: AppState.getTranslation?.('release.modules') || 'Modules' },
          { key: 'description', label: AppState.getTranslation?.('release.description') || 'Description' }
        ];
        menu.innerHTML = options.map((it) => (
          `<label class="rm-colmenu-item"><input type="checkbox" data-key="${it.key}" ${visible[it.key] !== false ? 'checked' : ''}/> ${it.label}</label>`
        )).join('');

        const appendCheckbox = (id, label, checked, extraClass = '') => {
          const row = document.createElement('label');
          row.className = `rm-colmenu-item ${extraClass}`.trim();
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.id = id;
          if (checked) input.checked = true;
          row.appendChild(input);
          row.appendChild(document.createTextNode(` ${label}`));
          menu.appendChild(row);
          return input;
        };

        const freezeDateInput = appendCheckbox('rmFreezeDate', AppState.getTranslation?.('release.freeze_date') || 'Freeze Date', freezeDate, 'rm-colmenu-item--spaced');
        const freezeAuthorInput = appendCheckbox('rmFreezeAuthor', AppState.getTranslation?.('release.freeze_author') || 'Freeze Author', freezeAuthor);
        const exportVisibleInput = appendCheckbox('rmExportVisible', AppState.getTranslation?.('release.export_visible') || 'Export visible columns', exportVisibleOnly);

        const goGroup = document.createElement('div');
        goGroup.className = 'rm-colmenu-group rm-colmenu-item--spaced';
        goGroup.innerHTML = `
          <div class="rm-colmenu-group-label">${AppState.getTranslation?.('release.go_dir') || 'Go direction'}</div>
          <div class="rm-colmenu-radios">
            <label class="rm-colmenu-radio"><input type="radio" name="rmGoDir" value="down" ${goDirection === 'down' ? 'checked' : ''}/> ${AppState.getTranslation?.('release.go_dir_down') || 'Nearest lower'}</label>
            <label class="rm-colmenu-radio"><input type="radio" name="rmGoDir" value="up" ${goDirection === 'up' ? 'checked' : ''}/> ${AppState.getTranslation?.('release.go_dir_up') || 'Nearest higher'}</label>
          </div>`;
        menu.appendChild(goGroup);

        const freezeStatusInput = appendCheckbox('rmFreezeStatus', AppState.getTranslation?.('release.freeze_status') || 'Freeze Status', freezeStatus, 'rm-colmenu-item--spaced');
        const freezeModulesInput = appendCheckbox('rmFreezeModules', AppState.getTranslation?.('release.freeze_modules') || 'Freeze Modules', freezeModules);

        const actions = document.createElement('div');
        actions.className = 'rm-colmenu-actions';
        actions.innerHTML = `
          <button id="rmColAutoFit" type="button" class="rm-colmenu-apply">Auto-fit</button>
          <button id="rmColReset" type="button" class="rm-colmenu-reset">Reset</button>`;
        menu.appendChild(actions);

        menu.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          input.addEventListener('change', (ev) => {
            const k = ev.target.getAttribute('data-key');
            if (!k) return;
            visible[k] = ev.target.checked;
            try { savePrefs({ visible, pageSize, order: colOrder }); } catch {}
            try { headerCells = buildHeader(); bindSortHeaders(); applyColWidths(); renderRows(filterData()); initColMenu(); } catch {}
          });
        });
        freezeDateInput?.addEventListener('change', (ev) => {
          freezeDate = !!ev.target.checked;
          try { localStorage.setItem('RM_FreezeDate', String(freezeDate)); } catch {}
          applyFreezeClass();
          updateStickyOffsets();
        });
        freezeAuthorInput?.addEventListener('change', (ev) => {
          freezeAuthor = !!ev.target.checked;
          try { localStorage.setItem('RM_FreezeAuthor', String(freezeAuthor)); } catch {}
          applyFreezeClass();
          updateStickyOffsets();
        });
        exportVisibleInput?.addEventListener('change', (ev) => {
          exportVisibleOnly = !!ev.target.checked;
          try { localStorage.setItem('RM_ExportVisible', String(exportVisibleOnly)); } catch {}
        });
        goGroup.querySelectorAll('input[name="rmGoDir"]').forEach((radio) => {
          radio.addEventListener('change', (ev) => {
            if (ev.target.checked) {
              goDirection = ev.target.value === 'up' ? 'up' : 'down';
              try { localStorage.setItem('RM_GoDirection', goDirection); } catch {}
            }
          });
        });
        freezeStatusInput?.addEventListener('change', (ev) => {
          freezeStatus = !!ev.target.checked;
          try { localStorage.setItem('RM_FreezeStatus', String(freezeStatus)); } catch {}
          applyFreezeClass();
          updateStickyOffsets();
        });
        freezeModulesInput?.addEventListener('change', (ev) => {
          freezeModules = !!ev.target.checked;
          try { localStorage.setItem('RM_FreezeModules', String(freezeModules)); } catch {}
          applyFreezeClass();
          updateStickyOffsets();
        });
        menu.querySelector('#rmColAutoFit')?.addEventListener('click', () => {
          try {
            const keys = ['version', ...colOrder.filter(k => k !== 'version')];
            keys.forEach((k) => { if (k === 'version' || visible[k] !== false) { try { autoFitColumn(k); } catch {} } });
            updateStickyOffsets();
          } catch {}
        });
        menu.querySelector('#rmColReset')?.addEventListener('click', () => {
          try {
            visible = { ...defaultPrefs.visible };
            colOrder = [...defaultPrefs.order];
            savePrefs({ visible, pageSize, order: colOrder });
            headerCells = buildHeader();
            bindSortHeaders();
            applyColWidths();
            renderRows(filterData());
            initColMenu();
            close();
          } catch {}
        });
        const rect = btn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.classList.remove('hidden');
        const menuWidth = menu.offsetWidth || 200;
        const menuHeight = menu.offsetHeight || 200;
        const viewH = window.innerHeight || document.documentElement.clientHeight || 800;
        const top = Math.min(viewH - menuHeight - 12, rect.bottom + 6);
        menu.style.top = Math.max(8, top) + 'px';
        menu.style.left = Math.max(8, rect.right - menuWidth) + 'px';
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
    const cmpGhHint = target.querySelector('#cmpGhHint');
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
    compareBody?.classList?.add('rm-scope');
    syncThemeAttr(compareBody, currentTheme);
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

    const getRepoUrl = () => {
      const raw = window.AppConfigRef?.repoUrl;
      if (!raw) return '';
      try {
        const parsed = new URL(raw);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          return parsed.href.replace(/\/$/, '');
        }
      } catch {}
      return '';
    };
    const updateRepoHint = () => {
      const repo = getRepoUrl();
      if (cmpGhHint) {
        if (repo) cmpGhHint.classList.add('hidden');
        else cmpGhHint.classList.remove('hidden');
      }
      if (repoInfo) {
        const tooltip = AppState.getTranslation?.('release.repo_hint') || 'Set repoUrl via scripts/set_repo_url.py to enable the compare link.';
        if (repo) {
          repoInfo.textContent = `${AppState.getTranslation?.('release.repo_ready') || 'GitHub compare ready'}`;
          repoInfo.classList.remove('rm-info-pill--warn');
        } else {
          repoInfo.textContent = `${AppState.getTranslation?.('release.repo_missing') || 'repoUrl not configured'}`;
          repoInfo.classList.add('rm-info-pill--warn');
        }
        try { repoInfo.setAttribute('title', tooltip); repoInfo.setAttribute('aria-label', `${repoInfo.textContent}. ${tooltip}`); } catch {}
      }
    };
    const updateBenchInfo = (elapsed) => {
      if (!benchInfo) return;
      let best = elapsed;
      if (best == null) {
        try { best = Number(sessionStorage.getItem('RM_BENCH_RENDER_MS') || 0); } catch {}
      }
      if (best && Number.isFinite(best)) {
        benchInfo.textContent = `${AppState.getTranslation?.('release.benchmark_label') || 'Render'}: ${best} ms`;
        benchInfo.classList.remove('rm-info-pill--warn');
      } else {
        benchInfo.textContent = `${AppState.getTranslation?.('release.benchmark_pending') || 'Render benchmark pending'}`;
        benchInfo.classList.add('rm-info-pill--warn');
      }
      const benchTip = AppState.getTranslation?.('release.benchmark_hint') || "Set window.__RM_BENCHMARK__='render' before loading to capture timings.";
      try { benchInfo.setAttribute('title', benchTip); benchInfo.setAttribute('aria-label', `${benchInfo.textContent}. ${benchTip}`); } catch {}
    };
    updateRepoHint();
    updateBenchInfo();

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
      const card = cardLayoutActive ? cardList?.querySelector(`.rm-release-card[data-version="${ver}"]`) : null;
      if (card) {
        try { card.scrollIntoView({ block: 'nearest' }); } catch {}
        try { card.querySelector('.js-open-card')?.focus(); } catch {}
        return;
      }
      const tr = tableBody.querySelector(`tr[data-version="${ver}"]`);
      const wrap = tableWrap;
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
    async function copyText(text){
      try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
      try {
        const ta = document.createElement('textarea');
        ta.value = String(text||'');
        ta.setAttribute('readonly','');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch { return false; }
    }
    function encodeStateToHash(){
      try {
        const st = serializeState();
        const enc = btoa(unescape(encodeURIComponent(JSON.stringify(st)))).replace(/=+$/,'');
        setHashParam('state', enc);
      } catch {}
    }
    try {
      if (import.meta?.vitest && typeof Blob !== 'undefined' && typeof Blob.prototype?.text !== 'function') {
        Blob.prototype.text = async function blobTextPolyfill() {
          const ab = await this.arrayBuffer();
          if (typeof Buffer !== 'undefined') return Buffer.from(ab).toString('utf-8');
          if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(ab);
          let out = '';
          const view = new Uint8Array(ab);
          for (let i = 0; i < view.length; i++) out += String.fromCharCode(view[i]);
          return out;
        };
      }
    } catch {}
    const attachBlobText = (blob, fallbackText) => {
      const ensure = (target) => {
        if (target && typeof target.text !== 'function') {
          try {
            Object.defineProperty(target, 'text', {
              configurable: true,
              writable: true,
              value: async function blobText() {
                if (typeof fallbackText === 'string') return fallbackText;
                if (typeof this.arrayBuffer === 'function') {
                  const ab = await this.arrayBuffer();
                  if (typeof Buffer !== 'undefined') return Buffer.from(ab).toString('utf-8');
                  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(ab);
                  let out = '';
                  const view = new Uint8Array(ab);
                  for (let i = 0; i < view.length; i++) out += String.fromCharCode(view[i]);
                  return out;
                }
                return '';
              }
            });
          } catch {
            // Fallback to direct assignment if defineProperty fails
            target.text = async function blobTextFallback() {
              if (typeof fallbackText === 'string') return fallbackText;
              if (typeof this.arrayBuffer === 'function') {
                const ab = await this.arrayBuffer();
                if (typeof Buffer !== 'undefined') return Buffer.from(ab).toString('utf-8');
                if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(ab);
                let out = '';
                const view = new Uint8Array(ab);
                for (let i = 0; i < view.length; i++) out += String.fromCharCode(view[i]);
                return out;
              }
              return '';
            };
          }
        }
      };
      ensure(blob);
      try { ensure(Object.getPrototypeOf(blob)); } catch {}
      return blob;
    };
    const translate = (key, fallback) => {
      const val = AppState.getTranslation?.(key);
      if (!val || val === key) return fallback;
      return val;
    };

    const CARD_BREAKPOINT = 900;
    const CARD_PREF_KEY = 'RM_ViewPref';
    try { cardPreference = localStorage.getItem(CARD_PREF_KEY) || 'auto'; } catch {}
    const resolveCardView = () => {
      if (cardPreference === 'card') return true;
      if (cardPreference === 'table') return false;
      return window.innerWidth < CARD_BREAKPOINT;
    };
    let cardLayoutActive = resolveCardView();
    const animateReveal = (el) => {
      if (!el) return;
      try {
        el.classList.remove('rm-fade-pop');
        void el.offsetWidth;
        el.classList.add('rm-fade-pop');
        el.addEventListener('animationend', () => el.classList.remove('rm-fade-pop'), { once: true });
      } catch {}
    };
    const summarizeMetrics = (list) => {
      const dataSet = Array.isArray(list) ? list : [];
      const total = dataSet.length;
      const stableTotal = dataSet.filter(r => String(r.status || '').toLowerCase() === 'stable').length;
      const now = new Date();
      const dayMs = 24 * 60 * 60 * 1000;
      const last30Count = dataSet.filter(r => {
        const dt = new Date(String(r?.date || ''));
        if (Number.isNaN(dt.getTime())) return false;
        const diff = now - dt;
        return diff >= 0 && diff <= 30 * dayMs;
      }).length;
      const latestEntry = (() => {
        if (!dataSet.length) return null;
        const sortedDate = [...dataSet]
          .filter(r => r?.date)
          .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) * -1);
        if (sortedDate.length) return sortedDate[0];
        const sortedVers = [...dataSet].sort((a, b) => compareVersion(b?.version, a?.version));
        return sortedVers[0] || null;
      })();
      const ageDays = (() => {
        if (!latestEntry?.date) return null;
        const dt = new Date(String(latestEntry.date));
        if (Number.isNaN(dt.getTime())) return null;
        return Math.max(0, Math.round((now - dt) / dayMs));
      })();
      return {
        theme: currentTheme || 'default',
        total,
        stableTotal,
        stablePct: total ? Math.round((stableTotal / total) * 100) : 0,
        last30Count,
        last30Pct: total ? Math.round((last30Count / total) * 100) : 0,
        latest: latestEntry,
        ageDays,
      };
    };

    const updateMetrics = (list) => {
      if (!releaseCount || !stableCount || !latestVersion) return;
      const summary = summarizeMetrics(list);
      const total = summary.total;
      releaseCount.textContent = total;
      stableCount.textContent = summary.stableTotal;
      const recentPct = Math.min(100, summary.last30Pct);
      if (releaseRecentBar) releaseRecentBar.value = recentPct;
      if (releaseTrend) {
        const last30Label = AppState.getTranslation?.('release.last_30_days') || 'Last 30 days';
        releaseTrend.textContent = `${last30Label}: ${summary.last30Count} (${recentPct}%)`;
      }
      if (stableRatioBar) stableRatioBar.value = Math.min(100, summary.stablePct);
      if (stableTrend) stableTrend.textContent = `${AppState.getTranslation?.('release.stable') || 'Stable'}: ${summary.stablePct}%`;
      if (summary.latest?.version) latestVersion.textContent = summary.latest.version; else latestVersion.textContent = '-';
      if (releaseLatestDate) {
        if (summary.latest?.date) {
          const label = AppState.getTranslation?.('release.released_on') || 'Released on';
          releaseLatestDate.textContent = `${label} ${summary.latest.date}`;
        } else {
          releaseLatestDate.textContent = '—';
        }
      }
      if (releaseAge) {
        if (summary.ageDays == null) {
          releaseAge.textContent = '—';
        } else {
          const diffDays = summary.ageDays;
          const lang = (AppState.language || 'en').toLowerCase().split('-')[0];
          if (diffDays === 0) {
            releaseAge.textContent = lang === 'tr' ? 'Bugün yayınlandı' : lang === 'de' ? 'Heute veröffentlicht' : 'Released today';
          } else {
            const dayWord = lang === 'tr' ? 'gün' : lang === 'de' ? 'Tagen' : 'days';
            if (lang === 'tr') releaseAge.textContent = `${diffDays} ${dayWord} önce`;
            else if (lang === 'de') releaseAge.textContent = `Vor ${diffDays} ${dayWord}`;
            else releaseAge.textContent = `${diffDays} ${dayWord} ago`;
          }
        }
      }
      return summary;
    };

    function renderRows(data) {
      let benchStart = null;
      try {
        if (window.__RM_BENCHMARK__ === 'render') {
          benchStart = performance.now();
        }
      } catch {}
      const tableEl = theadRow && theadRow.closest ? theadRow.closest('table') : null;
      const wrapEl = tableWrap;
      try {
        if (wrapEl && wrapEl.__rmVirtCleanup) {
          wrapEl.__rmVirtCleanup();
          wrapEl.__rmVirtCleanup = null;
        }
      } catch {}
      const useCards = resolveCardView();
      cardLayoutActive = useCards;
      if (tableWrap) {
        if (useCards) {
          tableWrap.classList.add('hidden');
        } else {
          tableWrap.classList.remove('hidden');
          requestAnimationFrame(() => animateReveal(tableWrap));
        }
      }
      if (cardList) {
        if (useCards) {
          cardList.classList.remove('hidden');
          requestAnimationFrame(() => animateReveal(cardList));
        } else {
          cardList.classList.add('hidden');
          cardList.innerHTML = '';
        }
      }
      if (useCards) {
        try { tableEl?.setAttribute('aria-hidden', 'true'); } catch {}
        try { tableEl?.removeAttribute('aria-busy'); } catch {}
      } else {
        try { tableEl?.removeAttribute('aria-hidden'); } catch {}
        try { tableEl?.setAttribute('aria-busy', 'true'); } catch {}
      }
      tableBody.innerHTML = '';
      if (cardList && useCards) cardList.innerHTML = '';
      if (!data.length) {
        noResults.classList.remove('hidden');
        tableWrap?.classList.add('hidden');
        cardList?.classList.add('hidden');
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        try { pageInfo.textContent = '0-0 / 0'; } catch {}
        updateSelBar();
        return;
      }
      noResults.classList.add('hidden');
      tableWrap?.classList.remove('hidden');
      const rowsAll = applySort(data);
      const total = rowsAll.length;
      const isVirtual = !useCards && (pageSizeSel?.value === 'All');
      let start = 0;
      let end = total;
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
      const rows = isVirtual ? rowsAll : rowsAll.slice(start, end);
      const pageRangeStart = total ? (isVirtual ? 1 : start + 1) : 0;
      const pageRangeEnd = isVirtual ? total : end;
      try { pageInfo.textContent = `${pageRangeStart}-${pageRangeEnd} / ${total}`; } catch {}
      updateMetrics(data);
      const renderCardList = (list) => {
        if (!cardList) return;
        const searchTerm = (searchFilter?.value || '').trim();
        const selectLabel = escapeHtml(AppState.getTranslation?.('release.select') || 'Select');
        const copyLabel = escapeHtml(AppState.getTranslation?.('release.copy') || 'Copy');
        const modulesTitle = escapeHtml(AppState.getTranslation?.('release.modules') || 'Modules');
        const filterByLabel = escapeHtml(AppState.getTranslation?.('release.filter_by') || 'Filter by');
        const jsonLabel = escapeHtml(AppState.getTranslation?.('release.export_json') || 'Export JSON');
        const mdLabel = escapeHtml(AppState.getTranslation?.('release.export_md') || 'Export MD');
        const detailsBase = AppState.getTranslation?.('release.open_details') || 'Open details for';
        const frag = document.createDocumentFragment();
        list.forEach((r) => {
          const versionText = String(r.version || '');
          const versionDisplay = versionText || '-';
          const versionEsc = escapeHtml(versionDisplay);
          const versionAttr = escapeHtml(versionText);
          const desc = resolveDesc(r);
          const verrs = validateRelease(r);
          const modNames = computeReleaseModules(r);
          const schemaBadge = verrs.length ? `<span class="ml-2 text-[10px] px-1.5 py-[1px] rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100">Schema</span>` : '';
          const statusKey = sanitizeToken(r.status);
          const statusClass = `rm-release-card__status rm-status-badge rm-status-${statusKey}`;
          const statusLabel = escapeHtml(r.status || '-');
          const metaParts = [];
          if (r.date) metaParts.push(`<span>${escapeHtml(r.date)}</span>`);
          const timeStr = formatTime(r);
          if (timeStr) metaParts.push(`<span>${escapeHtml(timeStr)}</span>`);
          if (r.author) metaParts.push(`<span>${highlightText(r.author, searchTerm)}</span>`);
          const metaHtml = metaParts.length ? metaParts.join(' • ') : '<span class="opacity-60">—</span>';
          const descHtml = desc ? highlightText(desc, searchTerm) : '<span class="opacity-60">—</span>';
          const modulesHtml = modNames.length
            ? modNames.map((n) => {
                const raw = String(n ?? '');
                const hash = [...raw].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
                const c = (hash % 8) + 1;
                const safe = escapeHtml(raw);
                return `<button type="button" class="js-mod-chip inline-flex items-center gap-1 text-[11px] px-2 py-[2px] rounded rm-chip-${c} hover:opacity-90" data-mod="${safe}" title="${filterByLabel} ${safe}">${safe}<span class="opacity-70 js-mod-ver" data-mod="${safe}"></span></button>`;
              }).join('')
            : '<span class="opacity-60">—</span>';
          const detailsLabel = escapeHtml(`${detailsBase} v${versionDisplay}`);
          const card = document.createElement('article');
          card.className = 'rm-release-card';
          card.dataset.version = versionText;
          if (selected.has(versionText)) card.classList.add('rm-release-card--selected');
          card.innerHTML = `
            <header class="rm-release-card__head">
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <button type="button" class="rm-release-card__title js-open-card focus-visible:ring-2 focus-visible:ring-blue-500 rounded" data-version="${versionAttr}" aria-label="${detailsLabel}">v${versionEsc}</button>
                  ${schemaBadge}
                </div>
                <div class="rm-release-card__meta">${metaHtml}</div>
              </div>
              <div class="rm-release-card__select text-right">
                <span class="${statusClass}">${statusLabel}</span>
                <label class="inline-flex items-center gap-2 mt-3 justify-end">
                  <input type="checkbox" class="js-row-sel" data-version="${versionAttr}" ${selected.has(versionText) ? 'checked' : ''} />
                  <span>${selectLabel}</span>
                </label>
              </div>
            </header>
            <div class="rm-release-card__desc">${descHtml}</div>
            <div class="rm-release-card__modules">${modulesHtml}</div>
            <footer class="rm-release-card__footer">
              <span>${modulesTitle}: ${modNames.length}</span>
              <div class="rm-release-card__actions">
                <button type="button" class="js-row-json" data-version="${versionAttr}" title="${jsonLabel}"><span class="rm-ico rm-ico-json" aria-hidden="true"></span>${jsonLabel}</button>
                <button type="button" class="js-row-md" data-version="${versionAttr}" title="${mdLabel}"><span class="rm-ico rm-ico-md" aria-hidden="true"></span>${mdLabel}</button>
                <button type="button" class="js-row-copy" data-version="${versionAttr}" title="${copyLabel}"><span class="rm-ico rm-ico-link" aria-hidden="true"></span>${copyLabel}</button>
              </div>
            </footer>`;
          frag.appendChild(card);
        });
        cardList.appendChild(frag);
        (async () => {
          try {
            const spans = Array.from(cardList.querySelectorAll('.js-mod-ver'));
            const names = Array.from(new Set(spans
              .map(el => el.getAttribute('data-mod'))
              .map(n => (n || '').trim())
              .filter(n => n && n !== '—' && !/undefined/i.test(n))));
            const versions = new Map();
            await Promise.all(names.map(async (n) => { const v = await getModuleVersion(n); if (v) versions.set(n, v); }));
            spans.forEach(el => {
              const raw = (el.getAttribute('data-mod') || '').trim();
              const candidates = [raw,
                raw.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
              ];
              const match = candidates.find(c => versions.has(c));
              if (match) el.textContent = ' v' + versions.get(match);
            });
          } catch {}
        })();
        try { tableEl?.removeAttribute('aria-busy'); } catch {}
      };
      if (useCards) {
        renderCardList(rows);
        return;
      }

      const frag = document.createDocumentFragment();
      const buildRow = (r) => {
        const tr = document.createElement('tr');
        tr.className = 'rm-table-row align-middle';
        tr.setAttribute('role','row');
        tr.setAttribute('tabindex','-1');
        tr.dataset.version = String(r.version || '');
        const statusKey = sanitizeToken(r.status);
        const statusClass = `rm-status-badge rm-status-${statusKey}`;
        const desc = resolveDesc(r);
        const modNames = computeReleaseModules(r);
        const verrs = validateRelease(r);
        const versionText = String(r.version || '');
        const versionDisplay = escapeHtml(versionText);
        const versionAttr = escapeHtml(versionText);
        const dateSafe = escapeHtml(r.date || '');
        const timeSafe = escapeHtml(formatTime(r) || '');
        const tds = [];
        tds.push(`
          <th scope="row" class="px-4 py-2 font-semibold text-blue-700 dark:text-blue-400 sticky left-0 bg-white dark:bg-gray-800 whitespace-nowrap">
            <button
              type="button"
              class="js-open-details underline decoration-dotted text-left focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              data-version="${versionAttr}">v${versionDisplay}</button>
            ${verrs.length ? `<span title=\"${AppState.getTranslation?.('release.invalid_entry') || 'Invalid entry'}\" class=\"ml-2 inline-block align-middle text-[10px] px-1.5 py-[1px] rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100\">! Schema</span>` : ''}
          </th>`);
        const searchTerm = (searchFilter?.value || '').trim();
        colOrder.forEach(k => {
          if (k==='date') tds.push(`<td data-key="date" class="px-4 py-2 dark:text-gray-300 ${visible.date ? '' : 'hidden'}"><div>${dateSafe}</div><div class="text-[10px] opacity-70">${timeSafe}</div></td>`);
          else if (k==='status') tds.push(`<td data-key="status" class="px-4 py-2 ${visible.status ? '' : 'hidden'}"><span class="${statusClass}">${escapeHtml(r.status || '-')}</span></td>`);
          else if (k==='author') tds.push(`<td data-key="author" class="px-4 py-2 dark:text-gray-300 ${visible.author ? '' : 'hidden'}">${highlightText(r.author, searchTerm)}</td>`);
          else if (k==='modules') {
            const filterLabel = escapeHtml(AppState.getTranslation?.('release.filter_by') || 'Filter by');
            const modulesCell = modNames.length
              ? modNames.map(n => {
                  const raw = String(n ?? '');
                  const hash = [...raw].reduce((a,c)=> (a*31 + c.charCodeAt(0))>>>0,0);
                  const c = (hash%8)+1;
                  const safe = escapeHtml(raw);
                  const title = `${filterLabel} ${safe}`;
                  return `<button type=\"button\" class=\"js-mod-chip inline-flex items-center gap-1 text-[11px] px-2 py-[2px] rounded rm-chip-${c} hover:opacity-90 mr-1 mb-1\" data-mod=\"${safe}\" title=\"${title}\">${safe}<span class=\"opacity-70 js-mod-ver\" data-mod=\"${safe}\"></span></button>`;
                }).join('')
              : '—';
            tds.push(`<td data-key="modules" class="px-4 py-2 dark:text-gray-300 ${visible.modules ? '' : 'hidden'}">${modulesCell}</td>`);
          }
          else if (k==='description') tds.push(`<td data-key="description" class="px-4 py-2 dark:text-gray-300 ${visible.description ? '' : 'hidden'} whitespace-nowrap overflow-hidden text-ellipsis">${highlightText(desc, searchTerm)}</td>`);
        });
        tr.innerHTML = tds.join('');
        try {
          const th = tr.querySelector('th[scope="row"]');
          const link = tr.querySelector('.js-open-details');
          if (th && link) {
            const label = document.createElement('label');
            label.className = 'inline-flex items-center gap-2';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'js-row-sel align-middle';
            cb.setAttribute('data-version', String(r.version));
            if (selected.has(String(r.version))) cb.checked = true;
            label.appendChild(cb);
            label.appendChild(link);
            th.insertBefore(label, th.firstChild);
          }
        } catch {}
        try {
          if (selected.has(String(r.version))) {
            try { tr.classList.add('rm-row-checked'); } catch {}
            try { tr.setAttribute('aria-selected','true'); } catch {}
          } else {
            try { tr.setAttribute('aria-selected','false'); } catch {}
          }
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
        const wrapper = wrapEl;
        if (!wrapper) {
          rows.forEach(r => frag.appendChild(buildRow(r)));
          tableBody.appendChild(frag);
        } else {
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
            const topTr = document.createElement('tr');
            topTr.className = 'rm-spacer-row';
            const topTd = document.createElement('td'); topTd.colSpan = (1 + colOrder.length + 1); topTd.style.padding = '0'; topTd.style.border = '0'; topTd.style.height = topPad + 'px'; topTr.appendChild(topTd);
            local.appendChild(topTr);
            for (let i=startIdx; i<endIdx; i++) local.appendChild(buildRow(rowsAll[i]));
            const botTr = document.createElement('tr');
            botTr.className = 'rm-spacer-row';
            const botTd = document.createElement('td'); botTd.colSpan = (1 + colOrder.length + 1); botTd.style.padding = '0'; botTd.style.border = '0'; botTd.style.height = botPad + 'px'; botTr.appendChild(botTd);
            local.appendChild(botTr);
            tableBody.innerHTML = '';
            tableBody.appendChild(local);
            try { pageInfo.textContent = `${total ? (startIdx + 1) : 0}-${endIdx} / ${total}`; } catch {}
            try {
              const rowsVis = Array.from(tableBody.querySelectorAll('tr:not(.rm-spacer-row)'));
              if (rowsVis.length) {
                const sum = rowsVis.reduce((s, r) => s + (r.getBoundingClientRect().height || 0), 0);
                const avg = Math.max(1, Math.round(sum / rowsVis.length));
                if (Math.abs(avg - rowH) > 1) { rowH = avg; renderWindow(); return; }
              }
            } catch {}
            (async () => {
              try {
                const spans = Array.from(tableBody.querySelectorAll('.js-mod-ver'));
                const names = Array.from(new Set(spans
                  .map(el => el.getAttribute('data-mod'))
                  .map(n => (n || '').trim())
                  .filter(n => n && n !== '—' && !/undefined/i.test(n))));
                const versions = new Map();
                await Promise.all(names.map(async (n) => { const v = await getModuleVersion(n); if (v) versions.set(n, v); }));
                spans.forEach(el => {
                  const raw = (el.getAttribute('data-mod') || '').trim();
                  const candidates = [raw,
                    raw.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
                  ];
                  const match = candidates.find(c => versions.has(c));
                  if (match) el.textContent = ' v' + versions.get(match);
                });
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
      try {
        if (benchStart != null) {
          const elapsed = Math.round(performance.now() - benchStart);
          const key = 'RM_BENCH_RENDER_MS';
          const prev = Number(sessionStorage.getItem(key) || 0);
          if (!prev || elapsed < prev) sessionStorage.setItem(key, String(elapsed));
          updateBenchInfo(elapsed);
          console.info('[RM] render benchmark', { elapsedMs: elapsed, rows: data.length });
        }
      } catch {}
      (async () => {
        const spans = Array.from(tableBody.querySelectorAll('.js-mod-ver'));
        const names = Array.from(new Set(spans
          .map(el => el.getAttribute('data-mod'))
          .map(n => (n || '').trim())
          .filter(n => n && n !== '—' && !/undefined/i.test(n))));
        const versions = new Map();
        await Promise.all(names.map(async (n) => { const v = await getModuleVersion(n); if (v) versions.set(n, v); }));
        spans.forEach(el => {
          const raw = (el.getAttribute('data-mod') || '').trim();
          const candidates = [raw,
            raw.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
          ];
          const match = candidates.find(c => versions.has(c));
          if (match) el.textContent = ' v' + versions.get(match);
        });
      })();
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
    cardList?.addEventListener('click', (e) => {
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
    window.addEventListener('resize', debounce(() => {
      const now = resolveCardView();
      if (now !== cardLayoutActive) {
        renderRows(filterData());
      }
    }, 200));
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
      const mobile = isMobileFilters();
      setToggleAria(mobile ? filtersOpen : true);
    }
    const onFilterChange = debounce(() => { renderRows(filterData()); updateSelBar(); updateFilterBadge(); if (autoLink) encodeStateToHash(); }, 200);

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
    // Selection events
    let lastSelIndex = -1;
    tableBody.addEventListener('click', (e) => {
      const cb = e.target && e.target.closest && e.target.closest('.js-row-sel');
      if (cb) {
        // remember if shift was used
        if (e.shiftKey) cb.dataset.shift = '1'; else delete cb.dataset.shift;
      }
    });
    tableBody.addEventListener('change', (e) => {
      const cb = e.target && e.target.closest && e.target.closest('.js-row-sel');
      if (!cb) return;
      const v = cb.getAttribute('data-version');
      if (!v) return;
      const rowsEls = Array.from(tableBody.querySelectorAll('tr')).filter(r=>!r.classList.contains('rm-inline-details'));
      const idx = rowsEls.findIndex(r=> String(r.dataset.version||'') === String(v));
      const on = !!cb.checked;
      if (cb.dataset.shift === '1' && lastSelIndex >= 0 && idx >= 0) {
        const [a,b] = idx>lastSelIndex ? [lastSelIndex, idx] : [idx, lastSelIndex];
        for (let i=a;i<=b;i++){
          const row = rowsEls[i];
          if (!row) continue;
          const ver = String(row.dataset.version||'');
          try {
            const cbi = row.querySelector('.js-row-sel');
            if (cbi) cbi.checked = on;
          } catch {}
          if (on) { selected.add(ver); try { row.classList.add('rm-row-checked'); row.setAttribute('aria-selected','true'); } catch {} }
          else { selected.delete(ver); try { row.classList.remove('rm-row-checked'); row.setAttribute('aria-selected','false'); } catch {} }
        }
      } else {
        const row = rowsEls[idx];
        if (on) { selected.add(String(v)); try { row?.classList.add('rm-row-checked'); row?.setAttribute('aria-selected','true'); } catch {} }
        else { selected.delete(String(v)); try { row?.classList.remove('rm-row-checked'); row?.setAttribute('aria-selected','false'); } catch {} }
      }
      lastSelIndex = idx;
      updateSelBar();
    });
    cardList?.addEventListener('change', (e) => {
      const cb = e.target && e.target.closest && e.target.closest('.js-row-sel');
      if (!cb) return;
      const v = cb.getAttribute('data-version');
      if (!v) return;
      const on = !!cb.checked;
      if (on) selected.add(String(v)); else selected.delete(String(v));
      const card = cb.closest('.rm-release-card');
      if (card) card.classList.toggle('rm-release-card--selected', on);
      updateSelBar();
    });
    target.querySelector('#rmSelAll')?.addEventListener('change', (e) => {
      const on = !!e.target.checked;
      try {
        const pageOnly = !!document.getElementById('selPageOnly')?.checked;
        if (pageOnly) {
          const rowsEls = Array.from(tableBody.querySelectorAll('tr')).filter(r=>!r.classList.contains('rm-inline-details'));
          rowsEls.forEach(row => {
            const ver = String(row.dataset.version||'');
            if (on) { selected.add(ver); try { row.classList.add('rm-row-checked'); row.setAttribute('aria-selected','true'); } catch {} }
            else { selected.delete(ver); try { row.classList.remove('rm-row-checked'); row.setAttribute('aria-selected','false'); } catch {} }
            try { const cbi = row.querySelector('.js-row-sel'); if (cbi) cbi.checked = on; } catch {}
          });
        } else {
          const list = filterData();
          if (on) list.forEach(r=> selected.add(String(r.version))); else selected.clear();
        }
      } catch {}
      renderRows(filterData());
      updateSelBar();
    });
    selClear?.addEventListener('click', () => { selected.clear(); updateSelBar(); renderRows(filterData()); });
    selExportCsv?.addEventListener('click', () => {
      try {
        const list = applySort(filterData()).filter(r=> selected.has(String(r.version)));
        const fieldsOrder = ['version','date','status','author','modules','description'];
        const visibleFields = exportVisibleOnly
          ? fieldsOrder.filter(k => k==='version' ? true : (k==='modules' ? (visible.modules!==false) : (visible[k]!==false)))
          : ['version','date','status','author','description'];
        const headerLabels = {
          version: translate('release.version', 'Version'),
          date: translate('release.date', 'Date'),
          status: translate('release.status', 'Status'),
          author: translate('release.author', 'Author'),
          modules: translate('release.modules', 'Modules'),
          description: translate('release.description', 'Description')
        };
        const header = visibleFields.map(k=>headerLabels[k]).join(',');
        const rows = list.map(r=>{
          const mods = computeReleaseModules(r).join(' ');
          const desc = resolveDesc(r);
          const obj = { version:r.version, date:r.date, status:r.status, author:r.author, modules:mods, description:desc };
          return visibleFields.map(k=> csvQuote(csvSafe(obj[k]??''))).join(',');
        });
        const bom='\ufeff';
        const blob = new Blob([bom + header + '\n' + rows.join('\n')], { type:'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'release-selected.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a),100);
      } catch {}
    });
    selExportMd?.addEventListener('click', () => {
      try {
        const list = applySort(filterData()).filter(r=> selected.has(String(r.version)));
        const blob = new Blob([toMd(list)], { type:'text/markdown;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'release-selected.md'; document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a),100);
      } catch {}
    });
    selExportJson?.addEventListener('click', () => {
      try {
        const arr = applySort(filterData()).filter(r=> selected.has(String(r.version)));
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
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'release-selected.json'; document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a), 100);
      } catch {}
    });
    selCopyCsv?.addEventListener('click', async () => {
      try {
        const data = applySort(filterData()).filter(r=> selected.has(String(r.version)));
        const fields = ['version','date','status','author','modules','description'];
        const header = fields.join(',');
        const rows = data.map(r=>{
          const mods = computeReleaseModules(r).join(' ');
          const desc = resolveDesc(r);
          const obj = { version:r.version, date:r.date, status:r.status, author:r.author, modules:mods, description:desc };
          return fields.map(k=> csvQuote(csvSafe(obj[k]??''))).join(',');
        });
        const text = header + '\n' + rows.join('\n');
        const ok = await copyText(text);
        Toast?.show?.(AppState.getTranslation?.('release.copied') || 'Copied', ok?'info':'error');
      } catch {}
    });
    selCopyMd?.addEventListener('click', async () => {
      try {
        const data = applySort(filterData()).filter(r=> selected.has(String(r.version)));
        const text = toMd(data);
        const ok = await copyText(text);
        Toast?.show?.(AppState.getTranslation?.('release.copied') || 'Copied', ok?'info':'error');
      } catch {}
    });
    selCompare?.addEventListener('click', () => {
      try {
        if (selected.size!==2) return;
        const [a,b] = Array.from(selected);
        showCompare(a,b);
      } catch {}
    });
    selDelete?.addEventListener('click', () => {
      try {
        if (!selected.size) return;
        const ok = confirm(`${AppState.getTranslation?.('release.delete')||'Delete'} ${selected.size} ${AppState.getTranslation?.('release.selected')||'selected'}?`);
        if (!ok) return;
        releases = releases.filter(r=> !selected.has(String(r.version)));
        selected.clear(); updateSelBar();
        renderRows(filterData());
        markUnsaved();
      } catch {}
    });
    selInvert?.addEventListener('click', () => {
      try {
        const pageOnly = !!document.getElementById('selPageOnly')?.checked;
        if (pageOnly) {
          const rowsEls = Array.from(tableBody.querySelectorAll('tr')).filter(r=>!r.classList.contains('rm-inline-details'));
          rowsEls.forEach(row => {
            const ver = String(row.dataset.version||'');
            if (selected.has(ver)) { selected.delete(ver); try { row.classList.remove('rm-row-checked'); row.setAttribute('aria-selected','false'); } catch {} }
            else { selected.add(ver); try { row.classList.add('rm-row-checked'); row.setAttribute('aria-selected','true'); } catch {} }
            try { const cbi = row.querySelector('.js-row-sel'); if (cbi) cbi.checked = selected.has(ver); } catch {}
          });
        } else {
          const list = filterData();
          const nowSel = new Set();
          list.forEach(r => { const ver=String(r.version); if (!selected.has(ver)) nowSel.add(ver); });
          selected.clear(); nowSel.forEach(v=> selected.add(v));
        }
        renderRows(filterData());
        updateSelBar();
      } catch {}
    });
    selSelectFiltered?.addEventListener('click', () => {
      try {
        const pageOnly = !!document.getElementById('selPageOnly')?.checked;
        if (pageOnly) {
          const rowsEls = Array.from(tableBody.querySelectorAll('tr')).filter(r=>!r.classList.contains('rm-inline-details'));
          rowsEls.forEach(row => { const ver = String(row.dataset.version||''); selected.add(ver); try { row.classList.add('rm-row-checked'); row.setAttribute('aria-selected','true'); const cbi=row.querySelector('.js-row-sel'); if (cbi) cbi.checked=true; } catch {} });
        } else {
          const list = filterData(); list.forEach(r=> selected.add(String(r.version)));
        }
        renderRows(filterData()); updateSelBar();
      } catch {}
    });
    selClearFiltered?.addEventListener('click', () => {
      try {
        const pageOnly = !!document.getElementById('selPageOnly')?.checked;
        if (pageOnly) {
          const rowsEls = Array.from(tableBody.querySelectorAll('tr')).filter(r=>!r.classList.contains('rm-inline-details'));
          rowsEls.forEach(row => { const ver = String(row.dataset.version||''); selected.delete(ver); try { row.classList.remove('rm-row-checked'); row.setAttribute('aria-selected','false'); const cbi=row.querySelector('.js-row-sel'); if (cbi) cbi.checked=false; } catch {} });
        } else {
          const list = filterData(); list.forEach(r=> selected.delete(String(r.version)));
        }
        renderRows(filterData()); updateSelBar();
      } catch {}
    });
    // Empty state actions
    target.querySelector('#noResReset')?.addEventListener('click', () => resetBtn?.click());
    target.querySelector('#noResNew')?.addEventListener('click', () => newReleaseBtn?.click());
    target.querySelector('#noResSuggestStable')?.addEventListener('click', () => { try { statusFilter.value='Stable'; } catch {} onFilterChange(); });
    target.querySelector('#noResSuggest30')?.addEventListener('click', () => {
      try {
        const now=new Date(); const day=24*60*60*1000; const start=new Date(now-30*day).toISOString().slice(0,10);
        if (fromDate) fromDate.value=start;
        if (toDate) toDate.value='';
      } catch {}
      onFilterChange();
    });

    resetBtn.addEventListener('click', () => {
      versionFilter.value = '';
      if (fromDate) fromDate.value = '';
      if (toDate) toDate.value = '';
      statusFilter.value = '';
      authorFilter.value = '';
      if (moduleSelect) moduleSelect.value = '';
      searchFilter.value = '';
      try { document.getElementById('rmSelAll').checked = false; } catch {}
      try { selected.clear(); updateSelBar(); } catch {}
      // also clear active module chips
      try { moduleFilter.clear(); renderActiveMods(); } catch {}
      renderRows(releases);
      if (window.updateMainMargin) window.updateMainMargin();
      updateFilterBadge();
    });

    // Show skeleton briefly before first render
    try { const sk=document.getElementById('rmSkeleton'); if (sk) sk.classList.remove('hidden'); } catch {}
    renderRows(releases);
    try { const sk=document.getElementById('rmSkeleton'); if (sk) sk.remove(); } catch {}
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
      closeActionMenu = closePop;
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
      th.addEventListener('click', (e) => {
        try {
          const t = e.target;
          // Prevent sorting when interacting with controls inside header
          if (t && (t.closest('input,button,a,label,select,.rm-col-resizer'))) return;
        } catch {}
        toggle();
      });
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
    updateMetrics(releases);

    // 📤 CSV Export
    if (exportBtn) {
      try { exportBtn.setAttribute('title', AppState.getTranslation?.('release.export_csv') || 'Export CSV'); } catch {}
      exportBtn.addEventListener('click', () => { try {
        // Export filtrelenmiş ve sıralanmış veriler
        const data = applySort(filterData());
        const fieldsOrder = ['version','date','status','author','modules','description'];
        const visibleFields = exportVisibleOnly
          ? fieldsOrder.filter(k => k==='version' ? true : (k==='modules' ? (visible.modules!==false) : (visible[k]!==false)))
          : ['version','date','status','author','description'];
        const headerLabels = {
          version: translate('release.version', 'Version'),
          date: translate('release.date', 'Date'),
          status: translate('release.status', 'Status'),
          author: translate('release.author', 'Author'),
          modules: translate('release.modules', 'Modules'),
          description: translate('release.description', 'Description')
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
        const csvPayload = bom + header + csvHeader + "\n" + csvRows.join("\n");
        const blob = attachBlobText(new Blob([csvPayload], { type: "text/csv;charset=utf-8" }), csvPayload);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "release-log.csv";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 100);
        try { window.Telemetry?.log('rm_export', { type: 'csv', count: data.length }); } catch {}
      } catch (e) { try { Toast?.show?.(AppState.getTranslation?.('release.export_fail') || 'Export failed', 'error'); } catch {} }
      });
    }
    // Copy CSV to clipboard (visible/filtered)
    try {
      const copyCsv = document.getElementById('copyCsvBtn');
      copyCsv?.addEventListener('click', async () => {
        try {
          const data = applySort(filterData());
          const fieldsOrder = ['version','date','status','author','modules','description'];
          const visibleFields = exportVisibleOnly
            ? fieldsOrder.filter(k => k==='version' ? true : (k==='modules' ? (visible.modules!==false) : (visible[k]!==false)))
            : ['version','date','status','author','description'];
          const headerLabels = {
            version: translate('release.version', 'Version'),
            date: translate('release.date', 'Date'),
            status: translate('release.status', 'Status'),
            author: translate('release.author', 'Author'),
            modules: translate('release.modules', 'Modules'),
            description: translate('release.description', 'Description')
          };
          const header = visibleFields.map(k => headerLabels[k]).join(',');
          const rows = data.map(r => {
            const desc = resolveDesc(r);
            const mods = computeReleaseModules(r).join(' ');
            const rowObj = { version: r.version, date: r.date, status: r.status, author: r.author, modules: mods, description: desc };
            return visibleFields.map(k => csvQuote(csvSafe(rowObj[k] ?? ''))).join(',');
          });
          const text = header + '\n' + rows.join('\n');
          const ok = await copyText(text);
          Toast?.show?.(AppState.getTranslation?.('release.copied') || 'Copied', ok?'info':'error');
        } catch {}
      });
    } catch {}

    
    // Export JSON (filtered + sorted)
    if (exportJsonBtn) {
      try { exportJsonBtn.setAttribute('title', AppState.getTranslation?.('release.export_json') || 'Export JSON'); } catch {}
      exportJsonBtn.addEventListener('click', () => { try {
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
        const jsonPayload = JSON.stringify(data, null, 2);
        const blob = attachBlobText(new Blob([jsonPayload], { type: 'application/json' }), jsonPayload);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = exportVisibleOnly ? 'release-log.visible.json' : 'release-log.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
        try { window.Telemetry?.log('rm_export', { type: exportVisibleOnly?'json-visible':'json', count: arr.length }); } catch {}
      } catch (e) { try { Toast?.show?.(AppState.getTranslation?.('release.export_fail') || 'Export failed', 'error'); } catch {} }
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
    const themeLabel = (value) => {
      if (value === 'contrast') return AppState.getTranslation?.('release.theme_contrast') || 'High Contrast';
      if (value === 'brand') return AppState.getTranslation?.('release.theme_brand') || 'Brand';
      return AppState.getTranslation?.('release.theme_default') || 'Default';
    };

    const renderProgressBar = (pct) => {
      const blocks = 20;
      const filled = Math.round(Math.min(100, Math.max(0, pct)) / 100 * blocks);
      const bar = '#'.repeat(filled) + '-'.repeat(blocks - filled);
      return `[${bar}]`;
    };

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
      const summary = summarizeMetrics(arr);
      if (summary) {
        lines.push(`> Theme: ${themeLabel(summary.theme)} | Total: ${summary.total} | Stable: ${summary.stableTotal} (${summary.stablePct}%)`);
        lines.push(`> Last 30 days: ${summary.last30Count} (${summary.last30Pct}%) ${renderProgressBar(summary.last30Pct)}`);
        if (summary.latest?.date) {
          lines.push(`> Latest release: v${summary.latest.version || '-'} on ${summary.latest.date} (${summary.ageDays == null ? 'n/a' : summary.ageDays + ' days ago'})`);
        }
        lines.push('');
      }
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

    const toHtmlReport = (arr) => {
      const summary = summarizeMetrics(arr);
      const themeName = themeLabel(summary?.theme || 'default');
      const rows = arr.map(r => {
        const mods = computeReleaseModules(r).join(', ') || '—';
        const desc = escapeHtml(resolveDesc(r) || '-');
        return `
          <tr>
            <td>v${escapeHtml(r.version || '-')}</td>
            <td>${escapeHtml(r.date || '-')}</td>
            <td>${escapeHtml(r.status || '-')}</td>
            <td>${escapeHtml(r.author || '-')}</td>
            <td>${escapeHtml(mods)}</td>
            <td>${desc}</td>
          </tr>`;
      }).join('');
      const metrics = summary ? `
        <div class="metric-cards">
          <div class="metric-card">
            <h3>Total</h3>
            <p class="metric-value">${summary.total}</p>
            <p class="metric-sub">Last 30 days: ${summary.last30Count} (${summary.last30Pct}%)</p>
            <progress class="metric-progress" role="presentation" max="100" value="${Math.min(100, summary.last30Pct)}"></progress>
          </div>
          <div class="metric-card">
            <h3>Stable</h3>
            <p class="metric-value">${summary.stableTotal}</p>
            <p class="metric-sub">${summary.stablePct}% of total</p>
            <progress class="metric-progress metric-progress--green" role="presentation" max="100" value="${Math.min(100, summary.stablePct)}"></progress>
          </div>
          <div class="metric-card">
            <h3>Latest</h3>
            <p class="metric-value">${summary.latest?.version ? 'v'+escapeHtml(summary.latest.version) : '-'}</p>
            <p class="metric-sub">${summary.latest?.date ? escapeHtml(summary.latest.date) : '—'}${summary.ageDays != null ? ` · ${summary.ageDays} day(s) ago` : ''}</p>
          </div>
        </div>` : '';
      return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Release Report</title>
    <style>
      body{font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:32px;color:#0f172a}
      h1{margin:0 0 24px;font-size:28px}
      .meta{margin-bottom:24px;color:#475569;font-size:14px}
      .metric-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:32px}
      .metric-card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 10px 30px rgba(15,23,42,.1)}
      .metric-card h3{margin:0;font-size:14px;text-transform:uppercase;letter-spacing:.12em;color:#6366f1}
      .metric-value{font-size:28px;font-weight:700;margin:8px 0}
      .metric-sub{margin:0;color:#64748b;font-size:13px}
      .metric-progress{margin-top:12px;width:100%;height:6px;appearance:none;-webkit-appearance:none;background:rgba(99,102,241,.25);border:none;border-radius:999px;overflow:hidden}
      .metric-progress::-webkit-progress-bar{background:rgba(99,102,241,.25);border-radius:999px}
      .metric-progress::-webkit-progress-value{background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:999px}
      .metric-progress::-moz-progress-bar{background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:999px}
      .metric-progress--green{background:rgba(16,185,129,.24)}
      .metric-progress--green::-webkit-progress-bar{background:rgba(16,185,129,.24)}
      .metric-progress--green::-webkit-progress-value{background:linear-gradient(90deg,#34d399,#22c55e)}
      .metric-progress--green::-moz-progress-bar{background:linear-gradient(90deg,#34d399,#22c55e)}
      table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08)}
      th,td{padding:12px 16px;text-align:left;font-size:14px;vertical-align:top;border-bottom:1px solid #e2e8f0}
      th{background:#f1f5f9;text-transform:uppercase;font-size:12px;letter-spacing:.08em;color:#475569}
      tr:last-child td{border-bottom:none}
      .footer{margin-top:24px;font-size:12px;color:#94a3b8;text-align:right}
    </style>
  </head>
  <body>
    <h1>Release Report</h1>
    <div class="meta">Generated: ${new Date().toISOString()} · Theme: ${escapeHtml(themeName)}</div>
    ${metrics}
    <table>
      <thead>
        <tr><th>Version</th><th>Date</th><th>Status</th><th>Author</th><th>Modules</th><th>Description</th></tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6">No data</td></tr>'}</tbody>
    </table>
    <div class="footer">Release Management · HTML export</div>
  </body>
</html>`;
    };
    if (exportMdBtn) {
      try { exportMdBtn.setAttribute('title', AppState.getTranslation?.('release.export_md') || 'Export Markdown'); } catch {}
      exportMdBtn.addEventListener('click', () => { try {
        const data = applySort(filterData());
        const blob = new Blob([toMd(data)], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'CHANGELOG.md';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
        try { window.Telemetry?.log('rm_export', { type: 'md', count: data.length }); } catch {}
      } catch (e) { try { Toast?.show?.(AppState.getTranslation?.('release.export_fail') || 'Export failed', 'error'); } catch {} }
      });
    }
    if (exportHtmlBtn) {
      try { exportHtmlBtn.setAttribute('title', AppState.getTranslation?.('release.export_html_hint') || 'Download themed HTML report'); } catch {}
      exportHtmlBtn.addEventListener('click', () => {
        try {
          const data = applySort(filterData());
          const html = toHtmlReport(data);
          const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'release-report.html';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 100);
          try { window.Telemetry?.log('rm_export', { type: 'html', count: data.length }); } catch {}
        } catch (e) {
          try { Toast?.show?.(AppState.getTranslation?.('release.export_fail') || 'Export failed', 'error'); } catch {}
        }
      });
    }
    // Copy Markdown to clipboard (visible/filtered)
    try {
      const copyMd = document.getElementById('copyMdBtnClip');
      copyMd?.addEventListener('click', async () => {
        try {
          const data = applySort(filterData());
          const text = toMd(data);
          const ok = await copyText(text);
          Toast?.show?.(AppState.getTranslation?.('release.copied') || 'Copied', ok?'info':'error');
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
      const summary = summarizeMetrics(arr);
      if (summary) {
        lines.push(`> Theme: ${themeLabel(summary.theme)} | Total: ${summary.total} | Stable: ${summary.stableTotal} (${summary.stablePct}%)`);
        lines.push(`> Last 30 days: ${summary.last30Count} (${summary.last30Pct}%) ${renderProgressBar(summary.last30Pct)}`);
        lines.push('');
      }
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
      exportMdPublicBtn.addEventListener('click', () => { try {
        const data = applySort(filterData());
        const blob = new Blob([toMdPublic(data)], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'RELEASE_NOTES.md';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
        try { window.Telemetry?.log('rm_export', { type: 'md-public', count: data.length }); } catch {}
      } catch (e) { try { Toast?.show?.(AppState.getTranslation?.('release.export_fail') || 'Export failed', 'error'); } catch {} }
      });
    }

    // Details drawer
    const findRelease = (version) => releases.find(r => String(r.version) === String(version));
    let _prevFocus = null;

    // Inline details (mobile-first)
    function closeInlineDetails(){
      try { tableBody?.querySelectorAll('tr.rm-inline-details')?.forEach(r => r.remove()); } catch {}
    }
    const getPrevRelease = (cur) => {
      try {
        const sorted = [...releases].sort((a,b)=> compareVersion(b.version, a.version));
        const idx = sorted.findIndex(x => String(x.version) === String(cur.version));
        return idx >= 0 ? sorted[idx+1] : null;
      } catch { return null; }
    };

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
      const versionSafe = escapeHtml(rel.version || '-');
      const dateSafe = escapeHtml(rel.date || '');
      const statusSafe = escapeHtml(rel.status || '');
      const authorSafe = escapeHtml(rel.author || '-');
      const schemaWarn = errs.length ? `<div class=\"rm-inline-warn\">Schema: ${errs.map(escapeHtml).join(', ')}</div>` : '';
      td.innerHTML = `
        <div class="rm-inline-card">
          <div class="rm-inline-head">
            <strong>v${versionSafe}</strong>
            <span>${dateSafe}</span>
            <span>${statusSafe}</span>
            <button type="button" class="rm-inline-close" aria-label="Close">×</button>
          </div>
          <div class="rm-inline-body">
            <div class="rm-inline-row"><span>Author:</span> ${authorSafe}</div>
            <div class="rm-inline-row"><span>${AppState.getTranslation?.('release.description') || 'Description'}:</span> ${escapeHtml(desc || '-')}</div>
            ${schemaWarn}
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
      td.querySelector('.js-inline-copy-md')?.addEventListener('click', async () => {
        try {
          const d = resolveDesc(rel);
          const md = `## v${rel.version} - ${rel.date||'-'} (${rel.status||'-'})\n- Author: ${rel.author||'-'}\n- ${d||''}\n`;
          const ok = await copyText(md); Toast?.show?.('Copied', ok?'info':'error');
        } catch {}
      });
      td.querySelector('.js-inline-copy-txt')?.addEventListener('click', async () => {
        try {
          const d = resolveDesc(rel);
          const text = `v${rel.version} — ${rel.date||'-'} — ${rel.status||'-'}\n${d||''}`;
          const ok = await copyText(text); Toast?.show?.('Copied', ok?'info':'error');
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
        let replaced = false;
        try {
          if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState(null, '', nh);
            replaced = true;
          }
        } catch {}
        try {
          if (!replaced || location.hash !== nh) {
            location.hash = nh;
          }
        } catch {}
      } catch {}
    };
    const openDetails = (rel) => {
      if (!rel) return;
      // Reflect selection in URL (?v=<version>) and clear compare before heavy DOM ops
      setHashParam('cmp', null);
      setHashParam('v', rel.version);
      const details = ensureDetails();
      try { details.setAttribute('role','dialog'); details.setAttribute('aria-modal','true'); details.setAttribute('aria-labelledby','rmDetailsTitle'); details.style.display = 'flex'; } catch {}
      const detailsBody = details.querySelector('#detailsBody');
      detailsBody?.classList?.add('rm-scope');
      syncThemeAttr(detailsBody, currentTheme);
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
      const versionLabel = AppState.getTranslation?.('release.version') || 'Version';
      const dateLabel = AppState.getTranslation?.('release.date') || 'Date';
      const statusLabel = AppState.getTranslation?.('release.status') || 'Status';
      const authorLabel = AppState.getTranslation?.('release.author') || 'Author';
      const modulesLabel = AppState.getTranslation?.('release.modules') || 'Modules';
      const modNames = computeReleaseModules(rel);
      const detailRow = (icon, label, value, opts = {}) => {
        const safeLabel = escapeHtml(label);
        const body = opts.raw ? value : escapeHtml(value ?? '-');
        return `
          <div class="rm-detail-item">
            <span class="rm-detail-icon rm-detail-icon-${icon}" aria-hidden="true"></span>
            <div>
              <div class="rm-detail-label">${safeLabel}</div>
              <div class="rm-detail-value">${body || '—'}</div>
            </div>
          </div>`;
      };
      const statusKey = sanitizeToken(rel.status);
      const statusBadge = `<span class="rm-detail-status" data-status="${statusKey}">${escapeHtml(rel.status || '-')}</span>`;
      const moduleChips = modNames.length
        ? modNames.map(n => {
            const safe = escapeHtml(n);
            return `<button type="button" class="js-mod-chip rm-detail-chip" data-mod="${safe}">${safe}</button>`;
          }).join('')
        : '';
      const diffBlock = (() => {
        const prev = getPrevRelease(rel);
        const prevDesc = prev ? resolveDesc(prev) : '';
        if (!(prev && prevDesc && prevDesc !== desc)) return '';
        try {
          const { aHtml, bHtml } = diffHighlight(prevDesc, desc);
          const accId = `acc-desc-${String(rel.version).replace(/[^a-z0-9_\-]/gi,'_')}`;
          return `
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
        } catch { return ''; }
      })();
      const detailGrid = `
        <div class="rm-detail-grid">
          ${detailRow('version', versionLabel, rel.version ? `v${rel.version}` : '-')}
          ${detailRow('date', dateLabel, rel.date || '-')}
          ${detailRow('status', statusLabel, statusBadge, { raw: true })}
          ${detailRow('author', authorLabel, rel.author || '-')}
        </div>`;
      const moduleSection = moduleChips
        ? `<div class="rm-detail-section"><div class="rm-detail-section-label">${escapeHtml(modulesLabel)}</div><div class="rm-detail-chips">${moduleChips}</div></div>`
        : `<div class="rm-detail-section"><div class="rm-detail-section-label">${escapeHtml(modulesLabel)}</div><div class="rm-detail-muted">—</div></div>`;
      const highlightLabel = AppState.getTranslation?.('release.highlights') || 'Highlights';
      const catsBlock = cats && cats.length
        ? `<div class="rm-detail-section"><div class="rm-detail-section-label">${escapeHtml(highlightLabel)}</div><div class="rm-detail-list">${cats.map(c=>`<span class="rm-detail-chip rm-detail-chip--neutral">${escapeHtml(c)}</span>`).join('')}</div></div>`
        : '';
      const countsLabel = AppState.getTranslation?.('release.counts') || 'Counts';
      const countsBlock = (counts && (counts.added||counts.modified||counts.removed))
        ? `<div class="rm-detail-section"><div class="rm-detail-section-label">${escapeHtml(countsLabel)}</div><div class="rm-detail-metrics"><span class="rm-pill rm-pill-add">+${counts.added||0}</span><span class="rm-pill rm-pill-mod">~${counts.modified||0}</span><span class="rm-pill rm-pill-del">-${counts.removed||0}</span></div></div>`
        : '';
      const filesMarkup = renderFiles(rel);
      const filesLabel = AppState.getTranslation?.('release.files') || 'Files';
      const filesBlock = filesMarkup && filesMarkup.trim()
        ? `<div class="rm-detail-section"><div class="rm-detail-section-label">${escapeHtml(filesLabel)}</div><div class="rm-detail-files">${filesMarkup}</div></div>`
        : '';
      const impactTag = rel.impact ? `<span class="rm-detail-tag rm-detail-tag--impact">${escapeHtml(rel.impact)}</span>` : '';
      const riskLevel = String(rel.risk || '').toLowerCase();
      const riskTag = rel.risk ? `<span class="rm-detail-tag rm-detail-tag--risk-${riskLevel}">${escapeHtml(rel.risk)}</span>` : '';
      const attributesLabel = AppState.getTranslation?.('release.attributes') || 'Attributes';
      const attributesBlock = (impactTag || riskTag)
        ? `<div class="rm-detail-section"><div class="rm-detail-section-label">${escapeHtml(attributesLabel)}</div><div class="rm-detail-tags">${impactTag}${riskTag}</div></div>`
        : '';
      const descLabel = AppState.getTranslation?.('release.description_internal') || 'Description (Internal)';
      const qualityNote = rel.quality === 'auto'
        ? `<div class="rm-detail-note">${AppState.getTranslation?.('release.auto_generated') || 'Auto-generated — review and mark as Final when ready.'}</div>`
        : '';
      const descBlock = `<div class="rm-detail-section"><div class="rm-detail-section-label">${escapeHtml(descLabel)}</div><div class="rm-detail-description">${escapeHtml(desc || '-')}</div>${qualityNote}</div>`;
      const publicDescLabel = AppState.getTranslation?.('release.description_public') || 'Description (Public)';
      const publicDesc = rel.descriptionPublic ? (rel.descriptionPublic[(AppState.language||'en').split('-')[0]] || rel.descriptionPublic.en || '') : '';
      const publicBlock = publicDesc
        ? `<div class="rm-detail-section"><div class="rm-detail-section-label">${escapeHtml(publicDescLabel)}</div><div class="rm-detail-description">${escapeHtml(publicDesc)}</div></div>`
        : '';
      const errsBlock = errs.length
        ? `<div class="rm-detail-warning">${escapeHtml((AppState.getTranslation?.('release.schema_issues') || 'Schema issues'))}: ${escapeHtml(errs.join(', '))}</div>`
        : '';
      const runbookBtn = (() => {
        if (!rel.risk && !rel.impact) return '';
        const link = rel.risk && rel.risk.toLowerCase() === 'high'
          ? (AppState.getTranslation?.('release.runbook_high') || 'https://runbook.example.com/high-risk')
          : rel.impact && rel.impact.toLowerCase() === 'critical'
            ? (AppState.getTranslation?.('release.runbook_critical') || 'https://runbook.example.com/critical-impact')
            : null;
        if (!link) return '';
        const label = AppState.getTranslation?.('release.open_runbook') || 'Open Runbook';
        return `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="rm-detail-action rm-detail-action--link">${label}</a>`;
      })();
      const actions = `
        <div class="rm-detail-actions">
          <button id="rmEdit" class="rm-detail-action">${AppState.getTranslation?.('release.edit') || 'Edit'}</button>
          ${rel.state!=='final' ? `<button id=\"rmMarkFinal\" class=\"rm-detail-action\">${AppState.getTranslation?.('release.mark_final') || 'Mark Final'}</button>` : ''}
          <button id="rmCopyLink" class="rm-detail-action">${AppState.getTranslation?.('release.copy_link') || 'Copy Link'}</button>
          ${runbookBtn}
          <button id="rmDelete" class="rm-detail-action rm-detail-action--danger">${AppState.getTranslation?.('release.delete') || 'Delete'}</button>
        </div>`;
      const summaryBlock = `
        <div class="rm-detail-summary">
          <div class="rm-detail-summary__top">
            <span class="rm-detail-summary__version">v${escapeHtml(rel.version || '-')}</span>
            ${statusBadge}
          </div>
          <div class="rm-detail-summary__meta">
            <span>${escapeHtml(rel.date || '-')}</span>
            <span>${escapeHtml(rel.author || '-')}</span>
          </div>
        </div>`;
      const layout = `
        <div class="rm-detail-layout">
          <div class="rm-detail-col rm-detail-col--main">
            ${detailGrid}
            ${descBlock}
            ${publicBlock}
            ${diffBlock}
          </div>
          <div class="rm-detail-col rm-detail-col--side">
            ${moduleSection}
            ${attributesBlock}
            ${countsBlock}
            ${catsBlock}
            ${filesBlock}
            ${errsBlock}
          </div>
        </div>`;
      detailsBody.innerHTML = [summaryBlock, layout, actions].filter(Boolean).join('');
      detailsBody.querySelectorAll('.js-mod-chip').forEach(chip => {
        chip.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const name = chip.getAttribute('data-mod');
          if (!name) return;
          if (moduleFilter.has(name)) moduleFilter.delete(name); else moduleFilter.add(name);
          saveModFilter();
          renderActiveMods();
          renderRows(filterData());
          updateFilterBadge();
          updateSelBar();
          closeDetails();
        });
      });
      const copyLinkBtn = detailsBody.querySelector('#rmCopyLink');
      copyLinkBtn?.addEventListener('click', async () => {
        try {
          const base = location.origin + location.pathname + '#/releases?v=' + encodeURIComponent(rel.version);
          const ok = await copyText(base);
          Toast?.show?.(AppState.getTranslation?.('release.link_copied') || 'Link copied', ok ? 'info' : 'error');
        } catch {}
      });
      _prevFocus = document.activeElement;
      details.classList.remove('hidden');
      try { details.style.display = 'flex'; } catch {}
      details.setAttribute('aria-modal', 'true');
      details.setAttribute('role', 'dialog');
      details.setAttribute('aria-labelledby', 'rmDetailsTitle');
      details.setAttribute('aria-describedby', 'detailsBody');
      try { document.body.classList.add('overflow-hidden'); } catch {}
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
        const copyBtn = details.querySelector('#rmCopyLink');
        copyBtn?.setAttribute?.('type','button');
        copyBtn?.setAttribute?.('aria-label', AppState.getTranslation?.('release.copy_link') || 'Copy link to release');
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
      if (e.target && e.target.closest && e.target.closest('input[type="checkbox"]')) return;
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
    cardList?.addEventListener('click', (e) => {
      if (e.target && e.target.closest && (e.target.closest('.js-row-sel') || e.target.closest('.js-mod-chip') || e.target.closest('.rm-release-card__actions'))) return;
      const btn = e.target.closest && e.target.closest('.js-open-card');
      if (btn) {
        e.preventDefault();
        const v = btn.getAttribute('data-version');
        const rel = findRelease(v);
        if (rel) openDetails(rel);
        return;
      }
      const card = e.target.closest && e.target.closest('.rm-release-card');
      if (card) {
        const v = card.getAttribute('data-version');
        const rel = findRelease(v);
        if (rel) openDetails(rel);
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
      // 'd' — quick compare (when 2 selected) or open actions > export
      if (!typing && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        try {
          if (selected && selected.size === 2) {
            const [a,b] = Array.from(selected);
            showCompare(a,b);
          } else {
            // Open actions popover and focus CSV Export for quick access
            const trigger = (actionMenuBtnMain || actionMenuBtn);
            if (trigger) {
              trigger.click();
              setTimeout(() => { try { document.getElementById('exportBtn')?.focus(); } catch {} }, 0);
            }
          }
        } catch {}
      }
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
              <li><kbd>d</kbd> — ${AppState.getTranslation?.('release.compare') || 'Compare'}</li>
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
        const cd = sp.get('cd');
        const cf = sp.get('cf');
        const state = sp.get('state');
        if (cmp && /^\d+\.\d+\.\d+\.\.\d+\.\d+\.\d+$/.test(cmp)) {
          const [a,b] = cmp.split('..');
          if (a && b) {
            showCompare(a,b);
            setTimeout(() => {
              try {
                const chk = document.querySelector('#cmpDiffOnly');
                const cfo = document.querySelector('#cmpFilesOnly');
                if (chk) { chk.checked = (cd === '1'); chk.dispatchEvent(new Event('change', { bubbles: true })); }
                if (cfo) { cfo.checked = (cf === '1'); cfo.dispatchEvent(new Event('change', { bubbles: true })); }
              } catch {}
            }, 0);
          }
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
      const pill = (txt, cls) => `<span class="text-[10px] px-2 py-[2px] rounded ${cls}">${escapeHtml(txt)}</span>`;
      const block = (title, items, cls) => items.length
        ? `<div class="mb-2">${pill(title, cls)}<ul class="ml-5 list-disc">${items.slice(0,50).map(f=>`<li>${escapeHtml(f)}</li>`).join('')}</ul></div>`
        : '';
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
      const row = (label, av, bv, key, opts = {}) => {
        const render = (val) => {
          if (opts.allowHtml) return String(val ?? '-');
          return escapeHtml(val ?? '-');
        };
        return `<tr data-k="${key||''}"><th class="text-left pr-3 py-1 text-gray-500 dark:text-gray-400">${escapeHtml(label)}</th><td class="pr-3 py-1 align-top">${render(av)}</td><td class="py-1 align-top">${render(bv)}</td></tr>`;
      };
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
          row('Description', ddesc.aHtml, ddesc.bHtml, 'description', { allowHtml: true }),
          row('Files', renderFiles(A), renderFiles(B), 'files', { allowHtml: true })
        ];
        const top = `<div class=\"mb-3 text-xs text-gray-600 dark:text-gray-300 flex flex-wrap items-center gap-3\">
            <span class=\"inline-flex items-center gap-2\"><strong>v${A.version}</strong>
              <span class=\"rm-pills\">
                <span class=\"rm-pill rm-pill-add\">+${ca.added}</span>
                <span class=\"rm-pill rm-pill-mod\">~${ca.modified}</span>
                <span class=\"rm-pill rm-pill-del\">-${ca.removed}</span>
              </span>
            </span>
            <span class=\"inline-flex items-center gap-2\"><strong>v${B.version}</strong>
              <span class=\"rm-pills\">
                <span class=\"rm-pill rm-pill-add\">+${cb.added}</span>
                <span class=\"rm-pill rm-pill-mod\">~${cb.modified}</span>
                <span class=\"rm-pill rm-pill-del\">-${cb.removed}</span>
              </span>
            </span>
          </div>`;
        const table = `
          <table class="w-full text-sm"><thead><tr><th></th><th class="text-left">v${A.version}</th><th class="text-left">v${B.version}</th></tr></thead><tbody>
            ${rows.filter(r => !filesOnly && (!diffOnly || /data-k=\"(description|files|date|status|author)\"/.test(r)) || /data-k=\"files\"/.test(r)).join('')}
          </tbody></table>`;
        compareBody.innerHTML = top + table;
        try {
          const ta = (ca.added||0)+(ca.modified||0)+(ca.removed||0);
          const tb = (cb.added||0)+(cb.modified||0)+(cb.removed||0);
          const pills = compareBody.querySelectorAll('.rm-pills');
          if (pills[0]) { const s=document.createElement('span'); s.className='rm-pill rm-pill-sum'; s.textContent='Σ'+ta; pills[0].appendChild(s); }
          if (pills[1]) { const s=document.createElement('span'); s.className='rm-pill rm-pill-sum'; s.textContent='Σ'+tb; pills[1].appendChild(s); }
          // Append dominant change type badges for Files row (A/B)
          const filesTh = compareBody.querySelector('tr[data-k="files"] > th');
          if (filesTh) {
            const dom = (g)=>{ const arr=[['added',g.added||0],['modified',g.modified||0],['removed',g.removed||0]]; arr.sort((a,b)=>b[1]-a[1]); return arr[0] && arr[0][1]>0 ? arr[0][0] : '—'; };
            const da = dom(ca), db = dom(cb);
            const pillA = document.createElement('span'); pillA.className='rm-pill rm-pill-neutral'; pillA.textContent = `A: ${da}`;
            const pillB = document.createElement('span'); pillB.className='rm-pill rm-pill-neutral'; pillB.style.marginLeft = '.25rem'; pillB.textContent = `B: ${db}`;
            const holder = document.createElement('span'); holder.className='rm-pills'; holder.style.marginLeft = '.5rem'; holder.appendChild(pillA); holder.appendChild(pillB);
            filesTh.appendChild(holder);
          }
        } catch {}
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
        // Compute totals for badges
        const cta = countFiles(A); const ctb = countFiles(B);
        const ta = (cta.added||0)+(cta.modified||0)+(cta.removed||0);
        const tb = (ctb.added||0)+(ctb.modified||0)+(ctb.removed||0);
        if (bA) { bA.textContent = `A: v${A.version} (Σ${ta})`; bA.setAttribute('aria-label', `A: v${A.version} (total ${ta})`); }
        if (bB) { bB.textContent = `B: v${B.version} (Σ${tb})`; bB.setAttribute('aria-label', `B: v${B.version} (total ${tb})`); }
      } catch {}
      compareModal.classList.remove('hidden');
      _prevFocusCompare = document.activeElement;
      try { document.body.classList.add('overflow-hidden'); } catch {}
      compareClose?.focus?.();
      try{ window.Telemetry?.log('rm_compare',{a:va,b:vb}); }catch{}
      try { setHashParam('v', null); setHashParam('cmp', `${va}..${vb}`); } catch {}
      // Copy compare link buttons (top + bottom)
      try {
        const chk = compareModal.querySelector('#cmpDiffOnly');
        const cf = compareModal.querySelector('#cmpFilesOnly');
        const buildLink = () => {
          const params = new URLSearchParams();
          params.set('cmp', `${va}..${vb}`);
          if (chk?.checked) params.set('cd','1'); else params.delete('cd');
          if (cf?.checked) params.set('cf','1'); else params.delete('cf');
          return location.origin + location.pathname + '#/releases?' + params.toString();
        };
        const attachCopy = (sel) => {
          const btn = compareModal.querySelector(sel);
          btn?.addEventListener('click', async () => {
            try { const ok = await copyText(buildLink()); Toast?.show?.(AppState.getTranslation?.('release.link_copied') || 'Link copied', ok?'info':'error'); } catch {}
          });
        };
        attachCopy('#cmpCopyLink');
        attachCopy('#cmpCopyLinkBtm');
        const apply = () => { renderCompareBody(!!chk?.checked, !!cf?.checked); try { setHashParam('cd', chk?.checked ? '1' : null); setHashParam('cf', cf?.checked ? '1' : null); } catch {} };
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
      // Expose as dialog and aria-modal
      try {
        compareModal.setAttribute('role','dialog');
        compareModal.setAttribute('aria-modal','true');
        document.body.classList.add('overflow-hidden');
      } catch {}
      // GitHub compare link (optional) with safety check
      try {
        const repo = getRepoUrl();
        if (repo && cmpGh) {
          cmpGh.href = `${repo}/compare/v${va}...v${vb}`;
          cmpGh.classList.remove('hidden');
          cmpGhHint?.classList.add('hidden');
        } else {
          cmpGh?.classList.add('hidden');
          cmpGhHint?.classList.remove('hidden');
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
    cardList?.addEventListener('click', (e) => {
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
      closeActionMenu?.();
      const isEditing = !!(initial && initial._edit);
      const modal = document.createElement('div');
      modal.className = 'rm-modal-backdrop';
      const viewportH = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0);
      const backdropPad = Math.max(16, Math.round(viewportH * 0.08));
      modal.style.paddingTop = backdropPad + 'px';
      modal.style.paddingBottom = backdropPad + 'px';
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      const stepGeneral = AppState.getTranslation?.('release.step_general') || 'General';
      const stepDesc = AppState.getTranslation?.('release.step_description') || 'Descriptions';
      const langLabelTr = AppState.getTranslation?.('release.lang.tr') || 'TR';
      const langLabelDe = AppState.getTranslation?.('release.lang.de') || 'DE';
      const langLabelEn = AppState.getTranslation?.('release.lang.en') || 'EN';
      const nextLabel = AppState.getTranslation?.('release.next') || 'Next';
      const backLabel = AppState.getTranslation?.('release.prev') || 'Back';
      const saveLabel = isEditing
        ? (AppState.getTranslation?.('release.save') || 'Save')
        : (AppState.getTranslation?.('release.add') || 'Add');
      modal.innerHTML = `
        <div class="rm-modal-shell" tabindex="-1">
          <div class="rm-modal-head">
            <div class="rm-modal-title">
              <span class="rm-modal-badge" aria-hidden="true">📝</span>
              <div>
                <h2 id="nrTitle" class="rm-modal-heading">${isEditing ? (AppState.getTranslation?.('release.edit') || 'Edit Release') : (AppState.getTranslation?.('release.new') || 'New Release')}</h2>
                <p class="rm-modal-sub">${AppState.getTranslation?.('release.new_subtitle') || 'Manually capture release metadata.'}</p>
              </div>
            </div>
            <button type="button" class="js-close rm-btn rm-btn--ghost" aria-label="${AppState.getTranslation?.('release.close') || 'Close'}">✕</button>
          </div>
          <form id="nrForm" class="rm-modal-form">
            <nav class="rm-stepper" aria-label="${AppState.getTranslation?.('release.steps') || 'Steps'}">
              <button type="button" class="rm-step is-active" data-step="1"><span class="rm-step__number">1</span>${stepGeneral}</button>
              <button type="button" class="rm-step" data-step="2"><span class="rm-step__number">2</span>${stepDesc}</button>
            </nav>
            <section class="rm-step-panel" data-step-panel="1">
              <div class="rm-step-grid">
                <label class="rm-form-field">
                  <span>${AppState.getTranslation?.('release.version') || 'Version'} <span class="rm-required">*</span></span>
                  <input required aria-required="true" id="nr_version" class="rm-input" placeholder="1.3.5" />
                  <span class="rm-field-hint">${AppState.getTranslation?.('release.version_hint') || 'Semantic version (e.g., 1.3.5)'}</span>
                </label>
                <label class="rm-form-field">
                  <span>${AppState.getTranslation?.('release.date') || 'Date'} <span class="rm-required">*</span></span>
                  <input required aria-required="true" id="nr_date" type="date" class="rm-input" />
                  <span class="rm-field-hint">${AppState.getTranslation?.('release.date_hint') || 'YYYY-MM-DD'}</span>
                </label>
                <label class="rm-form-field">
                  <span>${AppState.getTranslation?.('release.status') || 'Status'}</span>
                  <select id="nr_status" class="rm-input">
                    <option>Stable</option>
                    <option>Beta</option>
                    <option>Alpha</option>
                    <option>Canary</option>
                  </select>
                  <span class="rm-field-hint">${AppState.getTranslation?.('release.status_hint') || 'Stable, Beta, Alpha or Canary'}</span>
                </label>
                <label class="rm-form-field">
                  <span>${AppState.getTranslation?.('release.author') || 'Author'}</span>
                  <input id="nr_author" class="rm-input" placeholder="${AppState.getTranslation?.('release.author_placeholder') || 'Jane Doe'}" />
                  <span class="rm-field-hint">${AppState.getTranslation?.('release.author_hint') || 'Optional owner or approver.'}</span>
                </label>
              </div>
            </section>
            <section class="rm-step-panel" data-step-panel="2" hidden>
              <div class="rm-lang-tabs" role="tablist">
                <button type="button" class="rm-lang-tab is-active" data-lang="tr" role="tab" aria-selected="true">${langLabelTr}</button>
                <button type="button" class="rm-lang-tab" data-lang="de" role="tab" aria-selected="false">${langLabelDe}</button>
                <button type="button" class="rm-lang-tab" data-lang="en" role="tab" aria-selected="false">${langLabelEn}</button>
              </div>
              <div class="rm-lang-panels">
                <div class="rm-lang-panel active" data-lang-panel="tr" role="tabpanel" aria-hidden="false">
                  <label class="rm-form-field">
                    <span class="rm-field-hint">${langLabelTr}</span>
                    <textarea id="nr_tr" rows="4" class="rm-input" placeholder="Açıklama (${langLabelTr})"></textarea>
                  </label>
                </div>
                <div class="rm-lang-panel" data-lang-panel="de" role="tabpanel" aria-hidden="true" hidden>
                  <label class="rm-form-field">
                    <span class="rm-field-hint">${langLabelDe}</span>
                    <textarea id="nr_de" rows="4" class="rm-input" placeholder="Beschreibung (${langLabelDe})"></textarea>
                  </label>
                </div>
                <div class="rm-lang-panel" data-lang-panel="en" role="tabpanel" aria-hidden="true" hidden>
                  <label class="rm-form-field">
                    <span class="rm-field-hint">${langLabelEn}</span>
                    <textarea id="nr_en" rows="4" class="rm-input" placeholder="Description (${langLabelEn})"></textarea>
                  </label>
                </div>
              </div>
            </section>
            <div class="rm-modal-footer">
              <span class="rm-field-hint">${AppState.getTranslation?.('release.required_hint') || 'Fields marked * are required.'}</span>
              <div class="rm-modal-actions">
                <button type="button" class="rm-btn rm-btn--ghost js-close">${AppState.getTranslation?.('release.cancel') || 'Cancel'}</button>
                <button type="button" id="nrPrev" class="rm-btn rm-btn--ghost" hidden>${backLabel}</button>
                <button type="button" id="nrNext" class="rm-btn rm-btn--secondary">${nextLabel}</button>
                <button type="submit" id="nrSubmit" class="rm-btn rm-btn--primary" hidden>${saveLabel}</button>
              </div>
            </div>
            <div id="nr_error" class="rm-form-error" role="alert" aria-live="assertive"></div>
          </form>
        </div>`;

      document.body.appendChild(modal);
      const dialog = modal.firstElementChild;
      dialog?.classList?.add('rm-scope');
      syncThemeAttr(dialog, currentTheme);
      try {
        dialog.setAttribute('role','document');
        dialog.setAttribute('aria-labelledby','nrTitle');
        dialog.setAttribute('aria-describedby','nr_error');
      } catch {}
      const form = dialog.querySelector('#nrForm');
      const err = dialog.querySelector('#nr_error');
      const closeBtns = dialog.querySelectorAll('.js-close');
      const versionInput = dialog.querySelector('#nr_version');
      const dateInput = dialog.querySelector('#nr_date');
      const statusSelect = dialog.querySelector('#nr_status');
      const authorInput = dialog.querySelector('#nr_author');
      const stepButtons = Array.from(dialog.querySelectorAll('.rm-step'));
      const stepPanels = Array.from(dialog.querySelectorAll('[data-step-panel]'));
      const prevBtn = dialog.querySelector('#nrPrev');
      const nextBtn = dialog.querySelector('#nrNext');
      const submitBtn = dialog.querySelector('#nrSubmit');
      const langTabs = Array.from(dialog.querySelectorAll('.rm-lang-tab'));
      const langPanels = Array.from(dialog.querySelectorAll('[data-lang-panel]'));
      const totalSteps = stepPanels.length;
      let currentStep = 1;

      const focusFirstInPanel = (panel) => {
        if (!panel) return;
        const first = panel.querySelector('input,select,textarea,button');
        if (first && typeof first.focus === 'function') first.focus({ preventScroll: true });
      };

      const setLang = (lang) => {
        langTabs.forEach(btn => {
          const active = btn.dataset.lang === lang;
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        langPanels.forEach(panel => {
          const active = panel.dataset.langPanel === lang;
          panel.classList.toggle('active', active);
          panel.toggleAttribute('hidden', !active);
          panel.setAttribute('aria-hidden', active ? 'false' : 'true');
        });
      };

      const validateStep = (step) => {
        if (step !== 1) return {};
        err.textContent = '';
        try {
          versionInput?.setAttribute('aria-invalid','false');
          dateInput?.setAttribute('aria-invalid','false');
        } catch {}
        const version = versionInput?.value.trim() || '';
        const date = dateInput?.value.trim() || '';
        if (!version || !date) {
          err.textContent = AppState.getTranslation?.('release.form_required') || 'Version and Date are required.';
          const target = !version ? versionInput : dateInput;
          try { target?.setAttribute('aria-invalid','true'); target?.focus({ preventScroll: true }); } catch {}
          return null;
        }
        if (!/^\d+\.\d+\.\d+$/.test(version)) {
          err.textContent = AppState.getTranslation?.('release.form_semver') || 'Version must be semver (x.y.z).';
          try { versionInput?.setAttribute('aria-invalid','true'); versionInput?.focus({ preventScroll: true }); } catch {}
          return null;
        }
        const duplicate = releases.some(x => String(x.version) === version && (!isEditing || String(initial._edit) !== version));
        if (duplicate) {
          err.textContent = AppState.getTranslation?.('release.version_exists') || 'This version already exists.';
          try { versionInput?.setAttribute('aria-invalid','true'); versionInput?.focus({ preventScroll: true }); } catch {}
          return null;
        }
        return { version, date };
      };

      const setStep = (step) => {
        currentStep = Math.min(Math.max(1, step), totalSteps);
        stepButtons.forEach(btn => {
          const match = Number(btn.dataset.step) === currentStep;
          btn.classList.toggle('is-active', match);
          btn.setAttribute('aria-current', match ? 'step' : 'false');
        });
        stepPanels.forEach(panel => {
          const match = Number(panel.dataset.stepPanel) === currentStep;
          panel.toggleAttribute('hidden', !match);
        });
        prevBtn.hidden = currentStep === 1;
        nextBtn.hidden = currentStep === totalSteps;
        submitBtn.hidden = currentStep !== totalSteps;
      };

      stepButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const targetStep = Number(btn.dataset.step);
          if (targetStep === currentStep) return;
          if (targetStep > currentStep && !validateStep(currentStep)) return;
          setStep(targetStep);
          setTimeout(() => focusFirstInPanel(stepPanels[targetStep - 1]), 60);
        });
      });

      nextBtn?.addEventListener('click', () => {
        const basics = validateStep(currentStep);
        if (!basics) return;
        const targetStep = Math.min(totalSteps, currentStep + 1);
        setStep(targetStep);
        setTimeout(() => focusFirstInPanel(stepPanels[targetStep - 1]), 60);
      });

      prevBtn?.addEventListener('click', () => {
        const targetStep = Math.max(1, currentStep - 1);
        setStep(targetStep);
        setTimeout(() => focusFirstInPanel(stepPanels[targetStep - 1]), 60);
      });

      langTabs.forEach(btn => {
        btn.addEventListener('click', () => setLang(btn.dataset.lang));
      });

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

      try { ['#nr_version','#nr_date'].forEach(sel => { const el = dialog.querySelector(sel); if (el) { el.setAttribute('aria-describedby','nr_error'); } }); } catch {}

      // Prefill on edit
      if (initial) {
        versionInput.value = initial.version || '';
        dateInput.value = (initial.date || '').slice(0,10);
        statusSelect.value = initial.status || 'Stable';
        authorInput.value = initial.author || '';
        const d = initial.description || {};
        dialog.querySelector('#nr_tr').value = d.tr || '';
        dialog.querySelector('#nr_de').value = d.de || '';
        dialog.querySelector('#nr_en').value = d.en || '';
        const firstLang = ['tr','de','en'].find(code => (d[code] || '').trim());
        if (firstLang) setLang(firstLang);
      }

      setStep(1);
      setLang(langTabs[0]?.dataset.lang || 'tr');
      focusFirstInPanel(stepPanels[0]);

      form.addEventListener('submit', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const basics = validateStep(1);
        if (!basics) {
          setStep(1);
          return;
        }
        if (currentStep !== totalSteps) {
          setStep(totalSteps);
          setTimeout(() => focusFirstInPanel(stepPanels[totalSteps - 1]), 60);
          return;
        }
        const { version, date } = basics;
        const status = statusSelect.value.trim() || 'Stable';
        const author = authorInput.value.trim() || 'System';
        const tr = dialog.querySelector('#nr_tr').value.trim();
        const de = dialog.querySelector('#nr_de').value.trim();
        const en = dialog.querySelector('#nr_en').value.trim();
        if (isEditing) {
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
    newReleaseMain?.addEventListener('click', () => openNewReleaseModal());

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
    copyViewLinkBtn?.addEventListener('click', async () => {
      try {
        const st = serializeState();
        const enc = btoa(unescape(encodeURIComponent(JSON.stringify(st)))).replace(/=+$/,'');
        const link = location.origin + location.pathname + '#/releases?state=' + enc;
        const ok = await copyText(link);
        Toast?.show?.(AppState.getTranslation?.('release.link_copied') || 'Link copied', ok?'info':'error');
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
