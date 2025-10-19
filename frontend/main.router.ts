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
import { attachVehiclesRoute } from './vehicles/routerAttach';
import { attachOrganizationsRoute } from './organizations/routerAttach';
import { attachMandatesRoute } from './mandates/routerAttach';

export function attachRoutes() {
  attachUsersRoute();
  attachPermissionsRoute();
  attachAuditRoute();
  attachTasksRoute();
  attachNotificationsRoute();
  attachTenantsRoute();
  attachCompaniesRoute();
  attachOUsRoute();
  attachVehiclesRoute();
  attachOrganizationsRoute();
  attachMandatesRoute();

  function render() {
    const hash = location.hash || '#/auth/login';
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
      hash.startsWith('#/companies') ||
      hash.startsWith('#/vehicles') ||
      hash.startsWith('#/organizations') ||
      hash.startsWith('#/mandates')
    ) {
      return;
    }
    location.hash = '#/auth/login';
  }

  window.addEventListener('hashchange', render);
  render();
}
