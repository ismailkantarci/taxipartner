export type ThemeName = 'light' | 'dark';
export type ThemeMode = 'manual' | 'system' | 'autoSun';
export type SidebarMode = 'expanded' | 'collapsed';

export interface TablePreferences {
  columnVisibility: Record<string, boolean>;
  sorting: Array<{ id: string; desc?: boolean }>;
  columnOrder: string[];
  filters: Record<string, unknown>;
}

export interface FeatureFlagDefinition {
  enabled?: boolean;
  users?: string[];
  tenants?: string[];
  rollout?: number;
  seed?: string;
}

export interface CurrentUserState {
  id?: string;
  email?: string;
  fullName?: string;
  companyTag?: string;
  language?: string;
  preferredTheme?: ThemeName | ThemeMode;
  roles?: string[];
  tenants?: Array<{ id: string; name?: string | null }>;
  currentTenant?: string | null;
  mfaEnabled?: boolean;
  phone?: string | null;
  rawProfile?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AppStateShape {
  currentUser: CurrentUserState | null;
  activeModule: string | null;
  language: string;
  theme: ThemeName;
  themeMode: ThemeMode;
  tenant: string | null;
  sidebar: {
    open: boolean;
    mode: SidebarMode;
  };
  tablePreferences: Record<string, TablePreferences>;
  asyncFlags: Record<string, boolean>;
  translations: Record<string, Record<string, string>>;
  ready: boolean;
  debug: boolean;
  flags: Record<string, FeatureFlagDefinition>;

  setUser(user: CurrentUserState | null): void;
  setFlags(flags?: Record<string, FeatureFlagDefinition>): void;
  setActiveModule(name: string | null): void;
  setLanguage(lang: string): void;
  setTheme(theme: ThemeName): void;
  clearThemeTimers(): void;
  setThemeMode(mode: ThemeMode): void;
  setSidebarOpen(open: boolean): void;
  toggleSidebarOpen(): void;
  setSidebarMode(mode: SidebarMode): void;
  isSidebarCollapsed(): boolean;
  getTablePrefs(tableId?: string): TablePreferences;
  updateTablePrefs(
    tableId: string,
    updater:
      | TablePreferences
      | Partial<TablePreferences>
      | ((current: TablePreferences) => TablePreferences | Partial<TablePreferences>)
  ): void;
  clearTablePrefs(tableId: string): void;
  setAsyncFlag(key: string, value: boolean): void;
  getAsyncFlag(key: string): boolean;
  applyThemeStrategy(): void;
  setTenant(tenantId: string | null): void;
  getTranslation(key: string): string;
  reset(): void;
  saveToStorage(): void;
  loadFromStorage(): void;
  hasRole(role: string): boolean;
  isAdmin(): boolean;
  loadTranslations(): Promise<void>;
  isFlagEnabled(flagName: string): boolean;
}

export const AppState: AppStateShape;
