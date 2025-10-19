import { getActiveLocale } from './index';
const normalizeDate = (input) => input instanceof Date ? input : new Date(input);
const GROUPING_REPLACEMENTS = {
    space: ' ',
    dot: '.'
};
export const formatDate = (value, options) => {
    const locale = getActiveLocale();
    const hasExplicitDateParts = options
        ? ['weekday', 'year', 'month', 'day'].some(key => key in options)
        : false;
    const hasExplicitTimeParts = options
        ? ['hour', 'minute', 'second'].some(key => key in options)
        : false;
    const baseOptions = {
        ...(options ?? {})
    };
    if (!('dateStyle' in baseOptions) && !hasExplicitDateParts && !hasExplicitTimeParts) {
        baseOptions.dateStyle = locale.dateStyle;
    }
    const formatter = new Intl.DateTimeFormat(locale.locale, baseOptions);
    return formatter.format(normalizeDate(value));
};
const applyGrouping = (formattedParts, grouping) => {
    if (grouping === 'auto') {
        return formattedParts.map(part => part.value).join('');
    }
    return formattedParts
        .map(part => {
        if (part.type === 'group') {
            return GROUPING_REPLACEMENTS[grouping];
        }
        return part.value;
    })
        .join('');
};
export const formatNumber = (value, options) => {
    const locale = getActiveLocale();
    const formatter = new Intl.NumberFormat(locale.locale, {
        maximumFractionDigits: 2,
        ...options
    });
    const parts = formatter.formatToParts(value);
    return applyGrouping(parts, locale.numberGrouping);
};
export const formatDateTime = (value, options) => {
    const locale = getActiveLocale();
    const hasExplicitDateParts = options
        ? ['weekday', 'year', 'month', 'day'].some(key => key in options)
        : false;
    const hasExplicitTimeParts = options
        ? ['hour', 'minute', 'second'].some(key => key in options)
        : false;
    const baseOptions = {
        ...(options ?? {})
    };
    if (!('dateStyle' in baseOptions) && !hasExplicitDateParts && !hasExplicitTimeParts) {
        baseOptions.dateStyle = locale.dateStyle;
    }
    if (!('timeStyle' in baseOptions) && !hasExplicitTimeParts && !hasExplicitDateParts) {
        baseOptions.timeStyle = 'short';
    }
    const formatter = new Intl.DateTimeFormat(locale.locale, baseOptions);
    return formatter.format(normalizeDate(value));
};
