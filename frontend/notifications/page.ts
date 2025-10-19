import './page.css';
import {
  listNotifications,
  markNotificationRead,
  type NotificationItem,
  type NotificationsResponse,
  type NotificationMutationResponse
} from './api';
import { t } from '../i18n/index';
import { toastOk, toastErr } from '../ui/toast';
import { showError } from '../ui/error';

export function mountNotificationsPage(root: HTMLElement) {
  root.innerHTML = '';

  const wrap = el('div', 'wrap');
  const card = el('div', 'card');
  wrap.append(card);
  root.append(wrap);

  void load();

  async function load() {
    card.innerHTML = `<div class="header">${t('notifications')}<span class="small">${t('loading')}</span></div>`;
    try {
      const res = await listNotifications({});
      if (!res.ok) {
        card.innerHTML = `<div class="header">${t('notifications')}</div><div class="empty">${res.error || t('notificationsLoadFailed')}</div>`;
        toastErr(res.error || t('notificationsLoadFailed'));
        return;
      }
      const items = res.items ?? [];
      renderList(items);
    } catch (error) {
      card.innerHTML = `<div class="header">${t('notifications')}</div><div class="empty">${t('notificationsLoadFailed')}</div>`;
      toastErr(messageFromError(error));
    }
  }

  function renderList(items: NotificationItem[]) {
    if (!items.length) {
      card.innerHTML = `
        <div class="header">${t('notifications')}</div>
        <div class="empty">${t('noNotifications')}</div>
      `;
      return;
    }

    const header = el('div', 'header');
    header.innerHTML = `${t('notifications')} <span class="small">${items.length}</span>`;

    const fragment = document.createDocumentFragment();
    fragment.append(header);

    items.forEach((item) => {
      const row = el('div', 'item');
      row.innerHTML = `
        <div>
          <span class="badge">${escapeHtml(item.channel)}</span>
          <strong>${escapeHtml(item.subject ?? t('noSubject'))}</strong>
        </div>
        <div class="small">${new Date(item.createdAt).toLocaleString()}</div>
        <div class="body">${escapeHtml(item.body ?? '')}</div>
      `;
      if (!item.isRead) {
        const button = document.createElement('button');
        button.className = 'btn';
        button.textContent = t('markRead');
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const res: NotificationMutationResponse = await markNotificationRead(item.id);
            if (!res.ok) {
              const message = res.error || t('errorGeneric');
              showError(message);
              toastErr(message);
              button.disabled = false;
              return;
            }
            toastOk(t('toastMarked'));
            await load();
          } catch (error) {
            const message = messageFromError(error);
            showError(message);
            toastErr(message);
            button.disabled = false;
          }
        });
        row.append(button);
      } else {
        const badge = el('span', 'badge', t('read'));
        row.append(badge);
      }
      fragment.append(row);
    });

    card.innerHTML = '';
    card.append(fragment);
  }
}

function el(tag: string, className?: string, text?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function messageFromError(error: unknown) {
  if (error instanceof Error) return error.message;
  return t('errorGeneric');
}
