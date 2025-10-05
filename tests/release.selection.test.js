import { describe, it, expect, beforeEach, vi } from 'vitest'

const sample = [
  { version: '1.2.0', date: '2025-01-01', status: 'Stable', author: 'a', description: { en: 'A' } },
  { version: '1.2.1', date: '2025-01-05', status: 'Stable', author: 'b', description: { en: 'B' } },
  { version: '1.3.0', date: '2025-02-01', status: 'Pre', author: 'c', description: { en: 'C' } }
]

describe('ReleaseManagement selection & compare', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sample })))
    document.body.innerHTML = '<div id="host"></div>'
    location.hash = '#/releases'
    const mod = await import('../modules/ReleaseManagement/index.module.js')
    await mod.default.init(document.getElementById('host'))
  })

  it('selects rows, updates bar and opens compare with 2 selections', async () => {
    const tbody = document.querySelector('#tableBody')
    expect(tbody).toBeTruthy()
    // row checkboxes are injected after render
    const cbs = Array.from(document.querySelectorAll('.js-row-sel'))
    expect(cbs.length).toBeGreaterThanOrEqual(2)

    // select first
    cbs[0].checked = true
    cbs[0].dispatchEvent(new Event('change', { bubbles: true }))
    const bar = document.getElementById('selectionBar')
    expect(bar.classList.contains('hidden')).toBe(false)
    expect(document.getElementById('selCount').textContent).toBe('1')
    const cmpBtn = document.getElementById('selCompare')
    expect(cmpBtn.disabled).toBe(true)

    // shift-select second
    cbs[1].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    cbs[1].checked = true
    cbs[1].dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.getElementById('selCount').textContent).toBe('2')
    expect(cmpBtn.disabled).toBe(false)

    // open compare
    cmpBtn.click()
    const compare = document.getElementById('compareModal')
    expect(compare).toBeTruthy()
    expect(compare.classList.contains('hidden')).toBe(false)
  })

  it('header select all selects all filtered rows', async () => {
    const selAll = document.getElementById('rmSelAll')
    expect(selAll).toBeTruthy()
    selAll.checked = true
    selAll.dispatchEvent(new Event('change', { bubbles: true }))
    // selection count equals number of rows rendered (filtered)
    const totalRendered = document.querySelectorAll('.js-row-sel').length
    expect(parseInt(document.getElementById('selCount').textContent, 10)).toBe(totalRendered)
  })
})

