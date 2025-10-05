#!/usr/bin/env node
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8')
const dom = new JSDOM(html, {
  url: 'http://localhost/#/releases',
  pretendToBeVisual: true,
  runScripts: 'dangerously',
  resources: 'usable'
})

const { window } = dom

window.AppState = {
  language: 'en',
  getTranslation: () => undefined,
  setTranslation: () => {}
}

window.Telemetry = {
  log: () => {}
}

const sample = Array.from({ length: 1200 }, (_, idx) => ({
  version: `2.${Math.floor(idx / 100)}.${idx}`,
  date: '2025-02-01',
  status: 'Stable',
  author: `bench-${idx}`,
  description: { en: `Benchmark ${idx}` }
}))

window.__RM_BENCHMARK__ = 'render'
window.fetch = async () => ({ ok: true, json: async () => sample })

const mod = await import('../modules/ReleaseManagement/index.module.js')
const host = window.document.getElementById('host') || (() => {
  const el = window.document.createElement('div')
  el.id = 'host'
  window.document.body.appendChild(el)
  return el
})()

await mod.default.init(host)

const best = window.sessionStorage.getItem('RM_BENCH_RENDER_MS')
console.log('[RM] best render (ms):', best)
