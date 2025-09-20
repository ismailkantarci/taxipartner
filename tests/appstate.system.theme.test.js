import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppState } from '../modules/core.state/app.state.module.js';

describe('AppState system theme strategy', () => {
  let mql;
  beforeEach(() => {
    // Mock matchMedia
    mql = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    vi.stubGlobal('matchMedia', undefined);
    window.matchMedia = vi.fn(() => mql);
    // reset
    document.documentElement.classList.remove('dark');
    AppState.theme = 'light';
    AppState.themeMode = 'manual';
  });

  it('applies system preference and reacts to changes', () => {
    AppState.setThemeMode('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    // simulate OS switch to dark
    mql.matches = true;
    const cb = AppState._onMediaChange;
    expect(typeof cb).toBe('function');
    cb && cb();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

