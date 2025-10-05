import { describe, it, expect, beforeEach, vi } from 'vitest'

const sample = [
  { version: '2.0.0', date: '2025-03-01', status: 'Stable', author: 'x', description: { en: 'X' }, _files: ['added: <img src=x onerror=alert(1)>'] },
  { version: '2.1.0', date: '2025-03-05', status: 'Stable', author: 'y', description: { en: 'Y' }, _files: ['modified: <script>alert(1)</script>'] }
]

describe('ReleaseManagement compare renderFiles escapes HTML', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sample })))
    document.body.innerHTML = '<div id="host"></div>'
    const mod = await import('../modules/ReleaseManagement/index.module.js')
    await mod.default.init(document.getElementById('host'))
  })

  it('does not inject raw HTML from _files', async () => {
    // set selects and open compare
    const a = document.getElementById('cmpA')
    const b = document.getElementById('cmpB')
    const btn = document.getElementById('cmpBtn')
    expect(a && b && btn).toBeTruthy()
    a.value = '2.0.0'
    b.value = '2.1.0'
    btn.click()
    const compare = document.getElementById('compareModal')
    expect(compare && !compare.classList.contains('hidden')).toBeTruthy()
    const body = document.getElementById('compareBody')
    expect(body).toBeTruthy()
    const html = body.innerHTML
    // raw tags should be escaped
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;img')
    expect(html).toContain('&lt;script')
  })
})

