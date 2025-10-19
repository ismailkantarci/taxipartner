import {
  createPhoneInput,
  PHONE_INPUT_STYLES
} from '../../components/phone-input/phone-input.js';

const phoneInput = document.getElementById('demoPhone');
const formatOut = document.getElementById('formatOut');
const countryOut = document.getElementById('countryOut');
const validOut = document.getElementById('validOut');

function injectStyles() {
  const styleId = 'tp-demo-phone-styles';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = PHONE_INPUT_STYLES;
  document.head.append(style);
}

function initialise() {
  if (!phoneInput) return;
  injectStyles();

  const control = createPhoneInput(phoneInput, {
    preferredCountries: ['at', 'de', 'tr', 'ua'],
    onChange({ phone, country, isValid }) {
      formatOut.textContent = phone ?? '—';
      countryOut.textContent = country ?? '—';
      validOut.textContent = isValid ? 'Evet' : 'Hayır';
    }
  });

  phoneInput.addEventListener('keyup', () => {
    formatOut.textContent = control.formatE164() ?? '—';
    countryOut.textContent = control.getSelectedCountry() ?? '—';
    validOut.textContent = control.isValid() ? 'Evet' : 'Hayır';
  });
}

document.addEventListener('DOMContentLoaded', initialise);
