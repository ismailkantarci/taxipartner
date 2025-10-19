// modules/Settings/index.module.js
import { AppState } from '../core.state/app.state.module.js';
import { IDENTITY_API_BASE, readAuthToken } from '../core.user/user.data.module.js';
import { createPhoneInput, PHONE_INPUT_STYLES } from '../library/components/phone-input/phone-input.js';

const PHONE_STYLE_ID = 'tp-phone-input-styles';

function ensurePhoneStyles() {
  if (document.getElementById(PHONE_STYLE_ID)) {
    return;
  }
  const styleEl = document.createElement('style');
  styleEl.id = PHONE_STYLE_ID;
  styleEl.textContent = PHONE_INPUT_STYLES;
  document.head.append(styleEl);
}

function deriveInitialCountry(profile) {
  const phone = profile?.phone ?? '';
  if (phone.startsWith('+43')) return 'at';
  if (phone.startsWith('+49')) return 'de';
  if (phone.startsWith('+90')) return 'tr';
  if (phone.startsWith('+380')) return 'ua';

  const lang = profile?.preferredLanguage ?? AppState.language ?? 'de-AT';
  if (lang.startsWith('tr')) return 'tr';
  if (lang.startsWith('en')) return 'us';
  if (lang.startsWith('de')) return 'de';
  return 'at';
}

const SettingsModule = {
  init(target) {
    const user = AppState.currentUser ?? {};
    const profile = user.rawProfile ?? {};
    const lang = AppState.language || profile.preferredLanguage || 'de-AT';
    const themeMode =
      AppState.themeMode === 'system' || AppState.themeMode === 'autoSun'
        ? AppState.themeMode
        : profile.preferredTheme ?? AppState.theme;

    target.innerHTML = `
      <h1 class="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4">${AppState.getTranslation('settings.title') || 'Profil Ayarları'}</h1>
      <form id="profileForm" class="max-w-xl bg-white dark:bg-gray-900 border dark:border-gray-700 rounded p-4 space-y-4">
        <div>
          <label class="block text-sm text-gray-500 dark:text-gray-300 mb-1" for="profileFullName">${AppState.getTranslation('settings.fullName') || 'Ad Soyad'}</label>
          <input id="profileFullName" name="fullName" type="text" class="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value="${user.fullName ?? ''}" autocomplete="name" />
        </div>
        <div>
          <label class="block text-sm text-gray-500 dark:text-gray-300 mb-1" for="profileEmail">${AppState.getTranslation('settings.email') || 'E-posta'}</label>
          <input id="profileEmail" type="email" class="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded px-2 py-2 text-sm" value="${user.email ?? ''}" disabled aria-disabled="true" />
        </div>
        <div>
          <label class="block text-sm text-gray-500 dark:text-gray-300 mb-1" for="profilePhone">${AppState.getTranslation('settings.phone') || 'Telefon'}</label>
          <input id="profilePhone" name="phone" type="tel" class="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value="${profile.phone ?? ''}" autocomplete="tel" />
        </div>
        <div>
          <label class="block text-sm text-gray-500 dark:text-gray-300 mb-1" for="profileLang">${AppState.getTranslation('settings.language')}</label>
          <select id="profileLang" name="preferredLanguage" class="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="de-AT" ${lang === 'de-AT' ? 'selected' : ''}>Deutsch</option>
            <option value="tr" ${lang === 'tr' ? 'selected' : ''}>Türkçe</option>
            <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-500 dark:text-gray-300 mb-1" for="profileTheme">${AppState.getTranslation('settings.theme')}</label>
          <select id="profileTheme" name="preferredTheme" class="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="light" ${themeMode === 'light' ? 'selected' : ''}>${AppState.getTranslation('header.theme.light')}</option>
            <option value="dark" ${themeMode === 'dark' ? 'selected' : ''}>${AppState.getTranslation('header.theme.dark')}</option>
            <option value="system" ${themeMode === 'system' ? 'selected' : ''}>${AppState.getTranslation('header.theme.system')}</option>
            <option value="autoSun" ${themeMode === 'autoSun' ? 'selected' : ''}>${AppState.getTranslation('header.theme.autoSun')}</option>
          </select>
        </div>
        <div class="flex items-center gap-3 pt-2 border-t dark:border-gray-700">
          <button type="submit" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-400">
            💾 <span>${AppState.getTranslation('settings.save') || 'Kaydet'}</span>
          </button>
          <p id="profileStatus" class="text-sm text-gray-500 dark:text-gray-400"></p>
        </div>
      </form>
    `;

    const form = document.getElementById('profileForm');
    const statusEl = document.getElementById('profileStatus');
    const fullNameInput = document.getElementById('profileFullName');
    const phoneInput = document.getElementById('profilePhone');
    const langSelect = document.getElementById('profileLang');
    const themeSelect = document.getElementById('profileTheme');

    let phoneControl = null;
    if (phoneInput) {
      ensurePhoneStyles();
      phoneControl = createPhoneInput(phoneInput, {
        preferredCountries: ['at', 'de', 'tr', 'ua'],
        initialCountry: deriveInitialCountry(profile),
        onReady(instance) {
          if (profile.phone) {
            instance.setNumber(profile.phone);
          }
        },
        onChange({ phone, isValid }) {
          if (!phone) {
            delete phoneInput.dataset.state;
            return;
          }
          phoneInput.dataset.state = isValid ? 'valid' : 'invalid';
        }
      });
    }

    function setStatus(message, tone = 'info') {
      if (!statusEl) return;
      const colors = {
        info: 'text-gray-500 dark:text-gray-400',
        success: 'text-green-600 dark:text-green-400',
        error: 'text-red-600 dark:text-red-400'
      };
      statusEl.className = `text-sm ${colors[tone] || colors.info}`;
      statusEl.textContent = message || '';
    }

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const token = readAuthToken();
      if (!token) {
        setStatus(AppState.getTranslation('settings.notAuthenticated') || 'Oturum bulunamadı.', 'error');
        return;
      }

      setStatus(AppState.getTranslation('settings.saving') || 'Kaydediliyor...', 'info');

      const formattedPhone = phoneControl?.formatE164();
      const payload = {
        fullName: fullNameInput?.value?.trim() || null,
        phone: formattedPhone ?? (phoneInput?.value?.trim() || null),
        preferredLanguage: langSelect?.value || null,
        preferredTheme: themeSelect?.value || null
      };

      try {
        const response = await fetch(`${IDENTITY_API_BASE}/profile`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          const message = error?.error || AppState.getTranslation('settings.saveError') || 'Kaydedilemedi.';
          setStatus(message, 'error');
          return;
        }

        const data = await response.json();
        const updated = data?.profile ?? {};

        const nextUser = {
          ...(AppState.currentUser ?? {}),
          fullName: updated.fullName ?? payload.fullName ?? AppState.currentUser?.fullName ?? '',
          phone: updated.phone ?? payload.phone ?? AppState.currentUser?.phone ?? null,
          language: updated.preferredLanguage ?? payload.preferredLanguage ?? AppState.currentUser?.language ?? 'de-AT',
          preferredTheme: updated.preferredTheme ?? payload.preferredTheme ?? AppState.currentUser?.preferredTheme ?? 'system',
          rawProfile: updated
        };
        AppState.setUser(nextUser);

        if (updated.preferredLanguage) {
          AppState.setLanguage(updated.preferredLanguage);
        }

        if (updated.preferredTheme) {
          if (updated.preferredTheme === 'system' || updated.preferredTheme === 'autoSun') {
            AppState.setThemeMode(updated.preferredTheme);
          } else {
            AppState.setThemeMode('manual');
            AppState.setTheme(updated.preferredTheme);
          }
        }

        setStatus(AppState.getTranslation('settings.saved') || 'Kaydedildi.', 'success');
      } catch (error) {
        console.error('[profileForm] save failed', error);
        setStatus(AppState.getTranslation('settings.saveError') || 'Kaydedilemedi.', 'error');
      }
    });
  }
};

export default SettingsModule;
