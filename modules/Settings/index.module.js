// modules/Settings/index.module.js
import { AppState } from '../core.state/app.state.module.js';

const SettingsModule = {
  init(target) {
    target.innerHTML = `
      <h1 class="text-xl font-bold text-gray-700 dark:text-gray-200 mb-6">${AppState.getTranslation('settings.title')}</h1>
      <div class="space-y-4">
        <div>
          <label class="block text-sm text-gray-500 dark:text-gray-300 mb-1">${AppState.getTranslation('settings.language')}</label>
          <select id="langSelect" class="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-2 py-1 text-sm">
            <option value="de-AT">Deutsch</option>
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-500 dark:text-gray-300 mb-1">${AppState.getTranslation('settings.theme')}</label>
          <select id="themeSelect" class="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-2 py-1 text-sm">
            <option value="light">${AppState.getTranslation('header.theme.light')}</option>
            <option value="dark">${AppState.getTranslation('header.theme.dark')}</option>
            <option value="system">${AppState.getTranslation('header.theme.system')}</option>
            <option value="autoSun">${AppState.getTranslation('header.theme.autoSun')}</option>
          </select>
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-300 mt-4">
          ${AppState.getTranslation('users.activeUser')}: <strong>${AppState.currentUser?.fullName || '---'}</strong>
        </div>
      </div>
    `;

    const langSelect = document.getElementById('langSelect');
    const themeSelect = document.getElementById('themeSelect');
    langSelect.value = AppState.language;
    themeSelect.value = AppState.themeMode === 'system' || AppState.themeMode === 'autoSun' ? AppState.themeMode : AppState.theme;

    langSelect.addEventListener('change', e => {
      AppState.setLanguage(e.target.value);
      location.reload();
    });

    themeSelect.addEventListener('change', e => {
      const v = e.target.value;
      if (v === 'system') {
        AppState.setThemeMode('system');
      } else if (v === 'autoSun') {
        AppState.setThemeMode('autoSun');
      } else {
        AppState.setThemeMode('manual');
        AppState.setTheme(v);
      }
    });
  }
};

export default SettingsModule;
