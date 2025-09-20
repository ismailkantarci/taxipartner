import { describe, it, expect, vi, beforeEach } from 'vitest';

const sample = [
  { version: '1.2.2', date: '2025-01-01', status: 'Stable', author: 'a', description: { en: 'A' } },
  { version: '1.2.3', date: '2025-01-02', status: 'Stable', author: 'b', description: { en: 'B' } }
];

describe('ReleaseManagement deep links', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sample })));
    document.body.innerHTML = '<div id="host"></div>';
    location.hash = '#/releases';
  });

  it('sets ?v when opening details via click', async () => {
    const mod = await import('../modules/ReleaseManagement/index.module.js');
    const Host = document.getElementById('host');
    await mod.default.init(Host);
    const btn = document.querySelector('.js-open-details');
    expect(btn).toBeTruthy();
    btn.click();
    expect(location.hash).toMatch(/\?v=/);
  });

  it('sets ?cmp when opening compare', async () => {
    const mod = await import('../modules/ReleaseManagement/index.module.js');
    const Host = document.getElementById('host');
    await mod.default.init(Host);
    const a = document.getElementById('cmpA');
    const b = document.getElementById('cmpB');
    const btn = document.getElementById('cmpBtn');
    expect(a && b && btn).toBeTruthy();
    a.value = '1.2.2'; b.value = '1.2.3';
    btn.click();
    expect(location.hash).toMatch(/\?cmp=/);
  });
});
