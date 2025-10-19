import type { LegacyModule } from '../types';

export interface ModuleLoaderState {
  container: HTMLElement | null;
  mod: LegacyModule | null;
}

export interface ModuleLoaderOptions {
  append?: boolean;
}

export interface ModuleLoaderApi {
  _current: ModuleLoaderState;
  load(name: string, options?: ModuleLoaderOptions): Promise<void>;
  loadFromManifest(): Promise<void>;
  init(): Promise<void>;
}

export const ModuleLoader: ModuleLoaderApi;
