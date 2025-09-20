#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function sh(cmd){ return execSync(cmd, { stdio: ['ignore','pipe','ignore'], encoding: 'utf-8' }).trim(); }

function readJSON(p, fb){ try { return JSON.parse(readFileSync(p,'utf-8')); } catch { return fb; } }
function writeJSON(p, obj){ writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }

function parseVer(ver){
  const m = String(ver||'0.0.0').split('.').map(n=>parseInt(n,10)||0);
  while (m.length<3) m.push(0);
  return m;
}
function bump(ver, level){
  const m = parseVer(ver);
  if (level==='major') { m[0]+=1; m[1]=0; m[2]=0; }
  else if (level==='minor') { m[1]+=1; m[2]=0; }
  else { m[2]+=1; }
  return m.join('.');
}

const pkg = readJSON('package.json', {});
const relPath = 'modules/ReleaseManagement/release-log.json';
const rel = readJSON(relPath, []);

const prevVer = pkg.version || (rel[0] && rel[0].version) || '0.0.0';

// Determine commit range
const lastCommit = (rel[0] && rel[0]._commit) || ''; // we store last release HEAD
let range = '';
try {
  const head = sh('git rev-parse HEAD');
  range = lastCommit ? `${lastCommit}..${head}` : `${head}~1..${head}`;
} catch {}

let messages = [];
try {
  const out = sh(`git log --pretty=%s ${range}`);
  messages = out.split(/\n/).filter(Boolean).slice(0, 20);
} catch {}

let files = [];
try {
  const out = sh(`git diff --name-only ${range}`);
  files = out.split(/\n/).filter(Boolean).slice(0, 50);
} catch {}

const branch = (()=>{ try { return sh('git rev-parse --abbrev-ref HEAD'); } catch { return ''; } })();
// Build friendly summary
function catsFrom(files){
  const map = new Map();
  const classify = (p)=>{
    if (p.startsWith('modules/core.footer') || p.includes('core.footer')) return 'footer/UI';
    if (p.startsWith('modules/core.header') || p.includes('core.header')) return 'header/UI';
    if (p.startsWith('modules/core.sidebar') || p.includes('core.sidebar')) return 'sidebar/UI';
    if (p.startsWith('modules/ReleaseManagement')) return 'Release Management';
    if (p.startsWith('modules/core.state')) return 'app state';
    if (p.startsWith('modules/core.moduleLoader')) return 'module loader';
    if (p.startsWith('locales/')) return 'translations';
    if (p.startsWith('scripts/')) return 'automation';
    if (p.startsWith('src/styles/') || p === 'tailwind.config.js') return 'styles';
    if (p === 'sw.js') return 'service worker';
    if (p === 'index.html') return 'HTML/CSP';
    if (p === 'app.config.json' || p === 'system.meta.json') return 'configuration';
    if (p.startsWith('tests/')) return 'tests';
    if (p.toLowerCase().endsWith('.md')) return 'docs';
    return 'other';
  };
  files.forEach(f=>{ const c = classify(f); map.set(c, (map.get(c)||0)+1); });
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
}

const topCats = catsFrom(files);
const msgLines = messages.slice(0,5).map(m=>`- ${m}`);
const summary = [
  branch ? `Branch: ${branch}` : null,
  topCats.length ? `Focus: ${topCats.join(', ')}` : null,
  msgLines.length ? 'Messages:\n' + msgLines.join('\n') : 'Automated release entry.'
].filter(Boolean).join('\n');

const headSha = (()=>{ try { return sh('git rev-parse HEAD'); } catch { return 'unknown'; } })();

// Determine semantic bump from messages
const msgAll = messages.join('\n');
let level = 'patch';
if (/BREAKING CHANGE|!\)/i.test(msgAll) || /(^|\n)breaking:/i.test(msgAll)) level = 'major';
else if (/(^|\n)feat(\(|:)/i.test(msgAll)) level = 'minor';

const nextVer = bump(prevVer, level);

// Modules from changed files
const moduleSet = new Set();
files.forEach(f => { const m = String(f).match(/(^|\/)modules\/([^\/]+)\//); if (m) moduleSet.add(m[2]); });
const modules = Array.from(moduleSet);

// Commit timestamp → time/datetime
let ts = '';
try { ts = sh('git log -1 --pretty=%aI'); } catch {}
const time = ts ? (ts.match(/T(\d{2}:\d{2})/)||[])[1] || '' : new Date().toISOString().slice(11,16);

const modLine = modules.length ? modules.join(', ') : '';
const descObj = {
  en: [
    'Automated release.',
    topCats.length ? `Focus: ${topCats.join(', ')}.` : '',
    modLine ? `Affected modules: ${modLine}.` : '',
    'Stability and performance improvements.',
    branch ? `Branch: ${branch}.` : ''
  ].filter(Boolean).join(' '),
  de: [
    'Automatisches Release.',
    topCats.length ? `Schwerpunkte: ${topCats.join(', ')}.` : '',
    modLine ? `Betroffene Module: ${modLine}.` : '',
    'Stabilität und Performance verbessert.',
    branch ? `Branch: ${branch}.` : ''
  ].filter(Boolean).join(' '),
  tr: [
    'Otomatik sürüm.',
    topCats.length ? `Öne çıkanlar: ${topCats.join(', ')}.` : '',
    modLine ? `Etkilenen modüller: ${modLine}.` : '',
    'Kararlılık ve performans iyileştirildi.',
    branch ? `Branş: ${branch}.` : ''
  ].filter(Boolean).join(' ')
};

function impactFromCats(cats){
  if (cats.includes('HTML/CSP') || cats.includes('service worker')) return 'security';
  if (cats.includes('Release Management') || cats.includes('module loader') || cats.includes('app state')) return 'feature';
  if (cats.some(c => ['translations','styles','footer/UI','header/UI','sidebar/UI'].includes(c))) return 'ux';
  if (cats.includes('tests')) return 'quality';
  if (cats.includes('automation')) return 'chore';
  return 'chore';
}
const impact = impactFromCats(topCats);
const risk = (files.length>20 || topCats.includes('HTML/CSP')) ? 'high' : ((files.length>8 || topCats.includes('module loader') || topCats.includes('app state')) ? 'medium' : 'low');
const descPublic = {
  en: [descObj.en.replace(/\s*Branch:.*$/,''), topCats.length?`Focus: ${topCats.join(', ')}.`:'', 'Stability and user experience improved.'].filter(Boolean).join(' '),
  de: [descObj.de.replace(/\s*Branch:.*$/,''), topCats.length?`Schwerpunkte: ${topCats.join(', ')}.`:'', 'Stabilität und Nutzererlebnis verbessert.'].filter(Boolean).join(' '),
  tr: [descObj.tr.replace(/\s*Branş:.*$/,''), topCats.length?`Odak: ${topCats.join(', ')}.`:'', 'Stabilite ve deneyim daha iyi hale getirildi.'].filter(Boolean).join(' ')
};

const entry = {
  version: nextVer,
  date: new Date().toISOString().slice(0,10),
  time,
  datetime: ts || new Date().toISOString(),
  status: 'Stable',
  author: process.env.GITHUB_ACTOR || 'System',
  description: descObj,
  descriptionPublic: descPublic,
  modules,
  categories: topCats,
  counts: { added: 0, modified: files.length, removed: 0 },
  filesTop: files.slice(0,3),
  impact,
  risk,
  quality: 'auto',
  state: 'draft',
  sources: ['ci'],
  _commit: headSha,
  _branch: branch,
  _range: range,
  _files: files
};

// Prepend entry
const updated = [entry, ...rel];
writeJSON(relPath, updated);

// Bump package.json and sync system/meta + manifests via script
pkg.version = nextVer;
writeJSON('package.json', pkg);
try { execSync('node scripts/version-sync.mjs', { stdio: 'inherit' }); } catch {}

console.log(`release-log.json updated with v${nextVer}`);
