import { describe, it, expect, beforeEach, vi } from 'vitest'

const sample = [
  { version: '1.0.0', date: '2025-01-01', status: 'Stable', author: 'aa', description: { en: 'Alpha' } },
  { version: '1.1.0', date: '2025-02-01', status: 'Beta', author: 'bb', description: { en: 'Beta' } }
]

describe('ReleaseManagement CSV export (filtered+sorted)', () => {
  let capturedBlob = null

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sample })))
    // capture blob passed to createObjectURL
    const origCreate = URL.createObjectURL
    // @ts-ignore
    globalThis.URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob://test' })
    document.body.innerHTML = '<div id="host"></div>'
    const mod = await import('../modules/ReleaseManagement/index.module.js')
    await mod.default.init(document.getElementById('host'))
  })

  it('downloads CSV with expected header and data', async () => {
    const btn = document.getElementById('exportBtn')
    expect(btn).toBeTruthy()
    btn.click()
    // allow any promises/microtasks to settle
    await Promise.resolve()
    expect(capturedBlob).toBeTruthy()
    const text = await capturedBlob.text()
    expect(text).toContain('Version,Date,Status,Author,Description')
    expect(text).toContain('1.0.0')
    expect(text).toContain('1.1.0')
  })
})

