import { AppState } from '../core.state/app.state.module.js';

const tenantDropdownHTML = (user, selectedTenantId) => `
  <div class="mt-3 w-full px-4">
    <label class="block text-xs text-gray-500 mb-1 dark:text-gray-400" for="tenantSelect">${AppState.getTranslation('header.workspace')}</label>
    <select id="tenantSelect" class="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-[6px] text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700" aria-label="${AppState.getTranslation('header.workspace.select')}">
      ${user.tenants.map(t => `<option value="${t.id}" ${t.id === selectedTenantId ? 'selected' : ''}>${t.name}</option>`).join('')}
    </select>
  </div>
`;

const tenantLabelHTML = (user, selectedTenantId) => {
  const tenant = user.tenants.find(t => t.id === selectedTenantId) || user.tenants[0];
  return `
  <div class="mt-3 w-full px-4 text-xs text-gray-500 dark:text-gray-400">
    ${AppState.getTranslation('header.workspace')}: <span class="font-medium text-gray-800 dark:text-gray-200">${tenant.name}</span>
  </div>
  `;
};

const buildMenuItems = () => ({
  admin: [
    { icon: '🏢', label: AppState.getTranslation('menu.organizations'), href: '#' },
    { icon: '🎫', label: AppState.getTranslation('menu.supportTickets'), href: '#' },
    { icon: '⚙️', label: AppState.getTranslation('menu.manageAccount'), href: '#', active: true },
    { icon: '👤', label: AppState.getTranslation('menu.communityProfile'), href: '#' },
    { icon: '📧', label: AppState.getTranslation('menu.emailSettings'), href: '#' },
  ],
  user: [
    { icon: '⚙️', label: AppState.getTranslation('menu.manageAccount'), href: '#', active: true },
    { icon: '👤', label: AppState.getTranslation('menu.communityProfile'), href: '#' },
  ],
});

const getUserRole = (user) => {
  // Assuming user.roles is an array of role strings, e.g. ['admin'], ['user']
  if (user.roles && user.roles.includes('admin')) return 'admin';
  return 'user';
};

const renderMenuItems = (role) => {
  const items = buildMenuItems();
  return items[role].map((item) => `
    <a href="${item.href}" tabindex="0" class="flex items-center gap-3 px-4 py-2 ${item.active ? 'text-gray-900 bg-gray-100 font-semibold dark:text-gray-100 dark:bg-gray-700' : 'text-gray-700 hover:bg-gray-50 transition-all duration-200 ease-in-out dark:text-gray-300 dark:hover:bg-gray-700'}" role="menuitem" aria-label="${item.label}">
      <span class="text-gray-500 dark:text-gray-400" aria-hidden="true">${item.icon}</span> <span>${item.label}</span>
    </a>
  `).join('');
};

const buildLanguageOptions = () => ([
  { value: 'de-AT', label: AppState.getTranslation('lang.de_at') },
  { value: 'tr', label: AppState.getTranslation('lang.tr') },
  { value: 'en', label: AppState.getTranslation('lang.en') },
]);

export function loadHeader(target, user) {
  if (AppState.debug) console.log("loadHeader called with user:", user);
  // Security check: Ensure user object and tenants array are valid
  if (!user || !user.tenants || !Array.isArray(user.tenants)) {
    console.error("loadHeader: user object is missing or invalid");
    return;
  }
  // Update AppState with initial user
  AppState.setUser(user);

  // Load saved settings or defaults (AppState is the source of truth)
  const savedLanguage = AppState.language || (user && user.language) || 'de-AT';
  AppState.setLanguage(savedLanguage);
  const savedTenantId = localStorage.getItem('selectedTenantId') || (user.tenants[0] && user.tenants[0].id);
  AppState.setTenant(savedTenantId);

  const role = getUserRole(user);
  const languageOptions = buildLanguageOptions();
  const tenantHTML = user.tenants.length > 1 ? tenantDropdownHTML(user, savedTenantId) : tenantLabelHTML(user, savedTenantId);

  // Dark mode detection (handled globally via AppState)

  target.innerHTML = `
    <header class="bg-white dark:bg-gray-900 h-14 shadow px-4 flex items-center justify-between z-[999] overflow-visible" role="banner">
      <div class="flex items-center gap-3 h-14">
        <button id="toggleSidebar" class="text-xl text-gray-600 hover:text-black mt-[2px] dark:text-gray-300 dark:hover:text-white" aria-label="${AppState.getTranslation('header.toggleSidebar')}" tabindex="0">☰</button>
        <span class="text-base text-gray-700 font-bold tracking-wide dark:text-gray-200">${AppState.getTranslation('header.appTitle')}</span>
      </div>
      <div class="hidden sm:flex gap-4 items-center text-sm text-gray-600 font-medium dark:text-gray-300" role="navigation" aria-label="${AppState.getTranslation('header.tenantSelection')}">
        <label for="headerTenantSelect" class="sr-only">${AppState.getTranslation('header.workspace.select')}</label>
        <select id="headerTenantSelect" class="border border-gray-300 rounded px-2 py-[5px] dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200" aria-live="polite">
          ${user.tenants.map(t => `<option value="${t.id}" ${t.id === savedTenantId ? "selected" : ""}>${t.name}</option>`).join('')}
        </select>
      </div>
      <button id="themeQuickToggle" class="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" title="${AppState.getTranslation('header.theme.quickToggle')}">
        <span id="themeQuickToggleIcon" aria-hidden="true">${AppState.theme === 'dark' ? '🌙' : '☀️'}</span>
        <span class="sr-only">${AppState.getTranslation('header.theme.quickToggle')}</span>
      </button>
      <div class="relative" role="region" aria-label="${AppState.getTranslation('header.userMenu')}">
        <button id="profileToggle" class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 transition dark:hover:bg-gray-800" aria-haspopup="true" aria-expanded="false" aria-controls="userMenu" tabindex="0">
          <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=0D8ABC&color=fff&size=32" alt="${AppState.getTranslation('header.avatar.of')} ${user.fullName}" class="w-7 h-7 rounded-full border border-gray-300 dark:border-gray-600" loading="lazy" />
          <span class="hidden sm:inline text-sm font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">${user.fullName.split(' ')[0]}</span>
          <!-- SVG Pfeil Icon (kann später durch Inline SVG ersetzt werden) -->
          <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div id="userMenu" class="fixed top-16 right-2 sm:right-4 w-[calc(100vw-1rem)] sm:w-72 max-w-[calc(100vw-1rem)] bg-white border border-gray-200 rounded-xl shadow-xl hidden z-50 text-sm dark:bg-gray-800 dark:border-gray-700 max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain" role="menu" aria-label="${AppState.getTranslation('header.userMenu.options')}" tabindex="-1">
          <!-- Avatar + Name + Company -->
          <div class="flex flex-col items-center px-4 py-4 bg-gradient-to-b from-gray-50 to-white rounded-t-xl dark:from-gray-700 dark:to-gray-800">
            <img 
              src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=E5E7EB&color=374151" 
              alt="${AppState.getTranslation('header.avatar.of')} ${user.fullName}" 
              class="w-14 h-14 rounded-full border border-gray-300 shadow-sm dark:border-gray-600" 
              loading="lazy"
              tabindex="-1"
            />
            <div class="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">${user.fullName}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${user.companyTag}</div>
          </div>
          ${tenantHTML}
          <div class="mt-3 w-full px-4">
            <label class="block text-xs text-gray-500 mb-1 dark:text-gray-400" for="languageSelect">${AppState.getTranslation('header.language')}</label>
            <select id="languageSelect" class="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-[6px] text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700" aria-label="${AppState.getTranslation('header.language.select')}">
              ${languageOptions.map(opt => `<option value="${opt.value}" ${opt.value === savedLanguage ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
          </div>
          <div class="mt-3 w-full px-4">
            <label class="block text-xs text-gray-500 mb-1 dark:text-gray-400" for="themeModeSelect">${AppState.getTranslation('header.theme')}</label>
            <select id="themeModeSelect" class="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-[6px] text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700" aria-label="${AppState.getTranslation('header.theme.select')}">
              <option value="light" ${AppState.themeMode==='manual' && AppState.theme==='light' ? 'selected' : ''}>${AppState.getTranslation('header.theme.light')}</option>
              <option value="dark" ${AppState.themeMode==='manual' && AppState.theme==='dark' ? 'selected' : ''}>${AppState.getTranslation('header.theme.dark')}</option>
              <option value="system" ${AppState.themeMode==='system' ? 'selected' : ''}>${AppState.getTranslation('header.theme.system')}</option>
              <option value="autoSun" ${AppState.themeMode==='autoSun' ? 'selected' : ''}>${AppState.getTranslation('header.theme.autoSun')}</option>
            </select>
          </div>
          <!-- Menü seçenekleri -->
          <div class="py-2 divide-y dark:divide-gray-700" role="none">
            ${renderMenuItems(role)}
          </div>
          <!-- Logout -->
          <div class="border-t px-4 py-2 dark:border-gray-700">
            <a href="#" class="flex items-center gap-2 text-red-600 hover:text-red-700 transition dark:text-red-500 dark:hover:text-red-600" role="menuitem" tabindex="0" aria-label="${AppState.getTranslation('header.logout')}">
              <span aria-hidden="true">🚪</span> <span>${AppState.getTranslation('header.logout')}</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  `;

  // Elements
  const toggleButton = document.getElementById("profileToggle");
  const menu = document.getElementById("userMenu");
  const languageSelect = document.getElementById("languageSelect");
  const themeModeSelect = document.getElementById("themeModeSelect");
  const themeQuickToggle = document.getElementById('themeQuickToggle');
  const themeQuickToggleIcon = document.getElementById('themeQuickToggleIcon');
  const tenantSelectDropdown = document.getElementById("tenantSelect");
  const tenantSelectHeader = document.getElementById("headerTenantSelect");

  // Synchronize tenant selects if both present
  function syncTenantSelects(selectedId) {
    if (tenantSelectDropdown && tenantSelectDropdown.value !== selectedId) {
      tenantSelectDropdown.value = selectedId;
    }
    if (tenantSelectHeader && tenantSelectHeader.value !== selectedId) {
      tenantSelectHeader.value = selectedId;
    }
  }

  // Open/close behavior (CSS-positioned)
  let prevFocus = null;
  function openMenu() {
    prevFocus = document.activeElement;
    menu.classList.remove('hidden');
    toggleButton.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (!menu.classList.contains('hidden')) {
      menu.classList.add('hidden');
      toggleButton.setAttribute('aria-expanded', 'false');
      // no dynamic positioning listeners needed
      // restore previous focus
      try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch {}
    }
  }

  // Show/hide menu toggle
  toggleButton.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (menu.classList.contains('hidden')) {
      openMenu();
      const firstMenuItem = menu.querySelector('[role="menuitem"]');
      if (firstMenuItem) firstMenuItem.focus();
    } else {
      closeMenu();
      toggleButton.focus();
    }
  });

  // Prevent outside-click from immediately closing after opening
  menu.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener("click", (e) => {
    if (!toggleButton.contains(e.target) && !menu.contains(e.target)) {
      closeMenu();
    }
  });

  // Focus trap: keep Tab navigation inside the menu when open
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (menu.classList.contains('hidden')) return;
    const items = Array.from(menu.querySelectorAll('[role="menuitem"],select,button,a'))
      .filter(el => !el.hasAttribute('disabled'));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !menu.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !menu.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Avatar fallback for header small avatar as well
  const smallAvatar = target.querySelector('img.w-7.h-7');
  if (smallAvatar) {
    smallAvatar.addEventListener('error', () => {
      smallAvatar.src = 'assets/default-avatar.svg';
    }, { once: true });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMenu();
      toggleButton.focus();
    }
  });

  // Keyboard navigation within the menu (roving)
  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    if (!items.length) return;
    const current = document.activeElement;
    const idx = items.indexOf(current);
    const focusAt = (i) => { if (items[i]) items[i].focus(); };
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focusAt((idx + 1) % items.length); break;
      case 'ArrowUp': e.preventDefault(); focusAt((idx - 1 + items.length) % items.length); break;
      case 'Home': e.preventDefault(); focusAt(0); break;
      case 'End': e.preventDefault(); focusAt(items.length - 1); break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) focusAt((idx - 1 + items.length) % items.length);
        else focusAt((idx + 1) % items.length);
        break;
    }
  });

  // Language select change handler with localStorage sync and AppState update
  if (languageSelect) {
    languageSelect.addEventListener("change", (e) => {
      const newLang = e.target.value;
      AppState.setLanguage(newLang);
    });
  }

  // Set initial theme select value explicitly
  if (themeModeSelect) {
    themeModeSelect.value = (AppState.themeMode === 'system' || AppState.themeMode === 'autoSun')
      ? AppState.themeMode
      : AppState.theme;
  }

  // Theme mode change handler
  if (themeModeSelect) {
    themeModeSelect.addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === 'system') {
        AppState.setThemeMode('system');
      } else if (v === 'autoSun') {
        AppState.setThemeMode('autoSun');
      } else {
        AppState.setThemeMode('manual');
        AppState.setTheme(v);
      }
      // Update quick icon
      if (themeQuickToggleIcon) themeQuickToggleIcon.textContent = AppState.theme === 'dark' ? '🌙' : '☀️';
    });
  }

  // Avatar fallback via JS (no inline onerror)
  const avatarImgs = target.querySelectorAll('img');
  avatarImgs.forEach(img => {
    img.addEventListener('error', () => {
      img.src = 'assets/default-avatar.svg';
    }, { once: true });
  });

  if (themeQuickToggle) {
    themeQuickToggle.addEventListener('click', () => {
      // Force manual toggle between light/dark and clear any listeners
      try { AppState.clearThemeTimers?.(); } catch (_) {}
      AppState.setThemeMode('manual');
      const next = AppState.theme === 'dark' ? 'light' : 'dark';
      AppState.setTheme(next);
      // Persist immediate state for early-applying logic
      try {
        const saved = JSON.parse(localStorage.getItem('AppState') || '{}');
        saved.theme = next; saved.themeMode = 'manual';
        localStorage.setItem('AppState', JSON.stringify(saved));
      } catch (_) {}
      if (themeModeSelect) themeModeSelect.value = next;
      if (themeQuickToggleIcon) themeQuickToggleIcon.textContent = next === 'dark' ? '🌙' : '☀️';
    });
  }

  // Tenant select change handlers with localStorage sync and AppState update
  if (tenantSelectDropdown) {
    tenantSelectDropdown.addEventListener("change", (e) => {
      const newTenantId = e.target.value;
      localStorage.setItem('selectedTenantId', newTenantId);
      AppState.setTenant(newTenantId);
      syncTenantSelects(newTenantId);
    });
  }

  if (tenantSelectHeader) {
    tenantSelectHeader.addEventListener("change", (e) => {
      const newTenantId = e.target.value;
      localStorage.setItem('selectedTenantId', newTenantId);
      AppState.setTenant(newTenantId);
      syncTenantSelects(newTenantId);
    });
  }
}
