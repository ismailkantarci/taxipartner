import { describe, it, expect, beforeEach } from 'vitest';
import { AppState } from '../modules/core.state/app.state.module.js';

describe('AppState feature flags', () => {
  beforeEach(() => {
    AppState.flags = {};
    AppState.currentUser = { email: 'user@example.com', fullName: 'User Example', roles: ['user'] };
    AppState.tenant = 'tenantA';
  });

  it('respects enabled true/false', () => {
    AppState.setFlags({ a: { enabled: true }, b: { enabled: false } });
    expect(AppState.isFlagEnabled('a')).toBe(true);
    expect(AppState.isFlagEnabled('b')).toBe(false);
  });

  it('matches allowlisted users and tenants', () => {
    AppState.setFlags({ f: { users: ['user@example.com'] } });
    expect(AppState.isFlagEnabled('f')).toBe(true);
    AppState.setFlags({ g: { tenants: ['tenantA'] } });
    expect(AppState.isFlagEnabled('g')).toBe(true);
  });

  it('honors rollout extremes (0 and 100)', () => {
    AppState.setFlags({ r0: { rollout: 0 }, r100: { rollout: 100 } });
    expect(AppState.isFlagEnabled('r0')).toBe(false);
    expect(AppState.isFlagEnabled('r100')).toBe(true);
  });
});

