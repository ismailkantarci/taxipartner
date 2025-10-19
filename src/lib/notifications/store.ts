import { useSyncExternalStore } from 'react';
import { nanoid } from 'nanoid';
import type { Notice, NoticeType } from './types';

const STORAGE_KEY = 'tp-admin@notifications';

let notices: Notice[] = [];
const subscribers = new Set<() => void>();

const notify = () => {
  subscribers.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('[notifications] listener error', error);
    }
  });
};

const persist = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notices));
  } catch (error) {
    console.warn('[notifications] persist failed', error);
  }
};

const load = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Notice[];
    if (Array.isArray(parsed)) {
      notices = parsed.map(item => ({
        ...item,
        read: Boolean(item.read),
        ts: item.ts ?? Date.now()
      }));
    }
  } catch (error) {
    console.warn('[notifications] load failed', error);
  }
};

if (typeof window !== 'undefined') {
  load();
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue) as Notice[];
        if (Array.isArray(parsed)) {
          notices = parsed;
          notify();
        }
      } catch (error) {
        console.warn('[notifications] storage event parse failed', error);
      }
    }
  });
}

const upsert = (next: Notice[]) => {
  notices = next.sort((a, b) => b.ts - a.ts);
  persist();
  notify();
};

export const list = () => notices.slice();

export const push = (notice: Omit<Notice, 'id' | 'ts' | 'read'>): string => {
  const id = nanoid();
  const entry: Notice = {
    id,
    ts: Date.now(),
    read: false,
    ...notice
  };
  upsert([entry, ...notices]);
  return id;
};

export const update = (id: string, changes: Partial<Omit<Notice, 'id'>>) => {
  let updated = false;
  const next = notices.map(item => {
    if (item.id !== id) return item;
    updated = true;
    const merged: Notice = {
      ...item,
      ...changes,
      ts: changes.ts ?? Date.now()
    };
    if (changes.read === undefined) {
      // preserve previous read flag unless explicitly provided
      merged.read = item.read;
    }
    return merged;
  });
  if (!updated) return;
  upsert(next);
};

export const markRead = (id: string) => {
  update(id, { read: true });
};

export const markUnread = (id: string) => {
  update(id, { read: false });
};

export const markAllRead = () => {
  const next = notices.map(item => ({ ...item, read: true }));
  upsert(next);
};

export const clear = () => {
  notices = [];
  persist();
  notify();
};

const subscribeInternal = (listener: () => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

const snapshotNotices = () => notices;

export const useNotices = () =>
  useSyncExternalStore(subscribeInternal, snapshotNotices, snapshotNotices);

export const unreadCount = () => notices.filter(notice => !notice.read).length;

export const useUnreadCount = () =>
  useSyncExternalStore(subscribeInternal, unreadCount, unreadCount);

export const createNotice = (type: NoticeType, title: string, body?: string, link?: string) =>
  push({ type, title, body, link });
