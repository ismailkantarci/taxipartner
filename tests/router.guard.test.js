import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../modules/core.moduleLoader/index.module.js', async () => {
  return {
    ModuleLoader: {
      load: vi.fn(async (name) => { ModuleLoader._last = name; }),
      _last: null,
    }
  };
});

// Import after mock
import { Router } from '../modules/core.router/index.module.js';
import { ModuleLoader } from '../modules/core.moduleLoader/index.module.js';

describe('Router admin guard', () => {
  beforeEach(() => {
    // Reset hash
    location.hash = '';
    // Provide AppStateRef with non-admin user
    window.AppStateRef = { currentUser: { roles: ['user'] } };
    ModuleLoader._last = null;
  });

  it('navigating to /users without admin loads AccessDenied', async () => {
    await Router.navigate('/users');
    expect(ModuleLoader._last).toBe('AccessDenied');
  });

  it('navigating to /users with admin loads UserManagement', async () => {
    window.AppStateRef = { currentUser: { roles: ['admin'] } };
    await Router.navigate('/users');
    expect(ModuleLoader._last).toBe('UserManagement');
  });
});

