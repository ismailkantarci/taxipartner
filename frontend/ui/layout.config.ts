/**
 * Configure where to inject the compact nav and language switcher.
 * The first matching selector will be used. If none matches, do nothing.
 */
export const HEADER_SELECTORS = [
  '#app-header',
  '.tp-header',
  'header.site-header',
  'header.app-header',
  'header'
];

export const SIDEBAR_SELECTORS = [
  '.tp-sidebar',
  'aside.sidebar',
  '.app-sidebar'
];

export const NOTIF_BADGE_SELECTORS = [
  '#notif-badge',
  '.notif-badge',
  "[data-role='notif-badge']"
];
