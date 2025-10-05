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
    if (
      hash.startsWith('#/users') ||
      hash.startsWith('#/permissions') ||
      hash.startsWith('#/audit') ||
      hash.startsWith('#/tasks') ||
      hash.startsWith('#/notifications') ||
      hash.startsWith('#/tenants') ||
      hash.startsWith('#/companies')
    ) {
      return;
    }
    location.hash = '#/users';
  }

  window.addEventListener('hashchange', render);
  render();
}
