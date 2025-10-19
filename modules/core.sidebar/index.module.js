import { AppState } from '../core.state/app.state.module.js';
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  UserCog,
  KeyRound,
  History,
  ScrollText,
  Building2,
  Building,
  Factory,
  FileText,
  Network,
  Car,
  Target,
  ClipboardList,
  ClipboardCheck,
  AlertTriangle,
  Package,
  SlidersHorizontal,
  Shield,
  Settings2,
  ChevronsLeftRight
} from 'lucide-static';

const LG_MEDIA = window.matchMedia?.('(min-width: 1024px)') ?? { matches: false, addEventListener: () => {}, removeEventListener: () => {} };

const NAV_STRUCTURE = [
  {
    headerKey: 'sidebar.section.dashboard',
    headerFallback: 'Dashboard',
    items: [
      { route: '/dashboard', labelKey: 'sidebar.item.dashboard', fallback: 'Dashboard', icon: LayoutDashboard }
    ]
  },
  {
    headerKey: 'sidebar.section.iam',
    headerFallback: 'Identity & Access',
    items: [
      { route: '/iam/users', labelKey: 'sidebar.item.iam.users', fallback: 'Users', icon: Users },
      { route: '/iam/roles', labelKey: 'sidebar.item.iam.roles', fallback: 'Roles', icon: UserCog },
      { route: '/iam/permissions', labelKey: 'sidebar.item.iam.permissions', fallback: 'Permissions', icon: KeyRound },
      { route: '/iam/sessions', labelKey: 'sidebar.item.iam.sessions', fallback: 'Sessions', icon: History },
      { route: '/iam/audit-logs', labelKey: 'sidebar.item.iam.auditLogs', fallback: 'Audit Logs', icon: ScrollText }
    ]
  },
  {
    headerKey: 'sidebar.section.tenant',
    headerFallback: 'Tenant',
    items: [
      { route: '/tenants/tenants', labelKey: 'sidebar.item.tenant.tenants', fallback: 'Tenants', icon: Building2 },
      { route: '/tenants/organizations', labelKey: 'sidebar.item.tenant.organizations', fallback: 'Organizations', icon: Building },
      { route: '/tenants/companies', labelKey: 'sidebar.item.tenant.companies', fallback: 'Companies', icon: Factory },
      { route: '/tenants/mandates', labelKey: 'sidebar.item.tenant.mandates', fallback: 'Mandates', icon: FileText },
      { route: '/tenants/ous', labelKey: 'sidebar.item.tenant.ous', fallback: 'Org Units', icon: Network },
      { route: '/tenants/vehicles', labelKey: 'sidebar.item.tenant.vehicles', fallback: 'Vehicles', icon: Car }
    ]
  },
  {
    headerKey: 'sidebar.section.program',
    headerFallback: 'Program',
    items: [
      { route: '/program/goals', labelKey: 'sidebar.item.program.goals', fallback: 'Goals', icon: Target },
      { route: '/program/audits', labelKey: 'sidebar.item.program.audits', fallback: 'Audits', icon: ClipboardList }
    ]
  },
  {
    headerKey: 'sidebar.section.operations',
    headerFallback: 'Operations',
    items: [
      { route: '/compliance', labelKey: 'sidebar.item.compliance', fallback: 'Compliance', icon: ClipboardCheck },
      { route: '/risk', labelKey: 'sidebar.item.risk', fallback: 'Risk', icon: AlertTriangle },
      { route: '/assets', labelKey: 'sidebar.item.assets', fallback: 'Assets', icon: Package },
      { route: '/controls', labelKey: 'sidebar.item.controls', fallback: 'Controls', icon: SlidersHorizontal },
      { route: '/secops', labelKey: 'sidebar.item.secops', fallback: 'SecOps', icon: Shield },
      { route: '/system', labelKey: 'sidebar.item.system', fallback: 'System', icon: Settings2 }
    ]
  }
];

let sidebarEl = null;
let overlayEl = null;
let mainShellEl = null;
let collapseButton = null;
let collapseLabelEl = null;
let lastTrigger = null;
let listenersBound = false;

function t(key, fallback) {
  try {
    return AppState?.getTranslation?.(key) || fallback;
  } catch (error) {
    console.warn('[core.sidebar] translation missing:', key, error);
    return fallback;
  }
}

function iconMarkup(svg) {
  if (!svg) return '';
  return svg
    .replace('<svg', '<svg class="h-5 w-5" aria-hidden="true"')
    .replace(/width="[^"]+"/, 'width="20"')
    .replace(/height="[^"]+"/, 'height="20"');
}

function renderNavItem(item) {
  const label = t(item.labelKey, item.fallback);
  return `
    <a
      href="#${item.route}"
      data-route="${item.route}"
      class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-200 dark:hover:bg-gray-800 group-data-[collapsed=true]/sidebar:justify-center group-data-[collapsed=true]/sidebar:px-2"
      aria-label="${label}"
    >
      <span class="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        ${iconMarkup(item.icon)}
      </span>
      <span class="truncate group-data-[collapsed=true]/sidebar:hidden">${label}</span>
    </a>
  `;
}

function renderSection(section) {
  const heading = t(section.headerKey, section.headerFallback);
  return `
    <div class="space-y-1">
      <p class="px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition-opacity dark:text-gray-400 group-data-[collapsed=true]/sidebar:hidden">
        ${heading}
      </p>
      <div class="space-y-1">
        ${section.items.map(renderNavItem).join('')}
      </div>
    </div>
  `;
}

function renderSidebarShell() {
  const brand = t('header.appTitle', 'TAXIPartner Admin');
  const tenantLabelKey = 'sidebar.activeTenant';
  const collapseLabel = t('sidebar.collapse', 'Collapse sidebar');
  const expandLabel = t('sidebar.expand', 'Expand sidebar');
  return `
    <div class="flex h-full flex-col overflow-y-auto bg-white dark:bg-gray-900">
      <div class="flex items-center gap-3 border-b border-gray-200 px-4 py-4 dark:border-gray-800">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold uppercase text-white dark:bg-brand-400">TP</div>
        <div class="min-w-0 group-data-[collapsed=true]/sidebar:hidden">
      <p class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">${brand}</p>
          <p class="truncate text-xs text-gray-500 dark:text-gray-400" data-active-tenant-label>${t(tenantLabelKey, 'Active tenant')}</p>
      </div>
    </div>
      <nav class="flex-1 space-y-5 px-2 py-4" aria-label="${t('sidebar.navLabel', 'Primary')}">
        ${NAV_STRUCTURE.map(renderSection).join('')}
      </nav>
      <div class="mt-auto border-t border-gray-200 px-2 py-3 dark:border-gray-800">
        <button
          type="button"
          data-action="sidebar-collapse"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-200 dark:hover:bg-gray-800 group-data-[collapsed=true]/sidebar:justify-center group-data-[collapsed=true]/sidebar:px-2"
        >
          <span class="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            ${iconMarkup(ChevronsLeftRight)}
          </span>
          <span class="truncate group-data-[collapsed=true]/sidebar:hidden" data-role="collapse-label">${collapseLabel}</span>
          <span class="sr-only" data-role="collapse-alt">${expandLabel}</span>
        </button>
      </div>
    </div>
  `;
}

function emitSidebarState() {
  document.dispatchEvent(
    new CustomEvent('sidebar:state', {
      detail: {
        open: !!AppState.sidebar.open,
        mode: AppState.sidebar.mode
      }
    })
  );
}

function updateCollapseLabel() {
  if (!collapseButton || !collapseLabelEl) return;
  const expandedText = collapseLabelEl.textContent;
  const collapsedText = collapseButton.querySelector('[data-role="collapse-alt"]')?.textContent || '';
  if (AppState.isSidebarCollapsed()) {
    collapseLabelEl.textContent = collapsedText || 'Expand sidebar';
  } else if (expandedText) {
    const label = t('sidebar.collapse', expandedText);
    collapseLabelEl.textContent = label;
  }
}

function resolveActiveTenantName() {
  const selected = AppState.tenant;
  const currentUser = AppState.currentUser;
  if (!currentUser || !Array.isArray(currentUser.tenants)) return '';
  const match = currentUser.tenants.find(t => t.tenantId === selected) || currentUser.tenants[0];
  return match?.legalName || '';
}

export function refreshActiveTenantLabel(explicitName) {
  const labelEl = sidebarEl?.querySelector('[data-active-tenant-label]');
  if (!labelEl) return;
  const name = explicitName || resolveActiveTenantName();
  if (name) {
    labelEl.textContent = name;
  } else {
    labelEl.textContent = t('sidebar.activeTenantEmpty', 'No tenant selected');
  }
}

function applyMode() {
  if (!sidebarEl) return;
  const collapsed = AppState.isSidebarCollapsed();
  sidebarEl.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
  if (mainShellEl) {
    // Ensure Tailwind keeps both classes in output by referencing them here.
    const expandedClass = 'lg:ml-72';
    const collapsedClass = 'lg:ml-20';
    mainShellEl.classList.toggle(expandedClass, !collapsed);
    mainShellEl.classList.toggle(collapsedClass, collapsed);
  }
  updateCollapseLabel();
  emitSidebarState();
}

function applyOpenState() {
  if (!sidebarEl) return;
  const isDesktop = !!LG_MEDIA.matches;
  if (isDesktop) {
    sidebarEl.classList.remove('-translate-x-full');
    overlayEl?.classList.add('hidden');
    overlayEl?.setAttribute('aria-hidden', 'true');
    AppState.setSidebarOpen(false);
  } else if (AppState.sidebar.open) {
    sidebarEl.classList.remove('-translate-x-full');
    overlayEl?.classList.remove('hidden');
    overlayEl?.setAttribute('aria-hidden', 'false');
    sidebarEl.focus?.();
  } else {
    sidebarEl.classList.add('-translate-x-full');
    overlayEl?.classList.add('hidden');
    overlayEl?.setAttribute('aria-hidden', 'true');
  }
  emitSidebarState();
}

function handleLinkActivation(event) {
  const isDesktop = !!LG_MEDIA.matches;
  if (isDesktop) return;
  AppState.setSidebarOpen(false);
  applyOpenState();
  if (event.currentTarget instanceof HTMLElement) {
    lastTrigger = event.currentTarget;
  }
}

function handleOverlayClick() {
  closeSidebarOverlay();
}

function handleEsc(event) {
  if (event.key === 'Escape' && AppState.sidebar.open) {
    closeSidebarOverlay();
  }
}

function handleResize() {
  applyMode();
  applyOpenState();
}

function bindGlobalListeners() {
  if (listenersBound) return;
  listenersBound = true;
  if (LG_MEDIA.addEventListener) {
    LG_MEDIA.addEventListener('change', handleResize);
  }
  document.addEventListener('keydown', handleEsc);
  overlayEl?.addEventListener('click', handleOverlayClick);
}

export function openSidebarOverlay(trigger) {
  if (trigger instanceof HTMLElement) {
    lastTrigger = trigger;
  } else {
    lastTrigger = document.activeElement;
  }
  AppState.setSidebarOpen(true);
  applyOpenState();
}

export function closeSidebarOverlay() {
  AppState.setSidebarOpen(false);
  applyOpenState();
  try {
    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      lastTrigger.focus();
    }
  } catch {}
}

export function toggleSidebarForViewport(trigger) {
  if (LG_MEDIA.matches) {
    toggleSidebarMode();
    return;
  }
  if (AppState.sidebar.open) {
    closeSidebarOverlay();
  } else {
    openSidebarOverlay(trigger);
  }
}

export function toggleSidebarMode() {
  AppState.setSidebarMode(AppState.isSidebarCollapsed() ? 'expanded' : 'collapsed');
  applyMode();
}

export function setSidebarMode(mode) {
  AppState.setSidebarMode(mode);
  applyMode();
}

export function loadSidebar(target, _user) {
  sidebarEl = target;
  overlayEl = document.getElementById('sidebarOverlay');
  mainShellEl = document.getElementById('mainShell');

  if (!sidebarEl) {
    console.error('[core.sidebar] Sidebar target not found');
    return;
  }

  sidebarEl.setAttribute('tabindex', '-1');
  sidebarEl.innerHTML = renderSidebarShell();
  collapseButton = sidebarEl.querySelector('[data-action="sidebar-collapse"]');
  collapseLabelEl = collapseButton?.querySelector('[data-role="collapse-label"]') || null;

  if (collapseButton) {
    collapseButton.addEventListener('click', () => {
      toggleSidebarMode();
      if (LG_MEDIA.matches) {
        try {
          collapseButton.focus();
        } catch {}
      }
    });
  }

  sidebarEl
    .querySelectorAll('a[data-route]')
    .forEach((link) => link.addEventListener('click', handleLinkActivation));

  bindGlobalListeners();
  applyMode();
  applyOpenState();
  refreshActiveTenantLabel();
}
