#!/usr/bin/env node
// Optional AI-assisted summarizer for release-log entries.
// Usage:
//  node scripts/ai-release-summary.mjs --apply [--top 1] [--model gpt-4o-mini]
// Env:
//  OPENAI_API_KEY=... (optional). If missing, uses deterministic templates.
//  AI_LANGS=tr,de,en (default: tr,de,en)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function readJSON(p, fb){ try { return JSON.parse(readFileSync(p,'utf-8')); } catch { return fb; } }
function writeJSON(p, obj){ writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }

const argv = new Map(process.argv.slice(2).map((a,i,arr)=>{
  if (a.startsWith('--')) {
    const k = a.replace(/^--/,'');
    const v = (arr[i+1] && !arr[i+1].startsWith('--')) ? arr[i+1] : '1';
    return [k, v];
  }
  return [a,'1'];
}));

const APPLY = argv.get('apply') === '1' || argv.get('apply') === '';
const TOP = parseInt(argv.get('top')||'1',10) || 1;
const MODEL = argv.get('model') || 'gpt-4o-mini';
const LANGS = (process.env.AI_LANGS || 'tr,de,en').split(',').map(s=>s.trim()).filter(Boolean);

const path = 'modules/ReleaseManagement/release-log.json';
const log = readJSON(path, []);
if (!Array.isArray(log) || !log.length) process.exit(0);

const key = process.env.OPENAI_API_KEY || '';
const BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/,'');
const USAGE_PATH = '.ai_usage.json';
const MAX_PER_DAY = parseInt(process.env.AI_MAX_PER_DAY || '1000', 10) || 1000;

function deterministicSummary(entry, lang){
  // Fallback deterministic improvement based on categories/impact/risk.
  const cats = entry.categories || [];
  const impact = entry.impact || 'chore';
  const risk = entry.risk || 'low';
  const counts = entry.counts || {};
  const plus = counts.added||0, mod = counts.modified||0, rem = counts.removed||0;
  const modules = (entry.modules||[]).join(', ');
  const filesTop = (entry.filesTop||[]).slice(0,3).join(', ');

  const dict = {
    tr: {
      lead: {
        feature: 'Yeni/kapsamlı işlev iyileştirmeleri uygulandı.',
        ux: 'Görsel ve etkileşimsel deneyim rafine edildi.',
        security: 'Güvenlik ve politika ayarları güçlendirildi.',
        quality: 'Kalite güvencesi ve testler iyileştirildi.',
        chore: 'Bakım ve otomasyon geliştirmeleri yapıldı.'
      },
      tail: 'Kararlılık ve performans iyileştirildi.'
    },
    de: {
      lead: {
        feature: 'Neue/funktionale Verbesserungen umgesetzt.',
        ux: 'Visuelle und Interaktions‑Erfahrung verfeinert.',
        security: 'Sicherheits‑ und Richtlinieneinstellungen gehärtet.',
        quality: 'Qualitätssicherung und Tests verbessert.',
        chore: 'Wartung und Automatisierung verbessert.'
      },
      tail: 'Stabilität und Performance verbessert.'
    },
    en: {
      lead: {
        feature: 'New/functional improvements implemented.',
        ux: 'Visual and interaction experience refined.',
        security: 'Security and policy settings hardened.',
        quality: 'Quality assurance and tests improved.',
        chore: 'Maintenance and automation enhanced.'
      },
      tail: 'Stability and performance improvements.'
    }
  }[lang] || {
    lead: { chore: 'Improvements applied.' },
    tail: 'Stability improved.'
  };

  const lead = dict.lead[impact] || dict.lead.chore;
  const focus = cats.length ? (lang==='de' ? `Schwerpunkte: ${cats.join(', ')}.` : lang==='tr' ? `Odak: ${cats.join(', ')}.` : `Focus: ${cats.join(', ')}.`) : '';
  const mods = modules ? (lang==='de' ? `Betroffene Module: ${modules}.` : lang==='tr' ? `Etkilenen modüller: ${modules}.` : `Affected modules: ${modules}.`) : '';
  const nums = (lang==='de' ? `Änderungen: +${plus}, ~${mod}, -${rem}.` : lang==='tr' ? `Değişiklik sayıları: +${plus}, ~${mod}, -${rem}.` : `Changes: +${plus}, ~${mod}, -${rem}.`);
  const note = filesTop ? (lang==='de' ? `Relevante Dateien: ${filesTop}.` : lang==='tr' ? `Öne çıkan dosyalar: ${filesTop}.` : `Notable files: ${filesTop}.`) : '';
  return [lead, focus, mods, dict.tail, nums, note].filter(Boolean).join(' ');
}

async function aiSummary(entry){
  if (!key) {
    const out = {};
    for (const lang of LANGS) out[lang] = deterministicSummary(entry, lang);
    return out;
  }
  const sys = 'You are a concise release note writer. Write 1–2 sentences in the requested language, neutral and professional.';
  const cats = (entry.categories||[]).join(', ');
  const counts = entry.counts || {}; const plus = counts.added||0, mod=counts.modified||0, rem=counts.removed||0;
  const modules = (entry.modules||[]).join(', ');
  const filesTop = (entry.filesTop||[]).slice(0,3).join(', ');
  const impact = entry.impact||''; const risk = entry.risk||'';
  const base = `categories: ${cats}; impact:${impact}; risk:${risk}; counts:+${plus},~${mod},-${rem}; modules:${modules}; files:${filesTop}`;

  const out = {};
  for (const lang of LANGS) {
    const prompt = `Language: ${lang}. Turn the following change signals into a short, human friendly release note (1–2 sentences). ${base}`;
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [ { role: 'system', content: sys }, { role: 'user', content: prompt } ],
          temperature: 0.2,
          max_tokens: 120
        })
      });
      const j = await res.json();
      const text = j?.choices?.[0]?.message?.content?.trim();
      out[lang] = text || deterministicSummary(entry, lang);
    } catch {
      out[lang] = deterministicSummary(entry, lang);
    }
  }
  return out;
}

// Basic usage limiter (per repo per day)
function loadUsage(){
  try { return JSON.parse(readFileSync(USAGE_PATH,'utf-8')); } catch { return { day: '', count: 0 }; }
}
function saveUsage(obj){ try { writeFileSync(USAGE_PATH, JSON.stringify(obj, null, 2)+'\n'); } catch {}
}
const usage = loadUsage();
const today = new Date().toISOString().slice(0,10);
if (usage.day !== today) { usage.day = today; usage.count = 0; }
let allowed = Math.max(0, MAX_PER_DAY - usage.count);
let requestedTop = Math.min(TOP, log.length);
if (key && allowed <= 0) {
  console.error('ai-release-summary: daily limit reached; skipping');
  process.exit(0);
}
if (key && requestedTop > allowed) requestedTop = allowed;

const targets = log.slice(0, requestedTop);
let changed = false;
for (const e of targets) {
  if (e && (!e.description || e.quality === 'auto')) {
    const pub = await aiSummary(e);
    e.descriptionPublic = { ...(e.descriptionPublic||{}), ...pub };
    // if internal description missing or too generic, fill with public
    e.description = e.description || {};
    for (const lang of LANGS) if (!e.description[lang]) e.description[lang] = pub[lang];
    e.quality = 'ai';
    changed = true;
    if (key) { usage.count += 1; }
  }
}

if (APPLY && changed) writeJSON(path, log);
if (key && changed) saveUsage(usage);
console.log(`ai-release-summary: ${changed? 'updated' : 'no-change'}`);
