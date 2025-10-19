// modules/core.router/index.module.js
import { ModuleLoader } from '../core.moduleLoader/index.module.js';
import { Telemetry } from '../core.telemetry/index.module.js';

const routes = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/iam/users': 'UserManagement',
  '/iam/roles': 'IAMRoles',
  '/iam/permissions': 'IAMPermissions',
  '/iam/sessions': 'IAMSessions',
  '/iam/audit-logs': 'IAMAuditLogs',
  '/tenants/tenants': 'Tenants',
  '/tenants/organizations': 'Organizations',
  '/tenants/companies': 'Companies',
  '/tenants/mandates': 'Mandates',
  '/tenants/ous': 'OUs',
  '/tenants/vehicles': 'Vehicles',
  '/program/goals': 'ProgramGoals',
  '/program/audits': 'ProgramAudits',
  '/compliance': 'Compliance',
  '/risk': 'Risk',
  '/assets': 'Assets',
  '/controls': 'Controls',
  '/secops': 'SecOps',
  '/system': 'System',
  '/404': 'NotFound'
};

const protectedRoutes = new Set(
  Object.keys(routes).filter((route) => !['/', '/dashboard', '/404'].includes(route))
);

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const path = (raw.split('?')[0] || '').trim();
  const normalized = path || '/';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export const Router = {
  current: null,
  async navigate(path) {
    Telemetry?.start?.('route');
    const key = path in routes ? path : '/404';
    const moduleName = routes[key];
    this.current = key;
    // Guard admin-only routes
    try {
      const user = (window.AppStateRef && window.AppStateRef.currentUser) || null;
      const isAdmin = !!(user && Array.isArray(user.roles) && user.roles.includes('admin'));
      if (protectedRoutes.has(key) && !isAdmin) {
        await ModuleLoader.load('AccessDenied', { append: false });
        Telemetry?.end?.('route', { route: key, blocked: true });
        document.dispatchEvent(new CustomEvent('router:navigated', { detail: { route: key } }));
        return;
      }
    } catch {}
    await ModuleLoader.load(moduleName, { append: false });
    Telemetry?.end?.('route', { route: key });
    try {
      const links = document.querySelectorAll('#sidebar a[href^="#/"]');
      links.forEach(a => {
        const isActive = a.getAttribute('href') === `#${key}`;
        a.setAttribute('aria-current', isActive ? 'page' : 'false');
        a.dataset.active = String(isActive);
        a.classList.toggle('bg-brand-50', isActive);
        a.classList.toggle('text-brand-700', isActive);
        a.classList.toggle('dark:bg-brand-500/20', isActive);
        a.classList.toggle('dark:text-brand-100', isActive);
        a.classList.toggle('text-gray-600', !isActive);
        a.classList.toggle('dark:text-gray-300', !isActive);
      });
    } catch {}
    document.dispatchEvent(new CustomEvent('router:navigated', { detail: { route: key } }));
  },
  async init() {
    window.addEventListener('hashchange', () => this.navigate(parseHash()));
    await this.navigate(parseHash());
  }
};
