import { mountLogin } from './auth/loginPage';
import { mountInviteAccept } from './auth/inviteAcceptPage';
import { attachUsersRoute } from './users/routerAttach';
import { attachPermissionsRoute } from './permissions/routerAttach';
import { attachAuditRoute } from './audit/routerAttach';
import { attachTasksRoute } from './tasks/routerAttach';
import { attachNotificationsRoute } from './notifications/routerAttach';
import { attachTenantsRoute } from './tenants/routerAttach';
import { attachCompaniesRoute } from './companies/routerAttach';
import { attachOUsRoute } from './ous/routerAttach';
// MP-18 Fix Pack: align SPA whitelist with module navigation
const MP18_ALLOWED_ROUTES = ['#/users','#/permissions','#/audit','#/tasks','#/notifications','#/tenants','#/companies','#/ous','#/settings','#/analytics','#/releases','#/reports'];



attachUsersRoute();
attachPermissionsRoute();
attachAuditRoute();
attachTasksRoute();
attachNotificationsRoute();
attachTenantsRoute();
attachCompaniesRoute();
attachOUsRoute();

export function attachRoutes() {
  function render() {
    const hash = location.hash || '#/users';
    const host = document.getElementById('app') || document.body;
    if (hash.startsWith('#/auth/login')) {
      mountLogin(host);
      return;
    }
    if (hash.startsWith('#/invite/accept')) {
      mountInviteAccept(host);
      return;
    }
    if (MP18_ALLOWED_ROUTES.some((route) => hash.startsWith(route))) {
      return;
    }
    if (hash && hash !== '#/users') {
      alert('Bu sayfa yüklenemedi, kullanıcı bölümüne yönlendirildiniz.');
    }
    location.hash = '#/users';
  }

  window.addEventListener('hashchange', render);
  render();
}
