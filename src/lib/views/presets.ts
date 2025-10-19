import { nanoid } from 'nanoid';

export type ViewOwnerType = 'user' | 'tenant' | 'system';

export type SavedView = {
  id: string;
  route: string;
  name: string;
  ownerType: ViewOwnerType;
  query: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
};

export type StoredViews = {
  user: SavedView[];
  tenant: SavedView[];
  system: SavedView[];
};

const STORAGE_KEY = 'tp-admin@saved-views';

const OWNER_PRIORITY: Record<ViewOwnerType, number> = {
  user: 3,
  tenant: 2,
  system: 1
};

const fallbackRoute = (raw: Record<string, unknown>): string => {
  const candidates = ['route', 'pathname', 'path', 'module'];
  for (const key of candidates) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim().length) {
      if (value.startsWith('/')) return value;
      if (key === 'module') {
        if (value === 'goals') return '/program/goals';
        if (value === 'compliance') return '/compliance/packages';
        if (value === 'risk') return '/risk';
      }
      return `/${value.replace(/^\//, '')}`;
    }
  }
  return '/program/goals';
};

const coerceOwnerType = (value: unknown): ViewOwnerType => {
  if (value === 'tenant') return 'tenant';
  if (value === 'system') return 'system';
  return 'user';
};

const normalizeQuery = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

const normalizeEntry = (raw: unknown): SavedView | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const route = fallbackRoute(record);
  const ownerType = coerceOwnerType(record.ownerType);
  const name =
    typeof record.name === 'string' && record.name.trim().length
      ? record.name.trim()
      : 'Untitled view';
  const createdAt =
    typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)
      ? record.createdAt
      : Date.now();
  const updatedAt =
    typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
      ? record.updatedAt
      : createdAt;
  const id =
    typeof record.id === 'string' && record.id.trim().length ? record.id : nanoid();
  const query = normalizeQuery(record.query);
  const isDefault = Boolean(record.isDefault);
  return {
    id,
    route,
    name,
    ownerType,
    query,
    createdAt,
    updatedAt,
    isDefault
  };
};

const normalizeList = (value: unknown): SavedView[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: SavedView[] = [];
  value.forEach(entry => {
    const normalized = normalizeEntry(entry);
    if (normalized && !seen.has(normalized.id)) {
      seen.add(normalized.id);
      result.push(normalized);
    }
  });
  return result;
};

const load = (): StoredViews => {
  if (typeof window === 'undefined') {
    return { user: [], tenant: [], system: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: [], tenant: [], system: [] };
    const parsed = JSON.parse(raw) as StoredViews;
    return {
      user: normalizeList(parsed?.user),
      tenant: normalizeList(parsed?.tenant),
      system: normalizeList(parsed?.system)
    };
  } catch (error) {
    console.warn('[views] failed to load presets', error);
    return { user: [], tenant: [], system: [] };
  }
};

const persist = (data: StoredViews) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[views] failed to persist presets', error);
  }
};

let cache = load();

const saveToCache = (next: StoredViews) => {
  cache = {
    user: normalizeList(next.user),
    tenant: normalizeList(next.tenant),
    system: normalizeList(next.system)
  };
  persist(cache);
};

export const listViews = (route: string): SavedView[] => {
  const combined = [...cache.system, ...cache.tenant, ...cache.user];
  return combined
    .filter(view => view.route === route)
    .sort((a, b) => {
      const ownerDiff = OWNER_PRIORITY[b.ownerType] - OWNER_PRIORITY[a.ownerType];
      if (ownerDiff !== 0) return ownerDiff;
      return b.updatedAt - a.updatedAt;
    });
};

export const createView = (view: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>): SavedView => {
  const normalizedRoute = view.route.startsWith('/') ? view.route : `/${view.route.replace(/^\//, '')}`;
  const record: SavedView = {
    ...view,
    name: view.name.trim(),
    query: { ...view.query },
    route: normalizedRoute,
    id: nanoid(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const next: StoredViews = {
    user: view.ownerType === 'user' ? [record, ...cache.user] : cache.user,
    tenant: view.ownerType === 'tenant' ? [record, ...cache.tenant] : cache.tenant,
    system: view.ownerType === 'system' ? [record, ...cache.system] : cache.system
  };
  saveToCache(next);
  return record;
};

export const updateView = (id: string, changes: Partial<SavedView>) => {
  const apply = (list: SavedView[]) =>
    list.map(item =>
      item.id === id
        ? {
            ...item,
            ...changes,
            updatedAt: Date.now()
          }
        : item
    );
  saveToCache({
    user: apply(cache.user),
    tenant: apply(cache.tenant),
    system: apply(cache.system)
  });
};

export const removeView = (id: string) => {
  saveToCache({
    user: cache.user.filter(item => item.id !== id),
    tenant: cache.tenant.filter(item => item.id !== id),
    system: cache.system.filter(item => item.id !== id)
  });
};

export const setDefaultView = (route: string, ownerType: ViewOwnerType, id: string) => {
  const apply = (list: SavedView[]) =>
    list.map(item =>
      item.route === route && item.ownerType === ownerType
        ? { ...item, isDefault: item.id === id }
        : item
    );
  saveToCache({
    user: apply(cache.user),
    tenant: apply(cache.tenant),
    system: apply(cache.system)
  });
};

export const getDefaultView = (route: string): SavedView | undefined => {
  const byPriority = [cache.user, cache.tenant, cache.system];
  for (const group of byPriority) {
    const view = group.find(item => item.route === route && item.isDefault);
    if (view) return view;
  }
  return undefined;
};

export const exportViews = (route: string): string => {
  const views = listViews(route);
  return JSON.stringify(views, null, 2);
};

export const importViews = (route: string, json: string, ownerType: ViewOwnerType): SavedView[] => {
  const parsed = JSON.parse(json) as unknown;
  const imported = normalizeList(parsed).map(item => ({
    ...item,
    id: nanoid(),
    route,
    ownerType,
    query: { ...item.query },
    createdAt: Date.now(),
    updatedAt: Date.now()
  }));
  const next: StoredViews = {
    user: ownerType === 'user' ? [...imported, ...cache.user] : cache.user,
    tenant: ownerType === 'tenant' ? [...imported, ...cache.tenant] : cache.tenant,
    system: ownerType === 'system' ? [...imported, ...cache.system] : cache.system
  };
  saveToCache(next);
  return imported;
};

export const resetViewsCache = () => {
  cache = load();
};
