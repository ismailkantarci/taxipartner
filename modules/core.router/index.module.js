// modules/core.router/index.module.js
import { ModuleLoader } from '../core.moduleLoader/index.module.js';
import { Telemetry } from '../core.telemetry/index.module.js';

const routes = {
  '/': 'Dashboard',
  '/releases': 'ReleaseManagement',
  '/users': 'UserManagement',
  '/settings': 'Settings',
  '/analytics': 'Analytics',
  '/404': 'NotFound',
  '/reports': 'Dashboard'
};

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
      if ((key === '/users' || key === '/settings' || key === '/releases' || key === '/analytics') && !isAdmin) {
        await ModuleLoader.load('AccessDenied', { append: false });
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
        a.classList.toggle('bg-gray-100', isActive);
        a.classList.toggle('font-semibold', isActive);
      });
    } catch {}
  },
  async init() {
    window.addEventListener('hashchange', () => this.navigate(parseHash()));
    await this.navigate(parseHash());
  }
};
