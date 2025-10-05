import { HEADER_SELECTORS, SIDEBAR_SELECTORS, NOTIF_BADGE_SELECTORS } from './layout.config';
import { mountLangSwitch } from '../i18n/langSwitch';
import { getUnreadCount } from '../notifications/api';

export async function integrateNavIntoExistingLayout() {
  if (document.querySelector('[data-tp-nav-integrated="1"]')) return;

  const host = queryFirst([...HEADER_SELECTORS, ...SIDEBAR_SELECTORS]);
  if (!host) return;

  const wrap = document.createElement('span');
  wrap.setAttribute('data-tp-nav-integrated', '1');
  wrap.style.cssText = 'display:inline-flex;gap:12px;align-items:center;margin-left:12px;font-size:14px;';
  const baseNotifLabel = 'Notifications';
  wrap.innerHTML = `
    <a href="#/users">${escapeHtml('Users')}</a>
    <a href="#/tasks">${escapeHtml('Tasks')}</a>
    <a href="#/notifications" data-tp-notif-link data-tp-base-label="${escapeHtml(baseNotifLabel)}">${escapeHtml(baseNotifLabel)}</a>
    <a href="#/permissions">${escapeHtml('Permissions')}</a>
    <a href="#/audit">${escapeHtml('Audit')}</a>
    <span id="tp-lang-box" style="margin-left:12px"></span>
  `;
  host.appendChild(wrap);

  mountLangSwitch(document.getElementById('tp-lang-box'));

  const notifLink = wrap.querySelector('[data-tp-notif-link]') as HTMLAnchorElement | null;

  await refreshUnread(wrap, notifLink);
  window.setInterval(() => {
    void refreshUnread(wrap, notifLink);
  }, 60_000);
}

function queryFirst(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) return el;
  }
  return null;
}

async function refreshUnread(wrap: HTMLElement, link: HTMLAnchorElement | null) {
  try {
    const response = await getUnreadCount();
    if (!response?.ok) return;
    const count = response.count ?? 0;
    const badgeHost = queryFirst(NOTIF_BADGE_SELECTORS);
    if (badgeHost) {
      badgeHost.textContent = String(count);
      return;
    }
    if (link) {
      const base = link.getAttribute('data-tp-base-label') || link.textContent || 'Notifications';
      link.textContent = count > 0 ? `${base} (${count})` : base;
    } else {
      // fallback: try to find link inside wrap again
      const fallback = wrap.querySelector('[data-tp-notif-link]') as HTMLAnchorElement | null;
      if (fallback) {
        const base = fallback.getAttribute('data-tp-base-label') || fallback.textContent || 'Notifications';
        fallback.textContent = count > 0 ? `${base} (${count})` : base;
      }
    }
  } catch {
    // ignore network errors silently
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
