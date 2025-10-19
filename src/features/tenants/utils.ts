export const formatTenantDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

export const toTenantInputDate = (value?: string | null) => {
  if (!value) return '';
  return value.slice(0, 10);
};
