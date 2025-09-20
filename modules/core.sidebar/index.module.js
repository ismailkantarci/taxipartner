import { AppState } from '../core.state/app.state.module.js';

export function loadSidebar(target, user) {
  // Apply the sidebar classes directly to the target (no aside wrapper)
  target.className = 'fixed top-0 left-0 z-40 w-72 h-screen bg-white dark:bg-gray-800 border-r dark:border-gray-700 text-gray-800 dark:text-gray-100 transform transition-transform -translate-x-full overflow-y-auto mt-14';
  target.id = 'sidebar';
  target.innerHTML = `
    <nav class="space-y-2 text-sm p-4">
      <div class="font-bold text-gray-600 dark:text-gray-300 mb-2">${AppState.getTranslation('sidebar.dashboard')}</div>
      <a href="#/" class="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">${AppState.getTranslation('sidebar.home')}</a>
      <a href="#/reports" class="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">${AppState.getTranslation('sidebar.reports')}</a>
      ${user.roles?.includes('admin') ? `
        <div class="font-bold text-gray-600 dark:text-gray-300 mt-4 mb-2">${AppState.getTranslation('sidebar.admin')}</div>
        <a href="#/releases" class="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">${AppState.getTranslation('sidebar.releaseManagement')}</a>
        <a href="#/users" class="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">${AppState.getTranslation('sidebar.userManagement')}</a>
        <a href="#/settings" class="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">${AppState.getTranslation('sidebar.settings')}</a>
        <a href="#/analytics" class="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">${AppState.getTranslation('sidebar.analytics') || 'Analytics'}</a>
      ` : ''}
    </nav>
  `;

  const toggleButton = document.getElementById('toggleSidebar');
  const sidebar = document.getElementById('sidebar');

  function updateMainOffset(isOpen) {
    const main = document.getElementById('modulContent');
    if (!main) return;

    if (window.innerWidth >= 768) {
      if (isOpen) {
        main.classList.add('ml-72');
      } else {
        main.classList.remove('ml-72');
      }
    } else {
      main.classList.remove('ml-72');
    }
  }

  // Initial offset (sidebar starts closed)
  updateMainOffset(false);

  if (toggleButton && sidebar) {
    toggleButton.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
      updateMainOffset(!sidebar.classList.contains('-translate-x-full'));
    });
  }

  // Close sidebar on any link click
  const allLinks = target.querySelectorAll('a[href^="#/"]');
  allLinks.forEach(link => {
    link.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      updateMainOffset(false);
    });
  });

  // (legacy close on non-router links removed)

  document.addEventListener('click', (e) => {
    if (!sidebar) return;
    if (!sidebar.classList.contains('-translate-x-full') && !sidebar.contains(e.target) && e.target !== toggleButton) {
      sidebar.classList.add('-translate-x-full');
      updateMainOffset(false);
    }
  });

  // Recalculate on resize for responsive correctness
  window.addEventListener('resize', () => {
    const isOpen = !sidebar.classList.contains('-translate-x-full');
    updateMainOffset(isOpen);
  });
}
