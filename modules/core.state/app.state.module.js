// modules/core.state/app.state.module.js
import { getSunTimes } from '../core.theme/theme.utils.js';

const STORAGE_KEY = 'AppState';

export const AppState = {
  currentUser: null,
  activeModule: null,
  language: 'de-AT',
  theme: 'light',
  themeMode: 'manual', // 'manual' | 'system' | 'autoSun'
  tenant: null,
  sidebar: {
    open: false,
    mode: 'expanded' // 'expanded' | 'collapsed'
  },
  tablePreferences: {},
  asyncFlags: {},
  translations: {},
  ready: false,
  debug: false,
  _mediaQuery: null,
  _sunTimers: [],
  flags: {},

  setUser(user) {
    this.currentUser = user;
  },
  setFlags(flags) {
    this.flags = flags || {};
  },

  setActiveModule(name) {
    this.activeModule = name;
  },

  setLanguage(lang) {
    this.language = lang;
    this.saveToStorage();
  },

  setTheme(theme) {
    this.theme = theme;
    const isDark = theme === 'dark';
    const root = document.documentElement;
    const body = document.body;
    // Toggle dark class on root and body
    root.classList.toggle('dark', isDark);
    body?.classList?.toggle('dark', isDark);
    if (!isDark) {
      // Remove any stray .dark classes from other elements to prevent scope-based dark styles
      try {
        document.querySelectorAll('.dark').forEach((el) => {
          if (el !== root && el !== body) el.classList.remove('dark');
        });
      } catch (_) {}
    }
    // color-scheme is handled via CSS classes (see tailwind base layer)
    // Styling is driven by classes; avoid inline styles for CSP strictness
    this.saveToStorage();
  },

  clearThemeTimers() {
    this._sunTimers.forEach(t => clearTimeout(t));
    this._sunTimers = [];
    if (this._mediaQuery && this._mediaQuery.removeEventListener) {
      this._mediaQuery.removeEventListener('change', this._onMediaChange);
    }
    this._mediaQuery = null;
  },

  setThemeMode(mode) {
    this.themeMode = mode;
    this.saveToStorage();
    this.applyThemeStrategy();
  },

  setSidebarOpen(open) {
    this.sidebar.open = open;
    // open state is transient; do not persist separately
  },

  toggleSidebarOpen() {
    this.setSidebarOpen(!this.sidebar.open);
  },

  setSidebarMode(mode) {
    if (mode !== 'expanded' && mode !== 'collapsed') return;
    if (this.sidebar.mode === mode) return;
    this.sidebar.mode = mode;
    this.saveToStorage();
  },

  isSidebarCollapsed() {
    return this.sidebar.mode === 'collapsed';
  },

  getTablePrefs(tableId) {
    if (!tableId) return { columnVisibility: {}, sorting: [], columnOrder: [], filters: {} };
    return this.tablePreferences?.[tableId] || { columnVisibility: {}, sorting: [], columnOrder: [], filters: {} };
  },

  updateTablePrefs(tableId, updater) {
    if (!tableId) return;
    const current = this.getTablePrefs(tableId);
    const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
    this.tablePreferences = {
      ...this.tablePreferences,
      [tableId]: {
        columnVisibility: next.columnVisibility || {},
        sorting: next.sorting || [],
        columnOrder: next.columnOrder || [],
        filters: next.filters || {}
      }
    };
    this.saveToStorage();
  },

  clearTablePrefs(tableId) {
    if (!tableId) return;
    if (!this.tablePreferences || !(tableId in this.tablePreferences)) return;
    const next = { ...this.tablePreferences };
    delete next[tableId];
    this.tablePreferences = next;
    this.saveToStorage();
  },

  setAsyncFlag(key, value) {
    if (!key) return;
    this.asyncFlags = { ...this.asyncFlags, [key]: !!value };
  },

  getAsyncFlag(key) {
    return !!this.asyncFlags?.[key];
  },

  _onMediaChange: null,

  applyThemeStrategy() {
    // Decide and apply theme based on mode
    this.clearThemeTimers();
    if (this.themeMode === 'system') {
      this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => this.setTheme(this._mediaQuery.matches ? 'dark' : 'light');
      this._onMediaChange = () => apply();
      try { this._mediaQuery.addEventListener('change', this._onMediaChange); } catch (_) {}
      apply();
      return;
    }
    if (this.themeMode === 'autoSun') {
      const useSun = (lat, lon) => {
        const { sunrise, sunset } = getSunTimes(new Date(), lat, lon);
        const now = new Date();
        const isDay = now >= sunrise && now < sunset;
        this.setTheme(isDay ? 'light' : 'dark');
        // Schedule next switches
        const t1 = setTimeout(() => this.setTheme('light'), Math.max(0, sunrise - now));
        const t2 = setTimeout(() => this.setTheme('dark'), Math.max(0, sunset - now));
        // Recalculate next day shortly after midnight
        const nextDay = new Date(now);
        nextDay.setDate(now.getDate() + 1);
        nextDay.setHours(0, 5, 0, 0);
        const t3 = setTimeout(() => this.applyThemeStrategy(), Math.max(0, nextDay - now));
        this._sunTimers.push(t1, t2, t3);
      };

      // Try cached coords first with TTL (7 days)
      const GEO_TTL = 7 * 24 * 60 * 60 * 1000;
      const cached = JSON.parse(localStorage.getItem('AppStateGeo') || 'null');
      const fresh = cached && typeof cached.lat === 'number' && typeof cached.lon === 'number' && typeof cached.ts === 'number' && (Date.now() - cached.ts) < GEO_TTL;
      if (fresh) {
        useSun(cached.lat, cached.lon);
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            localStorage.setItem('AppStateGeo', JSON.stringify({ lat, lon, ts: Date.now() }));
            useSun(lat, lon);
          },
          () => {
            // Fallback to system preference if user denies
            this.themeMode = 'system';
            this.applyThemeStrategy();
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 86400000 }
        );
      } else {
        // No geolocation support -> system
        this.themeMode = 'system';
        this.applyThemeStrategy();
      }
      return;
    }
    // Manual
    this.setTheme(this.theme);
  },

  setTenant(tenantId) {
    this.tenant = tenantId;
    this.saveToStorage();
  },

  getTranslation(key) {
    const lang = this.language || 'de-AT';
    const base = lang.split('-')[0];
    const t = this.translations || {};
    return (
      t[lang]?.[key] ??
      t[base]?.[key] ??
      t['en']?.[key] ??
      key
    );
  },

  reset() {
    this.currentUser = null;
  	this.activeModule = null;
    this.language = 'de-AT';
    this.theme = 'light';
    this.tenant = null;
  },

  saveToStorage() {
    const payload = {
      language: this.language,
      theme: this.theme,
      themeMode: this.themeMode,
      tenant: this.tenant,
      sidebar: this.sidebar,
      tablePreferences: this.tablePreferences
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
  },

  loadFromStorage() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_) {
      saved = null;
    }
    if (saved?.language) this.language = saved.language;
    // Theme: if not saved, respect OS preference
    if (saved.theme) {
      this.theme = saved.theme;
    } else if (window?.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.theme = 'dark';
    }
    if (saved?.themeMode) this.themeMode = saved.themeMode;
    if (saved?.tenant) this.tenant = saved.tenant;
    if (saved?.sidebar && typeof saved.sidebar === 'object') {
      this.sidebar = {
        open: false,
        mode: saved.sidebar.mode === 'collapsed' ? 'collapsed' : 'expanded'
      };
    }
    if (saved?.tablePreferences && typeof saved.tablePreferences === 'object') {
      this.tablePreferences = saved.tablePreferences;
    }
  },

  hasRole(role) {
    return this.currentUser?.roles?.includes(role);
  },

  isAdmin() {
    return this.hasRole('admin');
  }
};

async function loadTranslations() {
  try {
    const [de, tr, en] = await Promise.all([
      fetch(new URL('../../locales/de.json', import.meta.url).href).then(r => r.json()),
      fetch(new URL('../../locales/tr.json', import.meta.url).href).then(r => r.json()),
      fetch(new URL('../../locales/en.json', import.meta.url).href).then(r => r.json())
    ]);
    AppState.translations = { 'de-AT': de, tr, en };
    if (AppState.debug) console.log("Çeviriler yüklendi:", AppState.translations);
  } catch (err) {
    console.error("Çeviri dosyaları yüklenemedi:", err);
  }
}

AppState.loadTranslations = loadTranslations;

// Feature flag helpers
function hashStr(str) {
  let h = 5381; // djb2
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return Math.abs(h >>> 0);
}

AppState.isFlagEnabled = function(flagName) {
  const def = (this.flags && this.flags[flagName]) || {};
  if (def.enabled === true) return true;
  if (def.enabled === false) return false;
  // allowlist checks
  try {
    const email = this.currentUser?.email || '';
    const full = this.currentUser?.fullName || '';
    const tenant = this.tenant || '';
    if (Array.isArray(def.users) && def.users.some(u => u && (email === u || full === u))) return true;
    if (Array.isArray(def.tenants) && def.tenants.includes(tenant)) return true;
  } catch {}
  // percentage rollout
  if (typeof def.rollout === 'number' && def.rollout >= 0) {
    const seed = String(def.seed || flagName);
    const key = `${seed}:${this.currentUser?.email || this.currentUser?.fullName || 'anonymous'}`;
    const bucket = hashStr(key) % 100; // 0..99
    return bucket < Math.max(0, Math.min(100, Math.floor(def.rollout)));
  }
  // default off
  return false;
};
