import { describe, it, expect } from 'vitest';
import { AppState } from '../modules/core.state/app.state.module.js';

describe('i18n fallback', () => {
  it('falls back de-AT -> de -> en -> key', () => {
    AppState.translations = {
      'de': { hello: 'Hallo' },
      'en': { hello: 'Hello' }
    };
    AppState.language = 'de-AT';
    expect(AppState.getTranslation('hello')).toBe('Hallo');
    AppState.language = 'fr';
    expect(AppState.getTranslation('hello')).toBe('Hello');
    expect(AppState.getTranslation('unknown.key')).toBe('unknown.key');
  });
});

