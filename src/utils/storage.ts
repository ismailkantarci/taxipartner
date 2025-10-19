type StorageValue<T> = {
  version: number;
  data: T;
};

const parseStorage = <T>(raw: string | null): T | undefined => {
  if (!raw) return undefined;
  try {
    const payload = JSON.parse(raw) as StorageValue<T> | T;
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return (payload as StorageValue<T>).data;
    }
    return payload as T;
  } catch {
    return undefined;
  }
};

export const storage = {
  get<T>(key: string, fallback?: T): T | undefined {
    if (typeof window === 'undefined') return fallback;
    try {
      return parseStorage<T>(window.localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      const payload: StorageValue<T> = { version: 1, data: value };
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Silent fail to avoid breaking UX
    }
  },
  remove(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
};

export default storage;
