let intlTelInput;
let utilsScriptUrl;
let phoneInputStyles;

if (typeof window !== 'undefined') {
  const itiModule = await import('intl-tel-input');
  intlTelInput = itiModule.default ?? itiModule;
  phoneInputStyles = (await import('intl-tel-input/build/css/intlTelInput.css?inline')).default;
  utilsScriptUrl = (await import('intl-tel-input/build/js/utils.js?url')).default;
} else {
  intlTelInput = () => {
    throw new Error('intl-tel-input is only available in browser environments');
  };
  phoneInputStyles = '';
  utilsScriptUrl = '';
}
const defaultStyles = `${phoneInputStyles}
.iti {
  width: 100%;
}

.iti.iti--allow-dropdown[data-placeholder='true'] .iti__selected-flag,
.iti.tp-iti-empty .iti__selected-flag {
  visibility: hidden;
}

.iti.iti--allow-dropdown[data-placeholder='true'] .iti__flag-container .iti__flag,
.iti.tp-iti-empty .iti__flag-container .iti__flag {
  opacity: 0;
}

.iti.tp-iti-empty .iti__selected-flag {
  width: 0;
  min-width: 0;
  pointer-events: none;
}

.iti input.iti__tel-input,
.iti input.iti__tel-input[type='tel'],
.iti input.iti__tel-input[type='text'] {
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid var(--tp-phone-border, #cbd5f5);
  background-color: var(--tp-phone-bg, #ffffff);
  color: var(--tp-phone-fg, #0f172a);
  padding-inline-start: 3rem;
  padding-inline-end: 0.75rem;
  padding-block: 0.55rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  transition: border 0.15s ease, box-shadow 0.15s ease;
}

.iti input.iti__tel-input:focus {
  border-color: var(--tp-phone-focus-border, #2563eb);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
  outline: none;
}

.iti input.iti__tel-input::placeholder {
  color: var(--tp-phone-placeholder, #64748b);
}

.dark .iti input.iti__tel-input,
.dark .iti input.iti__tel-input[type='tel'],
.dark .iti input.iti__tel-input[type='text'] {
  border-color: var(--tp-phone-border-dark, #1f2937);
  background-color: var(--tp-phone-bg-dark, #0b1220);
  color: var(--tp-phone-fg-dark, #e2e8f0);
}

.dark .iti input.iti__tel-input:focus {
  border-color: var(--tp-phone-focus-border-dark, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

.dark .iti input.iti__tel-input::placeholder {
  color: var(--tp-phone-placeholder-dark, #9ca3af);
}

.iti__selected-flag {
  border-right: 1px solid var(--tp-phone-border, #cbd5f5);
  padding-inline: 0.65rem;
  height: 100%;
}

.dark .iti__selected-flag {
  border-color: var(--tp-phone-border-dark, #1f2937);
}

.iti__arrow {
  border-top-color: inherit;
}

.iti__country-list {
  background-color: var(--tp-phone-dropdown-bg, #ffffff);
  color: var(--tp-phone-dropdown-fg, #0f172a);
  border: 1px solid var(--tp-phone-dropdown-border, #cbd5f5);
  border-radius: 0.5rem;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.15);
}

.dark .iti__country-list {
  background-color: var(--tp-phone-dropdown-bg-dark, #111827);
  color: var(--tp-phone-dropdown-fg-dark, #f3f4f6);
  border-color: var(--tp-phone-dropdown-border-dark, #1f2937);
  box-shadow: 0 16px 40px rgba(2, 6, 23, 0.45);
}

.iti__country.iti__highlight {
  background-color: rgba(37, 99, 235, 0.12);
}

.dark .iti__country.iti__highlight {
  background-color: rgba(37, 99, 235, 0.25);
}

.iti__country-name {
  font-size: 0.875rem;
}

.iti__search-input {
  border-radius: 0.375rem;
  border: 1px solid var(--tp-phone-border, #cbd5f5);
  background-color: var(--tp-phone-bg, #ffffff);
  color: var(--tp-phone-fg, #0f172a);
}

.iti__search-input:focus {
  border-color: var(--tp-phone-focus-border, #2563eb);
  outline: none;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.dark .iti__search-input {
  border-color: var(--tp-phone-border-dark, #1f2937);
  background-color: var(--tp-phone-bg-dark, #0b1220);
  color: var(--tp-phone-fg-dark, #e2e8f0);
}

.dark .iti__search-input:focus {
  border-color: var(--tp-phone-focus-border-dark, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
}

.tp-iti-group-label {
  padding: 0.4rem 0.75rem 0.2rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tp-phone-group-fg, #64748b);
  pointer-events: none;
}

.dark .tp-iti-group-label {
  color: var(--tp-phone-group-fg-dark, #cbd5f5);
}

.tp-iti-divider {
  margin-block: 0.35rem;
}
`;

const DEFAULT_OPTIONS = {
  nationalMode: false,
  formatOnDisplay: true,
  separateDialCode: false,
  placeholderNumberType: 'MOBILE',
  autoPlaceholder: 'aggressive',
  preferredCountries: [],
  utilsScript: utilsScriptUrl
};

const DEFAULT_COUNTRY_ORDER = [
  'at',
  'de',
  'tr',
  'ch',
  'it',
  'fr',
  'es',
  'pt',
  'nl',
  'be',
  'lu',
  'li',
  'pl',
  'cz',
  'sk',
  'hu',
  'si',
  'hr',
  'ba',
  'rs',
  'bg',
  'ro',
  'gr',
  'se',
  'no',
  'dk',
  'fi',
  'ie',
  'gb',
  'is',
  'ee',
  'lv',
  'lt',
  'mt',
  'cy',
  'al',
  'mk',
  'ua',
  'md',
  'by',
  'sm',
  'mc',
  'ad',
  'va',
  'us',
  'ca',
  'mx',
  'br',
  'ar',
  'cl',
  'pe',
  'co',
  'uy',
  'py',
  'bo',
  'ec',
  've',
  'tt',
  'bb',
  'bs',
  'ag',
  'dm',
  'lc',
  'gd',
  'vc',
  'sr',
  'gy',
  'au',
  'nz',
  'jp',
  'kr',
  'cn',
  'hk',
  'sg',
  'my',
  'id',
  'ph',
  'th',
  'vn',
  'tw',
  'in',
  'pk',
  'bd',
  'lk',
  'kh',
  'la',
  'bn',
  'mm',
  'ae',
  'sa',
  'qa',
  'kw',
  'bh',
  'om',
  'jo',
  'il',
  'ps',
  'eg',
  'ma',
  'dz',
  'tn',
  'ly',
  'ng',
  'gh',
  'ke',
  'tz',
  'ug',
  'rw',
  'sn',
  'cm',
  'ci',
  'et',
  'za',
  'na',
  'bw',
  'zw',
  'mz'
];

function sortCountries(list, preferredOrder) {
  if (!list) {
    return;
  }

  const items = Array.from(list.querySelectorAll('.iti__country'));
  const orderMap = new Map();
  preferredOrder.forEach((code, index) => {
    orderMap.set(code.toLowerCase(), index);
  });

  items.sort((a, b) => {
    const codeA = a.getAttribute('data-country-code')?.toLowerCase() ?? '';
    const codeB = b.getAttribute('data-country-code')?.toLowerCase() ?? '';
    const indexA = orderMap.has(codeA) ? orderMap.get(codeA) : preferredOrder.length + items.indexOf(a);
    const indexB = orderMap.has(codeB) ? orderMap.get(codeB) : preferredOrder.length + items.indexOf(b);
    return indexA - indexB;
  });

  list.innerHTML = '';
  items.forEach((node) => list.append(node));
}

function applyFormattedDisplay(iti, fallbackValue) {
  const utils = getUtils();
  const format = utils?.numberFormat?.INTERNATIONAL;
  if (format !== undefined) {
    try {
      const formatted = iti.getNumber(format);
      if (formatted) {
        return formatted;
      }
    } catch {}
  }
  return fallbackValue;
}

/**
 * TAXIPartner ortak telefon numarası bileşenini başlatır.
 *
 * @param {HTMLInputElement} input hedef input elemanı
 * @param {object} [options] intl-tel-input seçenekleri ve kancaları
 * @param {(iti: import('intl-tel-input').Plugin) => void} [options.onReady] init sonrası çalışacak kanca
 * @param {(payload: { phone: string | null; country: string | null; isValid: boolean }) => void} [options.onChange]
 */
export function createPhoneInput(input, options = {}) {
  if (!input) {
    throw new Error('[library/phone-input] Gecerli bir input elemani zorunludur.');
  }

  const { onReady, onChange, countryGroups, preferredCountries, ...intlOptions } = options;

  let isFormatting = false;

  const effectiveInitialCountry = intlOptions.initialCountry ?? preferredCountries?.[0] ?? null;

  const initOptions = {
    ...DEFAULT_OPTIONS,
    ...intlOptions,
    preferredCountries: preferredCountries ?? DEFAULT_OPTIONS.preferredCountries
  };

  if (!initOptions.initialCountry && effectiveInitialCountry) {
    initOptions.initialCountry = effectiveInitialCountry;
  }

  const iti = intlTelInput(input, initOptions);

  const listId = `iti-${iti.id}__country-listbox`;
  const findCountryList = () =>
    document.getElementById(listId) || iti.countryList || iti.ui?.countryList || iti.dropdownContent?.querySelector('.iti__country-list');

  const preferredOrder = countryGroups ?? DEFAULT_COUNTRY_ORDER;

  const ensureGrouped = () => {
    const list = findCountryList();
    if (!list || list.childElementCount === 0) {
      return false;
    }
    sortCountries(list, preferredOrder);
    return true;
  };

  if (!ensureGrouped()) {
    queueMicrotask(() => ensureGrouped());
    const observer = new MutationObserver(() => {
      if (ensureGrouped()) {
        observer.disconnect();
      }
    });
    const target = findCountryList() || iti.ui?.countryList || iti.dropdownContent || input.closest('.iti');
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
    setTimeout(() => ensureGrouped(), 10);
    setTimeout(() => ensureGrouped(), 100);
    setTimeout(() => ensureGrouped(), 500);
  }
  input.addEventListener('click', ensureGrouped);
  input.addEventListener('open:countrydropdown', ensureGrouped);

  const wrapper = input.closest('.iti');
  const updatePlaceholderState = () => {
    if (!wrapper) return;
    if (input.value) {
      wrapper.removeAttribute('data-placeholder');
      wrapper.classList.remove('tp-iti-empty');
    } else {
      wrapper.setAttribute('data-placeholder', 'true');
      wrapper.classList.add('tp-iti-empty');
    }
  };

  const notifyChange = () => {
    onChange?.({
      phone: formatE164(iti),
      country: getSelectedCountryCode(iti),
      isValid: isValidNumber(iti)
    });
  };

  const clearInput = () => {
    isFormatting = true;
    iti.setNumber('');
    isFormatting = false;
    input.value = '';
    notifyChange();
    updatePlaceholderState();
  };

  const clearCountrySelection = () => {
    if (typeof iti._setCountry === 'function') {
      iti._setCountry('');
      try {
        iti._updateDialCode?.('');
      } catch {}
    } else {
      try {
        iti.setCountry('');
      } catch {}
    }
  };

  const setInternationalNumber = (value) => {
    isFormatting = true;
    iti.setNumber(value);
    input.value = applyFormattedDisplay(iti, value);
    isFormatting = false;
    notifyChange();
    updatePlaceholderState();
  };

  const handleNationalInput = (rawValue) => {
    const digitsOnly = rawValue.replace(/\D/g, '');
    if (!digitsOnly) {
      clearInput();
      clearCountrySelection();
      return;
    }

    let selectedData = iti.getSelectedCountryData() || {};
    if (!selectedData.iso2 && effectiveInitialCountry) {
      try {
        iti.setCountry(effectiveInitialCountry);
        selectedData = iti.getSelectedCountryData() || {};
      } catch {}
    }

    const dialCode = selectedData.dialCode ?? '';
    if (dialCode) {
      const national = digitsOnly.replace(/^0+/, '');
      const fullNumber = `+${dialCode}${national}`;
      setInternationalNumber(fullNumber);
    } else {
      isFormatting = true;
      iti.setNumber(digitsOnly);
      input.value = digitsOnly;
      isFormatting = false;
      notifyChange();
      updatePlaceholderState();
    }
  };

  const handleInput = () => {
    if (isFormatting) {
      return;
    }

    const currentValue = input.value;

    if (!currentValue) {
      clearInput();
      clearCountrySelection();
      return;
    }

    if (currentValue.trim().startsWith('+')) {
      setInternationalNumber(currentValue);
      return;
    }

    handleNationalInput(currentValue);
  };

  input.addEventListener('input', handleInput);
  input.addEventListener('blur', notifyChange);
  input.addEventListener('countrychange', notifyChange);

  onReady?.(iti);
  notifyChange();
  updatePlaceholderState();

  return {
    getInstance() {
      return iti;
    },
    formatE164() {
      return formatE164(iti);
    },
    getSelectedCountry() {
      return getSelectedCountryCode(iti);
    },
    isValid() {
      return isValidNumber(iti);
    },
    setNumber(value) {
      if (!value) {
        clearInput();
        clearCountrySelection();
        return;
      }
      if (String(value).trim().startsWith('+')) {
        setInternationalNumber(value);
        return;
      }
      handleNationalInput(String(value));
    },
    destroy() {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('blur', notifyChange);
      input.removeEventListener('countrychange', notifyChange);
      input.removeEventListener('click', ensureGrouped);
      input.removeEventListener('open:countrydropdown', ensureGrouped);
      iti.destroy();
    }
  };
}

function getUtils() {
  return typeof window !== 'undefined' ? window.intlTelInputUtils : undefined;
}

export function formatE164(iti) {
  const utils = getUtils();
  const format = utils?.numberFormat?.E164;
  const number = format !== undefined ? iti.getNumber(format) : iti.getNumber();
  return number || null;
}

export function isValidNumber(iti) {
  try {
    return iti.isValidNumber();
  } catch {
    return false;
  }
}

export function getSelectedCountryCode(iti) {
  const data = iti.getSelectedCountryData();
  return data?.iso2 ?? null;
}

export const PHONE_INPUT_STYLES = defaultStyles;

export { DEFAULT_COUNTRY_ORDER };
