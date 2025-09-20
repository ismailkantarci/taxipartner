import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../modules/core.moduleLoader/index.module.js', async () => {
  return {
    ModuleLoader: {
      load: vi.fn(async (name) => { ModuleLoader._last = name; }),
      _last: null,
    }
  };
});

import { Router } from '../modules/core.router/index.module.js';
import { ModuleLoader } from '../modules/core.moduleLoader/index.module.js';

describe('Router fallback and active state', () => {
  beforeEach(() => {
    location.hash = '';
    document.body.innerHTML = '<div id="sidebar"><a href="#/">Home</a><a href="#/users">Users</a></div>';
  });

  it('unknown route navigates to NotFound', async () => {
    await Router.navigate('/this-does-not-exist');
    expect(ModuleLoader._last).toBe('NotFound');
  });
});

