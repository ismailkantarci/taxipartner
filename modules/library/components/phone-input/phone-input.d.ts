export interface PhoneInputChangeDetail {
  phone: string | null;
  country: string | null;
  isValid: boolean;
}

export interface PhoneInputOptions {
  nationalMode?: boolean;
  formatOnDisplay?: boolean;
  separateDialCode?: boolean;
  placeholderNumberType?: string;
  autoPlaceholder?: string;
  preferredCountries?: string[];
  utilsScript?: string;
  initialCountry?: string;
  countryGroups?: string[];
  onReady?(instance: unknown): void;
  onChange?(detail: PhoneInputChangeDetail): void;
  [key: string]: unknown;
}

export interface PhoneInputController {
  getInstance(): unknown;
  formatE164(): string | null;
  getSelectedCountry(): string | null;
  isValid(): boolean;
  setNumber(value: string | null | undefined): void;
  destroy(): void;
}

export function createPhoneInput(
  input: HTMLInputElement,
  options?: PhoneInputOptions
): PhoneInputController;

export function formatE164(instance: unknown): string | null;
export function isValidNumber(instance: unknown): boolean;
export function getSelectedCountryCode(instance: unknown): string | null;

export const PHONE_INPUT_STYLES: string;
export const DEFAULT_COUNTRY_ORDER: string[];
