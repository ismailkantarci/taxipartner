import type { AppStateShape } from './core.state/app.state.module.js';

export interface LegacyModule {
  init(target: HTMLElement): void;
  dispose?(): void;
}

export type AppStateType = AppStateShape;
