import { beforeEach, describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatNumber } from '../format';
import { setActiveLocale } from '../index';

describe('i18n format helpers', () => {
  beforeEach(() => {
    setActiveLocale({
      locale: 'de-AT',
      dateStyle: 'medium',
      numberGrouping: 'auto'
    });
  });

  it('formats dates using the active locale and provided options', () => {
    setActiveLocale({
      locale: 'en-GB',
      dateStyle: 'short',
      numberGrouping: 'auto'
    });

    const formatted = formatDate('2024-02-01T00:00:00Z', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    expect(formatted).toBe('01/02/2024');
  });

  it('overrides number grouping when locale preferences demand it', () => {
    setActiveLocale({
      locale: 'tr-TR',
      dateStyle: 'medium',
      numberGrouping: 'space'
    });

    const formatted = formatNumber(12345.5, { maximumFractionDigits: 1 });
    expect(formatted).toBe('12 345,5');
  });

  it('formats combined date and time using locale defaults', () => {
    setActiveLocale({
      locale: 'de-AT',
      dateStyle: 'medium',
      numberGrouping: 'auto'
    });

    const formatted = formatDateTime('2024-05-10T18:30:00Z', {
      timeZone: 'UTC'
    });

    expect(formatted).toMatch(/10\.05\.2024/);
    expect(formatted).toMatch(/18:30/);
  });
});
