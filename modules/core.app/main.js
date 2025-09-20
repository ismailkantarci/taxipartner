import { loadHeader } from '../core.header/index.module.js';
import { loadSidebar } from '../core.sidebar/index.module.js';
import { Router } from '../core.router/index.module.js';
import { user } from '../core.user/user.data.module.js';
import { AppState } from '../core.state/app.state.module.js';
import FooterModule from '../core.footer/index.module.js';
import { ErrorBoundary } from '../core.error/index.module.js';
import { Telemetry } from '../core.telemetry/index.module.js';

window.__themeQuickToggle = function () {
  try {
    if (window.AppStateRef && window.AppStateRef.clearThemeTimers) window.AppStateRef.clearThemeTimers();
    if (window.AppStateRef && window.AppStateRef.setThemeMode) window.AppStateRef.setThemeMode('manual');
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    if (window.AppStateRef && window.AppStateRef.setTheme) window.AppStateRef.setTheme(next);
    const icon = document.getElementById('themeQuickToggleIcon');
    if (icon) icon.textContent = next === 'dark' ? '🌙' : '☀️';
  } catch {}
};

window.addEventListener('DOMContentLoaded', async () => {
  ErrorBoundary.init();
  // Load app config (telemetry flags)
  try {
    const cfg = await fetch(new URL('../../app.config.json', import.meta.url)).then(r => r.json());
    Telemetry.enabled = !!cfg?.telemetry?.enabled;
    // Expose minimal app config for later checks (e.g., SW)
    window.AppConfigRef = cfg;
    try { if (cfg?.flags) { AppState.setFlags?.(cfg.flags); } } catch {}
  } catch {}
  AppState.loadFromStorage?.();
  if (AppState.themeMode === 'manual') {
    AppState.setTheme(AppState.theme || 'light');
  } else {
    AppState.applyThemeStrategy?.();
  }
  window.AppStateRef = AppState;
  await AppState.loadTranslations();
  loadHeader(document.getElementById('header'), user);
  loadSidebar(document.getElementById('sidebar'), user);
  await Router.init();
  FooterModule.init(document.getElementById('footer'));

  setTimeout(() => {
    const isDark = AppState.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    try { document.body.classList.toggle('dark', isDark); } catch {}
    // Theme toggle is handled within header module to avoid double-binding here
  }, 0);

  // Service Worker: enable only in production; in dev, actively unregister to avoid cache issues
  try {
    const allowSW = (window.AppConfigRef?.features?.serviceWorker ?? true) === true;
    const isProd = !!(import.meta?.env && import.meta.env.PROD === true);
    if (allowSW && isProd && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      const swUrl = new URL('../../sw.js', import.meta.url);
      navigator.serviceWorker.register(swUrl);
    } else if ('serviceWorker' in navigator) {
      // Dev: unregister any existing SW to prevent stale caches on soft refresh
      navigator.serviceWorker.getRegistrations?.().then(list => {
        list.forEach(reg => reg.unregister().catch(()=>{}));
      }).catch(()=>{});
      try { caches && caches.keys && caches.keys().then(keys => keys.forEach(k => caches.delete(k))); } catch {}
    }
  } catch {}
});
