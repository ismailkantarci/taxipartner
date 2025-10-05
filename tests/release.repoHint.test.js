import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const releases = [
  { version: '1.0.0', date: '2025-01-01', status: 'Stable', author: 'alice', description: { en: 'Initial' } },
  { version: '1.1.0', date: '2025-01-10', status: 'Stable', author: 'bob', description: { en: 'Update' } }
]

async function setupModule() {
  const host = document.createElement('div')
  host.id = 'host'
  document.body.appendChild(host)
  const mod = await import('../modules/ReleaseManagement/index.module.js')
  await mod.default.init(host)
  return host
}

describe('GitHub compare hint', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => releases })))
    document.body.innerHTML = ''
    location.hash = '#/releases'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete globalThis.AppConfigRef
    document.body.innerHTML = ''
  })

  it('shows hint and hides link when repoUrl is missing', async () => {
    await setupModule()
    const link = document.getElementById('cmpGh')
    const hint = document.getElementById('cmpGhHint')
    expect(link).toBeTruthy()
    expect(hint).toBeTruthy()
    expect(link.classList.contains('hidden')).toBe(true)
    expect(hint.classList.contains('hidden')).toBe(false)
  })

  it('shows link and hides hint when repoUrl is defined', async () => {
    globalThis.AppConfigRef = { repoUrl: 'https://github.com/example/repo/' }
    await setupModule()
    const link = document.getElementById('cmpGh')
    const hint = document.getElementById('cmpGhHint')
    expect(hint.classList.contains('hidden')).toBe(true)

    const cmpA = document.getElementById('cmpA')
    const cmpB = document.getElementById('cmpB')
    const cmpBtn = document.getElementById('cmpBtn')
    cmpA.value = '1.0.0'
    cmpB.value = '1.1.0'
    cmpBtn.click()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(link.classList.contains('hidden')).toBe(false)
    expect(link.getAttribute('href')).toBe('https://github.com/example/repo/compare/v1.0.0...v1.1.0')
    expect(hint.classList.contains('hidden')).toBe(true)
  })
})
