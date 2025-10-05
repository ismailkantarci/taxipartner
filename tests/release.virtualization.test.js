import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

const buildSample = (count = 1200) => {
  return Array.from({ length: count }, (_, idx) => ({
    version: `2.${Math.floor(idx / 100)}.${idx}`,
    date: '2025-01-01',
    status: 'Stable',
    author: `bot-${idx}`,
    description: { en: `Synthetic release ${idx}` }
  }))
}

describe('ReleaseManagement virtualization', () => {
  const sample = buildSample()

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sample })))
    globalThis.__RM_BENCHMARK__ = 'render'
    document.body.innerHTML = '<div id="host"></div>'
    location.hash = '#/releases'
    const mod = await import('../modules/ReleaseManagement/index.module.js')
    await mod.default.init(document.getElementById('host'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete globalThis.__RM_BENCHMARK__
    document.body.innerHTML = ''
  })

  it('limits rendered rows when page size is set to All', async () => {
    const pageSize = document.getElementById('pageSize')
    expect(pageSize).toBeTruthy()
    pageSize.value = 'All'
    pageSize.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 0))

    const tableBody = document.getElementById('tableBody')
    expect(tableBody).toBeTruthy()
    const rows = Array.from(tableBody.querySelectorAll('tr'))
    const spacerRows = rows.filter(r => r.classList.contains('rm-spacer-row'))
    expect(spacerRows.length).toBeGreaterThan(0)
    const visibleRows = rows.filter(r => !r.classList.contains('rm-spacer-row'))
    expect(visibleRows.length).toBeLessThan(600)
    expect(visibleRows.length).toBeLessThan(sample.length)

    const wrap = document.getElementById('tableWrap')
    expect(wrap).toBeTruthy()
    expect(typeof wrap.__rmVirtCleanup).toBe('function')

    const pageInfo = document.getElementById('pageInfo')
    expect(pageInfo.textContent.trim()).toMatch(/1-\d+ \/ 1200/)

    const bench = Number(sessionStorage.getItem('RM_BENCH_RENDER_MS') || 0)
    expect(bench).toBeGreaterThan(0)
    expect(bench).toBeLessThanOrEqual(200)
  })
})
