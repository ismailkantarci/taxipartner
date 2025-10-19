import { AppState } from '../core.state/app.state.module.js';
import {
  IDENTITY_API_BASE,
  IDENTITY_LOGIN_URL,
  readAuthToken,
  expireAuthCookie
} from '../core.user/user.data.module.js';
import {
  toggleSidebarForViewport,
  refreshActiveTenantLabel
} from '../core.sidebar/index.module.js';
import {
  Menu,
  Search,
  Filter,
  ArrowUpDown,
  Table,
  Sun,
  Moon,
  UserRound,
  LogOut,
  ChevronDown
} from 'lucide-static';

const PROGRAM_TABS = [
  { route: '/program/goals', labelKey: 'tabs.goals', fallback: 'Goals' },
  { route: '/program/audits', labelKey: 'tabs.audits', fallback: 'Audits' }
];

const HEADER_ACTIONS = [
  { type: 'filter', icon: Filter, labelKey: 'header.actions.filter', fallback: 'Filter' },
  { type: 'sort', icon: ArrowUpDown, labelKey: 'header.actions.sort', fallback: 'Sort' },
  { type: 'columns', icon: Table, labelKey: 'header.actions.columns', fallback: 'Columns' }
];

const STORAGE_TENANT_KEY = 'selectedTenantId';
const STORAGE_TP_TENANT_KEY = 'tp_tenantId';
const GLOBAL_PREF_KEY = 'globalControls';

const LANGUAGE_OPTIONS = [
  { value: 'de-AT', labelKey: 'lang.de_at', fallback: 'Deutsch (AT)' },
  { value: 'tr', labelKey: 'lang.tr', fallback: 'Türkçe' },
  { value: 'en', labelKey: 'lang.en', fallback: 'English' }
];

const THEME_OPTIONS = [
  { value: 'light', labelKey: 'header.theme.light', fallback: 'Light' },
  { value: 'dark', labelKey: 'header.theme.dark', fallback: 'Dark' },
  { value: 'system', labelKey: 'header.theme.system', fallback: 'System' },
  { value: 'autoSun', labelKey: 'header.theme.autoSun', fallback: 'Auto (Sunrise)' }
];

let cachedRoute = '';

const t = (key, fallback) => {
  try {
    return AppState?.getTranslation?.(key) || fallback;
  } catch (error) {
    console.warn('[core.header] translation missing:', key, error);
    return fallback;
  }
};

const iconSvg = (svg, className = 'h-5 w-5') =>
  svg
    .replace('<svg', `<svg class="${className}" aria-hidden="true"`)
    .replace(/width="[^"]+"/, '')
    .replace(/height="[^"]+"/, '');

const getInitials = (input = '') => {
  const sanitized = input.trim();
  if (!sanitized) return 'TP';
  const parts = sanitized.split(/\s+/).filter(Boolean);
  if (!parts.length) return sanitized.slice(0, 2).toUpperCase();
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : parts[0][1] || '';
  const initials = `${first}${last}`.toUpperCase();
  return initials || sanitized.slice(0, 2).toUpperCase();
};

const resolveActiveTenant = (user, tenantId) => {
  if (!user?.tenants?.length) return null;
  return user.tenants.find((tenant) => tenant.tenantId === tenantId) || user.tenants[0];
};

const buildTenantOptions = (user, tenantId) => {
  if (!user?.tenants?.length) {
    return `<option value="" selected>${t('header.workspace.none', 'Select a tenant')}</option>`;
  }
  return user.tenants
    .map(
      (tenant) => `
        <option value="${tenant.tenantId}" ${tenant.tenantId === tenantId ? 'selected' : ''}>
          ${tenant.legalName}
        </option>`
    )
    .join('');
};

const buildLanguageOptions = (language) =>
  LANGUAGE_OPTIONS.map(
    (option) => `
      <option value="${option.value}" ${option.value === language ? 'selected' : ''}>
        ${t(option.labelKey, option.fallback)}
      </option>`
  ).join('');

const buildThemeOptions = (mode, theme) =>
  THEME_OPTIONS.map((option) => {
    const isManual = mode === 'manual';
    const selected = option.value === (isManual ? theme : mode);
    return `
      <option value="${option.value}" ${selected ? 'selected' : ''}>
        ${t(option.labelKey, option.fallback)}
      </option>`;
  }).join('');

const renderActionButtons = () =>
  HEADER_ACTIONS.map(
    (action) => `
      <button
        type="button"
        class="rounded-xl px-2.5 py-1.5 text-gray-600 transition-colors hover:bg-white hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
        data-command="${action.type}"
        aria-pressed="false"
        title="${t(action.labelKey, action.fallback)}"
      >
        ${iconSvg(action.icon, 'h-4 w-4')}
        <span class="sr-only">${t(action.labelKey, action.fallback)}</span>
      </button>`
  ).join('');

const renderHeaderHTML = (user, tenantId) => {
  const tenant = resolveActiveTenant(user, tenantId);
  const tenantName = tenant?.legalName || '';
  const searchPlaceholder = t('header.searchPlaceholder', 'Search modules, data or actions…');
  const themeLabel =
    AppState.theme === 'dark'
      ? t('header.theme.light', 'Switch to light theme')
      : t('header.theme.dark', 'Switch to dark theme');
  const actionsGroupLabel = t('header.actions.groupLabel', 'Table actions');
  const initials = getInitials(user.fullName || user.email);

  return `
    <header
      class="flex h-14 items-center gap-4 border-b border-gray-200 bg-white/90 px-6 backdrop-blur dark:border-gray-800 dark:bg-gray-900/85"
      role="banner"
    >
      <button
        id="sidebarToggle"
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        aria-controls="sidebar"
        aria-expanded="false"
        title="${t('header.toggleSidebar', 'Toggle sidebar')}"
      >
        ${iconSvg(Menu, 'h-5 w-5')}
        <span class="sr-only">${t('header.toggleSidebar', 'Toggle sidebar')}</span>
      </button>
      <div class="flex min-w-0 flex-col">
        <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">${t('header.appTitle', 'TAXIPartner Admin')}</span>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          ${t('header.workspace', 'Workspace')}:
          <span data-header-active-tenant>${tenantName || t('header.workspace.none', 'Select a tenant')}</span>
        </span>
      </div>
      <div class="flex min-w-0 flex-1 items-center justify-end gap-3">
        <div class="relative w-full max-w-xl">
          <label for="globalSearch" class="sr-only">${t('header.searchLabel', 'Global search')}</label>
          <input
            id="globalSearch"
            type="search"
            class="w-full rounded-2xl border border-gray-200 bg-white/90 py-2.5 pl-10 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-100"
            placeholder="${searchPlaceholder}"
            autocomplete="off"
          />
          <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 dark:text-gray-500">
            ${iconSvg(Search, 'h-4 w-4')}
          </span>
        </div>
        <div
          class="flex items-center gap-1 rounded-2xl border border-gray-200 bg-white/70 px-1.5 py-1 dark:border-gray-700 dark:bg-gray-900/70"
          role="group"
          aria-label="${actionsGroupLabel}"
        >
          ${renderActionButtons()}
        </div>
        <button
          id="themeQuickToggle"
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          title="${themeLabel}"
        >
          <span data-theme-icon>
            ${iconSvg(AppState.theme === 'dark' ? Sun : Moon, 'h-5 w-5')}
          </span>
          <span class="sr-only">${themeLabel}</span>
        </button>
        <div class="relative">
          <button
            id="profileToggle"
            type="button"
            class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            aria-haspopup="true"
            aria-expanded="false"
          >
            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold uppercase text-white dark:bg-brand-400">
              ${initials}
            </span>
            <span class="hidden min-w-0 flex-col text-left sm:flex">
              <span class="truncate text-xs font-semibold leading-tight text-gray-900 dark:text-gray-100">
                ${user.fullName || user.email || 'User'}
              </span>
              <span class="truncate text-[11px] text-gray-500 dark:text-gray-400">${user.email || ''}</span>
            </span>
            <span class="hidden text-gray-400 dark:text-gray-500 sm:block">
              ${iconSvg(ChevronDown, 'h-4 w-4')}
            </span>
          </button>
          <div
            id="userMenu"
            class="absolute right-0 z-50 mt-3 hidden w-80 origin-top-right rounded-xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
            role="menu"
            aria-label="${t('header.userMenu', 'User menu')}"
          >
            <div class="space-y-4">
              <div>
                <label for="tenantSelect" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  ${t('header.workspace', 'Workspace')}
                </label>
                <select
                  id="tenantSelect"
                  class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  ${buildTenantOptions(user, tenantId)}
                </select>
              </div>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label for="languageSelect" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    ${t('header.language', 'Language')}
                  </label>
                  <select
                    id="languageSelect"
                    class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    ${buildLanguageOptions(AppState.language)}
                  </select>
                </div>
                <div>
                  <label for="themeModeSelect" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    ${t('header.theme', 'Theme')}
                  </label>
                  <select
                    id="themeModeSelect"
                    class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    ${buildThemeOptions(AppState.themeMode, AppState.theme)}
                  </select>
                </div>
              </div>
              <div class="border-t border-gray-200 pt-3 dark:border-gray-700">
                <button
                  type="button"
                  data-action="logout"
                  class="flex w-full items-center justify-between rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 dark:bg-rose-500/15 dark:text-rose-400 dark:hover:bg-rose-500/25"
                >
                  <span>${t('header.logout', 'Log out')}</span>
                  ${iconSvg(LogOut, 'h-4 w-4')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
};

const getFocusableElements = (container) =>
  Array.from(
    container.querySelectorAll(
      'button, [href], select, input, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      !element.getAttribute('aria-hidden') &&
      element.offsetParent !== null
  );

const updateThemeButton = (button) => {
  if (!button) return;
  const iconSlot = button.querySelector('[data-theme-icon]');
  const srLabel = button.querySelector('.sr-only');
  const nextLabel =
    AppState.theme === 'dark'
      ? t('header.theme.light', 'Switch to light theme')
      : t('header.theme.dark', 'Switch to dark theme');
  if (iconSlot) {
    iconSlot.innerHTML = iconSvg(AppState.theme === 'dark' ? Sun : Moon, 'h-5 w-5');
  }
  if (srLabel) {
    srLabel.textContent = nextLabel;
  }
  button.setAttribute('title', nextLabel);
};

const dispatchHeaderEvent = (type, detail) => {
  document.dispatchEvent(
    new CustomEvent(`header:${type}`, {
      detail,
      bubbles: true
    })
  );
};

const syncTenantDisplay = (tenantName) => {
  const headerLabel = document.querySelector('[data-header-active-tenant]');
  if (headerLabel) {
    headerLabel.textContent = tenantName || t('header.workspace.none', 'Select a tenant');
  }
  refreshActiveTenantLabel(tenantName);
};

const setTenantStorage = (tenantId) => {
  try {
    localStorage.setItem(STORAGE_TENANT_KEY, tenantId);
    localStorage.setItem(STORAGE_TP_TENANT_KEY, tenantId);
  } catch (_) {}
};

const handleActionToggle = (button, type) => {
  const current = button.getAttribute('aria-pressed') === 'true';
  const next = !current;
  button.setAttribute('aria-pressed', String(next));
  button.classList.toggle('bg-white', next);
  button.classList.toggle('dark:bg-gray-800', next);
  AppState.setAsyncFlag(`panel.${type}`, next);
  dispatchHeaderEvent('action', { type, active: next });
};

const HANDLE_TAB_KEYDOWN = (event) => {
  const container = event.currentTarget?.closest('[role="tablist"]');
  if (!container) return;
  const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
  const currentIndex = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
  const focusTab = (nextIndex) => {
    const next = tabs[nextIndex];
    if (!next) return;
    next.focus();
    next.click();
  };
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault();
      focusTab((currentIndex + 1) % tabs.length);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault();
      focusTab((currentIndex - 1 + tabs.length) % tabs.length);
      break;
    case 'Home':
      event.preventDefault();
      focusTab(0);
      break;
    case 'End':
      event.preventDefault();
      focusTab(tabs.length - 1);
      break;
    default:
      break;
  }
};

const getRouteFromHash = () => {
  const hash = location.hash.replace(/^#/, '') || '/dashboard';
  if (!hash.startsWith('/')) return `/${hash}`;
  return hash || '/dashboard';
};

const renderTabs = (currentRoute) => {
  const container = document.getElementById('pageTabs');
  if (!container) return;

  const route = currentRoute || getRouteFromHash();
  const isProgram = route.startsWith('/program/');
  if (!isProgram) {
    container.classList.add('hidden');
    container.innerHTML = '';
    cachedRoute = route;
    return;
  }

  container.classList.remove('hidden');
  const tabMarkup = `
    <div class="flex items-center gap-1 overflow-x-auto py-3" role="tablist">
      ${PROGRAM_TABS.map((tab, index) => {
        const isActive = route === tab.route;
        const baseClass = isActive
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800';
        return `
          <button
            type="button"
            role="tab"
            data-route="${tab.route}"
            aria-selected="${isActive}"
            tabindex="${isActive ? '0' : '-1'}"
            class="rounded-xl px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${baseClass}"
          >
            ${t(tab.labelKey, tab.fallback)}
          </button>`;
      }).join('')}
    </div>
  `;

  container.innerHTML = tabMarkup;
  container.querySelectorAll('[role="tab"]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const destination = tab.getAttribute('data-route');
      if (!destination) return;
      if (cachedRoute === destination) return;
      location.hash = `#${destination}`;
    });
    tab.addEventListener('keydown', HANDLE_TAB_KEYDOWN);
  });
  cachedRoute = route;
};

export function loadHeader(target, user) {
  if (!user || !Array.isArray(user.tenants)) {
    console.error('[core.header] loadHeader: invalid user payload', user);
    return;
  }

  AppState.setUser(user);

  const savedLanguage = AppState.language || user.language || 'de-AT';
  AppState.setLanguage(savedLanguage);

  const storedTenant =
    AppState.tenant ||
    (() => {
      try {
        return localStorage.getItem(STORAGE_TENANT_KEY);
      } catch (_) {
        return null;
      }
    })() ||
    (user.tenants[0] && user.tenants[0].tenantId) ||
    '';

  if (storedTenant) {
    AppState.setTenant(storedTenant);
    setTenantStorage(storedTenant);
  }

  target.innerHTML = renderHeaderHTML(user, AppState.tenant);

  const sidebarToggle = document.getElementById('sidebarToggle');
  const globalSearch = document.getElementById('globalSearch');
  const actionButtons = target.querySelectorAll('[data-command]');
  const themeQuickToggle = document.getElementById('themeQuickToggle');
  const profileToggle = document.getElementById('profileToggle');
  const userMenu = document.getElementById('userMenu');
  const tenantSelect = document.getElementById('tenantSelect');
  const languageSelect = document.getElementById('languageSelect');
  const themeModeSelect = document.getElementById('themeModeSelect');
  const logoutButton = userMenu?.querySelector('[data-action="logout"]');

  updateThemeButton(themeQuickToggle);
  syncTenantDisplay(resolveActiveTenant(user, AppState.tenant)?.legalName || '');

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => toggleSidebarForViewport(sidebarToggle));
  }

  document.addEventListener('sidebar:state', (event) => {
    if (!sidebarToggle) return;
    const { open, mode } = event.detail || {};
    const isOpen = !!open;
    sidebarToggle.setAttribute('aria-expanded', String(isOpen));
    sidebarToggle.dataset.mode = mode || 'expanded';
  });

  if (globalSearch) {
    globalSearch.addEventListener('input', (event) => {
      const value = event.target.value || '';
      AppState.updateTablePrefs(GLOBAL_PREF_KEY, (current) => ({
        ...current,
        filters: { ...current.filters, search: value }
      }));
      dispatchHeaderEvent('search', { value });
    });
  }

  actionButtons.forEach((button) => {
    const type = button.getAttribute('data-command');
    if (!type) return;
    button.addEventListener('click', () => handleActionToggle(button, type));
  });

  if (themeQuickToggle) {
    themeQuickToggle.addEventListener('click', () => {
      try {
        AppState.clearThemeTimers?.();
      } catch (_) {}
      AppState.setThemeMode('manual');
      const nextTheme = AppState.theme === 'dark' ? 'light' : 'dark';
      AppState.setTheme(nextTheme);
      updateThemeButton(themeQuickToggle);
      if (themeModeSelect) {
        themeModeSelect.value = nextTheme;
      }
      try {
        const stored = JSON.parse(localStorage.getItem('AppState') || '{}');
        stored.theme = nextTheme;
        stored.themeMode = 'manual';
        localStorage.setItem('AppState', JSON.stringify(stored));
      } catch (_) {}
    });
  }

  let lastFocused = null;

  const closeMenu = () => {
    if (!userMenu || userMenu.classList.contains('hidden')) return;
    userMenu.classList.add('hidden');
    profileToggle?.setAttribute('aria-expanded', 'false');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try {
        lastFocused.focus();
      } catch (_) {}
    }
  };

  const openMenu = () => {
    if (!userMenu) return;
    lastFocused = document.activeElement;
    userMenu.classList.remove('hidden');
    profileToggle?.setAttribute('aria-expanded', 'true');
    const focusables = getFocusableElements(userMenu);
    if (focusables.length) {
      focusables[0].focus();
    }
  };

  if (profileToggle && userMenu) {
    profileToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      if (userMenu.classList.contains('hidden')) {
        openMenu();
      } else {
        closeMenu();
      }
    });

    userMenu.addEventListener('click', (event) => event.stopPropagation());

    userMenu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        profileToggle.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = getFocusableElements(userMenu);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first || !userMenu.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !userMenu.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  document.addEventListener('click', () => closeMenu());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });

  if (tenantSelect) {
    tenantSelect.addEventListener('change', (event) => {
      const nextTenant = event.target.value;
      AppState.setTenant(nextTenant);
      setTenantStorage(nextTenant);
      syncTenantDisplay(resolveActiveTenant(user, nextTenant)?.legalName || '');
      dispatchHeaderEvent('tenantChanged', { tenantId: nextTenant });
    });
  }

  if (languageSelect) {
    languageSelect.addEventListener('change', (event) => {
      const nextLanguage = event.target.value;
      AppState.setLanguage(nextLanguage);
      try {
        const stored = JSON.parse(localStorage.getItem('AppState') || '{}');
        stored.language = nextLanguage;
        localStorage.setItem('AppState', JSON.stringify(stored));
      } catch (_) {}
      closeMenu();
      location.reload();
    });
  }

  if (themeModeSelect) {
    themeModeSelect.addEventListener('change', (event) => {
      const mode = event.target.value;
      if (mode === 'system' || mode === 'autoSun') {
        AppState.setThemeMode(mode);
      } else {
        AppState.setThemeMode('manual');
        AppState.setTheme(mode);
      }
      updateThemeButton(themeQuickToggle);
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      closeMenu();
      const token = readAuthToken();
      if (token) {
        try {
          await fetch(`${IDENTITY_API_BASE}/auth/logout`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (_) {
          // logout failure is non-blocking
        }
      }
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('AppState');
      } catch (_) {}
      expireAuthCookie();
      AppState.reset?.();
      AppState.saveToStorage?.();
      location.href = IDENTITY_LOGIN_URL;
    });
  }

  document.addEventListener('router:navigated', (event) => {
    const route = event.detail?.route || getRouteFromHash();
    renderTabs(route);
  });

  renderTabs(getRouteFromHash());
}
