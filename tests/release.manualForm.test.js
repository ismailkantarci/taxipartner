import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const releases = [
  { version: '1.0.0', date: '2025-01-01', status: 'Stable', author: 'alice', description: { en: 'Initial release' } },
  { version: '1.1.0', date: '2025-01-05', status: 'Stable', author: 'bob', description: { en: 'Patch' } }
]

const translations = {
  'release.form_required': 'Sürüm ve Tarih zorunlu.',
  'release.version_exists': 'Bu sürüm zaten var.'
}

vi.mock('../modules/core.state/app.state.module.js', () => ({
  AppState: {
    language: 'tr',
    getTranslation: (key) => translations[key]
  }
}))

async function initModule() {
  document.body.innerHTML = '<div id="host"></div>'
  location.hash = '#/releases'
  const mod = await import('../modules/ReleaseManagement/index.module.js')
  await mod.default.init(document.getElementById('host'))
}

describe('Manual Release modal', () => {
  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => releases })))
    await initModule()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  function openModal() {
    const btn = document.getElementById('newReleaseBtn')
    expect(btn).toBeTruthy()
    btn.click()
    const modal = document.querySelector('#nr_version')?.closest('form')?.parentElement?.parentElement
    expect(modal).toBeTruthy()
  }

  it('blocks submission when required fields are empty', () => {
    openModal()
    const next = document.getElementById('nrNext')
    expect(next).toBeTruthy()
    next.click()
    const err = document.getElementById('nr_error')
    expect(err.textContent).toContain(translations['release.form_required'])
  })

  it('creates a new release entry when form is valid', () => {
    openModal()
    document.getElementById('nr_version').value = '2.0.0'
    document.getElementById('nr_date').value = '2025-02-01'
    document.getElementById('nr_status').value = 'Stable'
    document.getElementById('nr_author').value = 'carol'
    const next = document.getElementById('nrNext')
    next.click()
    document.getElementById('nr_en').value = 'Major update'
    document.getElementById('nrSubmit').click()

    const newRow = document.querySelector('[data-version="2.0.0"]')
    expect(newRow).toBeTruthy()
    const authorCell = newRow.querySelector('[data-key="author"]')
    expect(authorCell.textContent).toContain('carol')
  })

  it('prevents duplicate version entries', () => {
    openModal()
    document.getElementById('nr_version').value = '1.0.0'
    document.getElementById('nr_date').value = '2025-02-01'
    document.getElementById('nrNext').click()
    document.getElementById('nrSubmit').click()

    const err = document.getElementById('nr_error')
    expect(err.textContent).toContain(translations['release.version_exists'])
  })
})
