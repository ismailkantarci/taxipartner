import { describe, expect, it, beforeEach, vi } from 'vitest';

const dialCodes: Record<string, string> = {
  at: '43',
  de: '49',
  tr: '90',
  ua: '38',
  us: '1'
};

let nextId = 1;

vi.mock('intl-tel-input', () => {
  return {
    default: (input: HTMLInputElement) => {
      const id = nextId++;
      const listId = `iti-${id}__country-listbox`;
      const list = document.createElement('ul');
      list.id = listId;
      ['us', 'at', 'de', 'tr', 'ua'].forEach((code) => {
        const item = document.createElement('li');
        item.className = 'iti__country';
        item.setAttribute('data-country-code', code);
        list.append(item);
      });
      const dropdown = document.createElement('div');
      dropdown.append(list);

      const state = {
        dialCode: '',
        iso2: null as string | null,
        number: ''
      };

      return {
        id,
        countryList: list,
        dropdownContent: dropdown,
        getSelectedCountryData: () => ({
          iso2: state.iso2,
          dialCode: state.dialCode
        }),
        setCountry: (code: string | null) => {
          state.iso2 = code;
          state.dialCode = code ? (dialCodes as Record<string, string | undefined>)[code] ?? '' : '';
        },
        setNumber: (value: string) => {
          state.number = value;
          // simple heuristic for tests
          if (value.startsWith('+')) {
            const match = /^\+(\d{1,3})/.exec(value);
            if (match) {
              const dial = match[1];
              const iso = Object.entries(dialCodes).find(([, code]) => code === dial)?.[0];
              state.iso2 = iso ?? null;
              state.dialCode = dial;
            }
          }
          input.value = value;
        },
        getNumber: () => state.number,
        isValidNumber: () => state.number.startsWith('+') && state.number.length > 6,
        destroy: vi.fn()
      };
    }
  };
});

const setup = async () => {
  document.body.innerHTML = `<input id="phone" type="tel" />`;
  const { createPhoneInput } = await import('./phone-input.js');
  return createPhoneInput(document.getElementById('phone') as HTMLInputElement);
};

describe('createPhoneInput', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    nextId = 1;
  });

  it('accepts international numbers and exposes E.164 format', async () => {
    const component = await setup();
    const input = document.getElementById('phone') as HTMLInputElement;

    input.value = '+436641234567';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(component.formatE164()).toBe('+436641234567');
    expect(component.isValid()).toBe(true);
    component.destroy();
  });

  it('keeps best-effort formatting for national numbers without utils', async () => {
    const component = await setup();
    const input = document.getElementById('phone') as HTMLInputElement;

    input.value = '699';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(input.value).toBe('699');
    expect(component.formatE164()).toBe('699');
    component.destroy();
  });

  it('clears value correctly when input emptied', async () => {
    const component = await setup();
    const input = document.getElementById('phone') as HTMLInputElement;

    input.value = '+436641234567';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(component.formatE164()).toBe('+436641234567');

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(component.formatE164()).toBeNull();
    expect(component.isValid()).toBe(false);
    component.destroy();
  });
});
