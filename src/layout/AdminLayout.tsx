import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Outlet, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { CalendarClock, Check, ChevronDown, Languages, Menu, Search, UserCircle, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PROGRAM_TABS, PRIMARY_ROUTES } from '../routes';
import storage from '../utils/storage';
import RoleTenantSwitcher from '../features/_dev/RoleTenantSwitcher';
import BellButton from '../components/notifications/BellButton';
import NotificationCenter from '../components/notifications/Center';
import { useCan } from '../lib/rbac/guard';
import type { PermissionKey } from '../lib/rbac/policy';
import { AVAILABLE_LANGUAGES, useTranslation } from '../lib/i18n';
import { useEffectiveSettings, useSettingsState, saveUserSettings } from '../lib/settings/store';
import type { LocalePrefs } from '../lib/settings/types';
import { useToast } from '../components/feedback/ToastProvider';
import RouteErrorBoundary from '../components/errors/RouteErrorBoundary';

type SidebarMode = 'expanded' | 'collapsed' | 'overlayOpen' | 'overlayClosed';

const SIDEBAR_STORAGE_KEY = 'tp-admin@sidebar';

const getInitialSidebar = (): SidebarMode => {
  if (typeof window === 'undefined') return 'expanded';
  const stored = storage.get<SidebarMode>(SIDEBAR_STORAGE_KEY, 'expanded');
  return window.innerWidth >= 1024 ? stored ?? 'expanded' : 'overlayClosed';
};

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  );

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return isDesktop;
};

const navSections = [
  {
    label: 'Program',
    items: [
      '/dashboard',
      '/program/goals',
      '/program/audits',
      '/iam/users',
      '/iam/approvals',
      '/iam/roles',
      '/iam/permissions',
      '/iam/sessions',
      '/iam/audit-logs'
    ]
  },
  {
    label: 'Tenants',
    items: [
      '/tenants',
      '/tenants/organizations',
      '/tenants/companies',
      '/tenants/shareholders',
      '/tenants/mandates',
      '/tenants/ous',
      '/tenants/vehicles'
    ]
  },
  {
    label: 'Operations',
    items: [
      '/assets',
      '/controls',
      '/analytics',
      '/risk',
      '/audit',
      '/release',
      '/library',
      '/secops',
      '/compliance',
      '/system/settings'
    ]
  }
];

const iconForPath = (path: string): LucideIcon | undefined =>
  PRIMARY_ROUTES.find(route => route.path === path)?.icon;

const preserveSearch = (search: URLSearchParams, pathname: string) => {
  const qs = search.toString();
  return qs ? `${pathname}?${qs}` : pathname;
};

const AdminLayout: React.FC = () => {
  const isDesktop = useIsDesktop();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() =>
    isDesktop ? getInitialSidebar() : 'overlayClosed'
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [languageSaving, setLanguageSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const languageTriggerRef = useRef<HTMLButtonElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const canRisk = useCan('risk.read');
  const canCompliance = useCan('compliance.read');
  const canManageTenants = useCan('tenants.manage');
  const canViewUsers = useCan('iam.users.read');
  const canViewRoles = useCan('iam.roles.read');
  const canViewPermissions = useCan('iam.permissions.read');
  const canViewSessions = useCan('iam.sessions.read');
  const canViewAuditLogs = useCan('reports.auditLogs.read');
  const canUseDevtools = useCan('system.devtools');
  const canViewSystemSettings = useCan('system.settings.read');
  const canViewAuditCenter = useCan('audit.read');
  const effectiveSettings = useEffectiveSettings();
  const { loaded: settingsLoaded } = useSettingsState();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const permissionFlags: Partial<Record<PermissionKey, boolean>> = useMemo(
    () => ({
      'risk.read': canRisk,
      'compliance.read': canCompliance,
      'tenants.manage': canManageTenants,
      'iam.users.read': canViewUsers,
      'iam.roles.read': canViewRoles,
      'iam.permissions.read': canViewPermissions,
      'iam.sessions.read': canViewSessions,
      'reports.auditLogs.read': canViewAuditLogs,
      'system.devtools': canUseDevtools,
      'system.settings.read': canViewSystemSettings,
      'audit.read': canViewAuditCenter
    }),
    [
      canRisk,
      canCompliance,
      canManageTenants,
      canViewUsers,
      canViewRoles,
      canViewPermissions,
      canViewSessions,
      canViewAuditLogs,
      canUseDevtools,
      canViewSystemSettings,
      canViewAuditCenter
    ]
  );

  useEffect(() => {
    setSidebarMode(prev => {
      if (isDesktop) {
        if (prev === 'overlayOpen' || prev === 'overlayClosed') {
          return 'expanded';
        }
        return prev;
      }
      if (prev === 'expanded' || prev === 'collapsed') {
        return 'overlayClosed';
      }
      return prev;
    });
  }, [isDesktop]);

  useEffect(() => {
    if (sidebarMode === 'expanded' || sidebarMode === 'collapsed') {
      storage.set(SIDEBAR_STORAGE_KEY, sidebarMode);
    }
  }, [sidebarMode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        setLanguageMenuOpen(false);
        if (!isDesktop && sidebarMode === 'overlayOpen') {
          setSidebarMode('overlayClosed');
          triggerRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isDesktop, sidebarMode]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        userMenuOpen &&
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        languageMenuOpen &&
        languageMenuRef.current &&
        event.target instanceof Node &&
        !languageMenuRef.current.contains(event.target) &&
        languageTriggerRef.current &&
        !languageTriggerRef.current.contains(event.target as Node)
      ) {
        setLanguageMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [languageMenuOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarMode(prev => {
      if (isDesktop) {
        return prev === 'collapsed' ? 'expanded' : 'collapsed';
      }
      return prev === 'overlayOpen' ? 'overlayClosed' : 'overlayOpen';
    });
  }, [isDesktop]);

  const handleLanguageSelect = useCallback(
    async (code: LocalePrefs['locale']) => {
      if (!settingsLoaded || languageSaving) {
        setLanguageMenuOpen(false);
        return;
      }
      if (effectiveSettings.locale.locale === code) {
        setLanguageMenuOpen(false);
        return;
      }
      setLanguageSaving(true);
      try {
        await saveUserSettings({
          locale: {
            ...effectiveSettings.locale,
            locale: code
          }
        });
        showToast({ title: t('settings.saved'), tone: 'success' });
      } catch (error) {
        console.error('[settings] quick language switch failed', error);
        showToast({ title: t('settings.error'), tone: 'error' });
      } finally {
        setLanguageSaving(false);
        setLanguageMenuOpen(false);
      }
    },
    [effectiveSettings.locale, languageSaving, settingsLoaded, showToast, t]
  );

  const mainSidebarClass = useMemo(() => {
    const base =
      'fixed inset-y-0 left-0 z-40 flex h-full w-72 flex-col border-r border-slate-200 bg-white/95 shadow-xl backdrop-blur transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900/95';
    if (isDesktop) {
      return sidebarMode === 'collapsed'
        ? `${base} -translate-x-full lg:translate-x-0 lg:w-20`
        : `${base} translate-x-0`;
    }
    return sidebarMode === 'overlayOpen'
      ? `${base} translate-x-0`
      : `${base} -translate-x-full`;
  }, [sidebarMode, isDesktop]);

  const overlayVisible = !isDesktop && sidebarMode === 'overlayOpen';

  const isProgramTab = location.pathname.startsWith('/program/');

  const searchString = searchParams.toString();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <aside className={mainSidebarClass} id="admin-sidebar" aria-label="Sidebar">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <span className="text-lg font-semibold">TP</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">TAXIPartner Admin</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Workspace: Vienna HQ
            </span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5 text-sm">
          {navSections.map(section => (
            <Fragment key={section.label}>
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {section.label}
              </p>
              <ul className="mb-4 space-y-1">
                {section.items.map(path => {
                  const route = PRIMARY_ROUTES.find(r => r.path === path);
                  if (!route) return null;
                  if (route.permission && permissionFlags[route.permission] === false) {
                    return null;
                  }
                  const Icon = route.icon;
                  return (
                    <li key={route.path}>
                      <NavLink
                        to={preserveSearch(searchParams, route.path)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-xl px-3 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:focus-visible:outline-slate-400 ${
                            isActive
                              ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                          }`
                        }
                        end={route.path === '/dashboard'}
                      >
                        {Icon && <Icon className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{route.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </Fragment>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            Router + Table skeleton ready
          </p>
        </div>
      </aside>

      {overlayVisible && (
        <button
          type="button"
          onClick={() => setSidebarMode('overlayClosed')}
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm transition-opacity lg:hidden"
          aria-label="Close sidebar overlay"
        />
      )}

      <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex h-16 items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                ref={triggerRef}
                aria-label="Toggle sidebar"
                aria-controls="admin-sidebar"
                aria-expanded={
                  sidebarMode === 'expanded' || sidebarMode === 'overlayOpen'
                }
                onClick={toggleSidebar}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-400"
              >
                {sidebarMode === 'overlayOpen' ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search modules or records…"
                  className="w-72 rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-700 shadow-inner focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-400"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-400"
              >
                <CalendarClock className="h-4 w-4" />
                Calendar
              </button>
              <div className="relative">
                <button
                  type="button"
                  ref={languageTriggerRef}
                  aria-haspopup="menu"
                  aria-expanded={languageMenuOpen}
                  onClick={() => setLanguageMenuOpen(prev => !prev)}
                  disabled={!settingsLoaded}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-400"
                >
                  <Languages className="h-4 w-4" aria-hidden="true" />
                  {effectiveSettings.locale.locale.toUpperCase()}
                  <span className="sr-only">{t('header.language.quick')}</span>
                </button>
                {languageMenuOpen ? (
                  <div
                    ref={languageMenuRef}
                    role="menu"
                    tabIndex={-1}
                    className="absolute right-0 z-40 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
                  >
                    <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('header.language.quick')}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {AVAILABLE_LANGUAGES.map(lang => {
                        const active = lang.code === effectiveSettings.locale.locale;
                        return (
                          <li key={lang.code}>
                            <button
                              type="button"
                              onClick={() => handleLanguageSelect(lang.code)}
                              disabled={languageSaving && active}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-400 ${
                                active ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <span>{t(lang.labelKey)}</span>
                              {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
              <BellButton
                isOpen={notificationsOpen}
                onToggle={() => setNotificationsOpen(prev => !prev)}
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(prev => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-400"
                >
                  <UserCircle className="h-5 w-5" />
                  admin@test.dev
                  <ChevronDown className="h-4 w-4" />
                </button>
                {userMenuOpen && (
                  <div
                    ref={menuRef}
                    role="menu"
                    tabIndex={-1}
                    className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
                  >
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Signed in as admin@test.dev
                    </p>
                    <button
                      type="button"
                      className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      Manage account
                    </button>
                    {import.meta.env.DEV ? (
                      <div className="mt-3">
                        <RoleTenantSwitcher />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
          {isProgramTab && (
            <div
              role="tablist"
              aria-label="Program navigation"
              className="flex gap-2 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800"
            >
              {PROGRAM_TABS.map(tab => (
                <NavLink
                  key={tab.to}
                  role="tab"
                  aria-selected={location.pathname === tab.to}
                  tabIndex={location.pathname === tab.to ? 0 : -1}
                  to={preserveSearch(searchParams, tab.to)}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2 font-medium capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:focus-visible:outline-slate-400 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </div>
          )}
        </header>

        <main className="flex flex-1 flex-col px-4 py-6 lg:px-8">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
      <NotificationCenter
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </div>
  );
};

export default AdminLayout;
