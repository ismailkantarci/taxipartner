export type RequiredField = {
  value: unknown;
  message: string;
};

export function showError(message: string) {
  const text = String(message ?? '').trim();
  if (!text) return;
  console.error(text);
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(text);
  }
}

export function requireFields(fields: RequiredField[]): boolean {
  for (const field of fields) {
    const value = field.value;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '' || normalized === null || normalized === undefined) {
      showError(field.message);
      return false;
    }
  }
  return true;
}
