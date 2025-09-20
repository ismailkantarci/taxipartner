#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

function readJSON(p){ return JSON.parse(readFileSync(p,'utf-8')); }

const log = readJSON('modules/ReleaseManagement/release-log.json');
const lines = ['# Changelog', ''];
const arg = process.argv.find(a=>/^--lang=/.test(a));
const lang = arg ? arg.split('=')[1] : 'en';

function resolveDesc(d) {
  if (!d) return '';
  if (typeof d === 'string') return d;
  // prefer requested language, fallbacks
  const base = (lang||'en').split('-')[0];
  return d[lang] || d[base] || d.en || d.de || d.tr || Object.values(d)[0] || '';
}

// assume newest first in file (if not, sort by date desc)
const sorted = [...log].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
for (const r of sorted) {
  lines.push(`## v${r.version} - ${r.date || '—'} (${r.status || '—'})`);
  if (r.author) lines.push(`- Author: ${r.author}`);
  const desc = resolveDesc(r.description);
  if (desc) lines.push(`- ${desc}`);
  lines.push('');
}

const out = lang === 'en' ? 'CHANGELOG.md' : `CHANGELOG.${lang}.md`;
writeFileSync(out, lines.join('\n'));
console.log(`${out} generated.`);
