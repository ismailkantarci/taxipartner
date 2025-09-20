import { describe, it, expect, beforeEach } from 'vitest';
import { AppState } from '../modules/core.state/app.state.module.js';

describe('AppState theme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove?.('dark');
    AppState.theme = 'light';
  });

  it('toggles dark class on html/body', () => {
    AppState.setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    AppState.setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

