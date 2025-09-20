import { describe, it, expect, vi, beforeEach } from 'vitest';

const sample = [
  { version: '1.2.2', date: '2025-01-01', status: 'Stable', author: 'a', description: { en: 'A' } },
  { version: '1.2.3', date: '2025-01-02', status: 'Stable', author: 'b', description: { en: 'B' } }
];

describe('ReleaseManagement duplicate guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sample })));
    document.body.innerHTML = '<div id="host"></div>';
    location.hash = '#/releases';
  });

  it('prevents adding a duplicate version', async () => {
    const mod = await import('../modules/ReleaseManagement/index.module.js');
    const Host = document.getElementById('host');
    await mod.default.init(Host);
    // Açılır menüdeki "Yeni Sürüm" butonunu tetikle
    const btn = document.getElementById('newReleaseBtn');
    expect(btn).toBeTruthy();
    btn.click();
    // Form alanlarını doldur
    const ver = document.getElementById('nr_version');
    const dat = document.getElementById('nr_date');
    const form = document.querySelector('#aboutModal') || document.body; // guard
    expect(ver && dat).toBeTruthy();
    ver.value = '1.2.3'; // existing
    dat.value = '2025-01-03';
    const err = document.getElementById('nr_error');
    const f = ver.closest('form');
    expect(f).toBeTruthy();
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    // Hata mesajı yazılmış olmalı
    expect(err.textContent).toMatch(/exist/i);
  });
});
