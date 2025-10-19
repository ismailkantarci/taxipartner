import { createPhoneInput, PHONE_INPUT_STYLES } from '@taxipartner/library/components/phone-input/phone-input.js';

const STYLE_ID = 'storybook-phone-input-styles';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    ${PHONE_INPUT_STYLES}
    .storybook-phone-wrapper {
      display: grid;
      gap: 0.75rem;
      max-width: 360px;
    }
    .storybook-phone-metadata {
      font-family: ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 0.8rem;
      background: rgba(15, 23, 42, 0.04);
      border-radius: 0.5rem;
      padding: 0.75rem;
      border: 1px solid rgba(15, 23, 42, 0.08);
      white-space: pre-wrap;
      word-break: break-all;
    }
  `;
  document.head.append(style);
}

const Template = (args) => {
  ensureStyles();

  const wrapper = document.createElement('div');
  wrapper.className = 'storybook-phone-wrapper';
  wrapper.innerHTML = `
    <label for="storybook-phone-input">Telefon</label>
    <input id="storybook-phone-input" type="tel" placeholder="+43 660 123 45 67" />
    <div class="storybook-phone-metadata" data-role="metadata"></div>
  `;

  const input = wrapper.querySelector('input');
  const metadata = wrapper.querySelector('[data-role="metadata"]');

  const control = createPhoneInput(input, {
    preferredCountries: args.preferredCountries,
    initialCountry: args.initialCountry,
    onChange({ phone, country, isValid }) {
      metadata.textContent = JSON.stringify({ phone, country, isValid }, null, 2);
    }
  });

  if (args.value) {
    control.setNumber(args.value);
  }

  wrapper.addEventListener(
    'DOMNodeRemoved',
    () => {
      control.destroy();
    },
    { once: true }
  );

  return wrapper;
};

export default {
  title: 'Library/Phone Input',
  render: Template,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    preferredCountries: {
      control: { type: 'object' },
      description: 'Preferred country order passed to intl-tel-input'
    },
    initialCountry: {
      control: { type: 'text' },
      description: 'Initial ISO country code'
    },
    value: {
      control: { type: 'text' },
      description: 'Initial phone number value passed to the component'
    }
  }
};

export const Default = {
  args: {
    preferredCountries: ['at', 'de', 'tr', 'ua'],
    initialCountry: 'at',
    value: '+436601234567'
  }
};

export const Empty = {
  args: {
    preferredCountries: ['at', 'de', 'tr', 'ua'],
    initialCountry: 'at',
    value: ''
  }
};
