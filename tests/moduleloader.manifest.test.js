import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModuleLoader } from '../modules/core.moduleLoader/index.module.js';
import { AppState } from '../modules/core.state/app.state.module.js';

describe('ModuleLoader.loadFromManifest', () => {
  beforeEach(() => {
    // stub fetch for modules.config.json
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('modules.config.json')) {
        return { ok: true, json: async () => ({ activeModules: ['Dashboard'] }) };
      }
      return { ok: true, json: async () => ({}) };
    }));
  });

  it('loads first active module from config', async () => {
    const spy = vi.spyOn(ModuleLoader, 'load').mockResolvedValue();
    document.body.innerHTML = '<main id="modulContent"></main>';
    await ModuleLoader.loadFromManifest();
    expect(spy).toHaveBeenCalledWith('Dashboard', { append: false });
    expect(AppState.activeModule).toBe('Dashboard');
    spy.mockRestore();
  });
});

