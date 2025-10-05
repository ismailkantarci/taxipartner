// modules/UserManagement/index.module.js
import { AppState } from '../core.state/app.state.module.js';

const UserManagementModule = {
  init(target) {
    target.innerHTML = `
      <h1 class="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4">${AppState.getTranslation('users.title')}</h1>
      <div class="text-sm text-gray-600 dark:text-gray-300 mb-3">${AppState.getTranslation('users.activeUser')}: <strong>${AppState.currentUser?.fullName || '—'}</strong></div>
      <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <input id="userSearch" type="search" class="border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700" placeholder="${AppState.getTranslation?.('release.search_placeholder') || 'Search...'}"/>
        <label class="ml-2">${AppState.getTranslation?.('users.role') || 'Role'}:</label>
        <select id="userRole" class="border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700"></select>
        <span class="ml-auto text-gray-500"><span id="userCount">0</span></span>
      </div>
      <div class="overflow-x-auto border rounded dark:border-gray-700">
        <table class="min-w-full text-sm text-left text-gray-700 dark:text-gray-200">
          <thead class="bg-gray-100 dark:bg-gray-700 font-semibold text-gray-600 dark:text-gray-200 sticky top-0">
            <tr>
              <th class="p-2 border-b dark:border-gray-700">${AppState.getTranslation('users.fullName')}</th>
              <th class="p-2 border-b dark:border-gray-700">${AppState.getTranslation('users.email')}</th>
              <th class="p-2 border-b dark:border-gray-700">${AppState.getTranslation('users.role')}</th>
            </tr>
          </thead>
          <tbody id="userTableBody"></tbody>
        </table>
      </div>
    `;

    const approvalsContainer = document.createElement('section');
    approvalsContainer.className = 'mt-6';
    target.appendChild(approvalsContainer);

    const currentUserId = AppState.currentUser?.email || AppState.currentUser?.fullName || 'demo-user';

    import('../../frontend/users/approvalsPage.ts')
      .then((mod) => {
        mod.mountApprovalsPage(approvalsContainer, String(currentUserId));
      })
      .catch((error) => {
        console.error('Approvals UI yüklenemedi:', error);
        approvalsContainer.innerHTML = '<p class="text-sm text-red-600">Onay arayüzü yüklenemedi.</p>';
      });

    fetch(new URL('./user-list.json', import.meta.url).href)
      .then(res => res.json())
      .then(users => {
        const tbody = target.querySelector('#userTableBody');
        const roleSel = target.querySelector('#userRole');
        const search = target.querySelector('#userSearch');
        const countEl = target.querySelector('#userCount');
        // populate roles
        const roles = Array.from(new Set(users.map(u=>u.role))).sort();
        roleSel.innerHTML = `<option value="">All</option>` + roles.map(r=>`<option value="${r}">${r}</option>`).join('');
        const render = () => {
          const q = (search.value||'').trim().toLowerCase();
          const r = roleSel.value||'';
          const data = users.filter(u=> (!r || u.role===r) && (!q || (u.fullName||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q)));
          countEl.textContent = `${data.length}/${users.length}`;
          tbody.innerHTML = data.map(user => `
            <tr class="odd:bg-gray-50 dark:odd:bg-gray-800/50">
              <td class="p-2 dark:text-gray-300">${user.fullName}</td>
              <td class="p-2 dark:text-gray-300">${user.email}</td>
              <td class="p-2 dark:text-gray-300">${user.role}</td>
            </tr>
          `).join('');
        };
        render();
        roleSel.addEventListener('change', render);
        search.addEventListener('input', render);
      })
      .catch(err => {
        target.innerHTML += `<p class="text-red-500 mt-4">${AppState.getTranslation?.('users.load_failed') || 'User list failed to load.'}</p>`;
        console.error('user-list.json yüklenemedi:', err);
      });
  }
};

export default UserManagementModule;
