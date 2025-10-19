import { describe, expect, it } from 'vitest';
import { auditKeys } from '../../audit/api';

describe('audit query keys', () => {
  it('includes every supported filter in a deterministic order', () => {
    const key = auditKeys.list({
      q: 'login',
      user: 'user-1',
      action: 'auth.session.login',
      from: '2024-01-01',
      to: '2024-01-31',
      page: 2,
      pageSize: 50,
      sort: 'actor',
      order: 'asc'
    });

    expect(key).toEqual([
      'audit',
      'login',
      'user-1',
      'auth.session.login',
      '2024-01-01',
      '2024-01-31',
      2,
      50,
      'actor',
      'asc'
    ]);
  });

  it('stabilises undefined values to ensure cache hits', () => {
    const key = auditKeys.list({
      q: undefined,
      user: undefined,
      action: undefined,
      from: undefined,
      to: undefined,
      page: undefined,
      pageSize: undefined,
      sort: undefined,
      order: undefined
    });

    expect(key).toEqual(['audit', '', '', '', '', '', 0, 25, 'ts', 'desc']);
  });

  it('produces identical keys for equivalent query objects', () => {
    const first = auditKeys.list({ q: 'x', user: 'u', action: 'a', page: 1, pageSize: 25, sort: 'ts', order: 'desc' });
    const second = auditKeys.list({ user: 'u', action: 'a', q: 'x', page: 1, pageSize: 25, sort: 'ts', order: 'desc' });
    expect(second).toEqual(first);
  });
});
