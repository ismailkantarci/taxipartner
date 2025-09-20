// modules/UserManagement/index.module.js
import { AppState } from '../core.state/app.state.module.js';

const UserManagementModule = {
  init(target) {
    target.innerHTML = `
      <h1 class="text-xl font-bold text-gray-700 dark:text-gray-200 mb-6">${AppState.getTranslation('users.title')}</h1>
      <div class="text-sm text-gray-600 dark:text-gray-300 mb-4">${AppState.getTranslation('users.activeUser')}: <strong>${AppState.currentUser?.fullName || '—'}</strong></div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm text-left text-gray-700 dark:text-gray-200 border dark:border-gray-700">
          <thead class="bg-gray-100 dark:bg-gray-700 font-semibold text-gray-600 dark:text-gray-200">
            <tr>
              <th class="p-2 border dark:border-gray-700">${AppState.getTranslation('users.fullName')}</th>
              <th class="p-2 border dark:border-gray-700">${AppState.getTranslation('users.email')}</th>
              <th class="p-2 border dark:border-gray-700">${AppState.getTranslation('users.role')}</th>
            </tr>
          </thead>
          <tbody id="userTableBody"></tbody>
        </table>
      </div>
    `;

    fetch(new URL('./user-list.json', import.meta.url).href)
      .then(res => res.json())
      .then(users => {
        const tbody = target.querySelector('#userTableBody');
        tbody.innerHTML = users.map(user => `
          <tr class="border-b dark:border-gray-700">
            <td class="p-2 border dark:border-gray-700 dark:text-gray-300">${user.fullName}</td>
            <td class="p-2 border dark:border-gray-700 dark:text-gray-300">${user.email}</td>
            <td class="p-2 border dark:border-gray-700 dark:text-gray-300">${user.role}</td>
          </tr>
        `).join('');
      })
      .catch(err => {
        target.innerHTML += `<p class="text-red-500 mt-4">${AppState.getTranslation?.('users.load_failed') || 'User list failed to load.'}</p>`;
        console.error('user-list.json yüklenemedi:', err);
      });
  }
};

export default UserManagementModule;
