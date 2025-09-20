#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function readJSON(p){ try { return JSON.parse(readFileSync(p,'utf-8')); } catch { return null; } }
function writeJSON(p, obj){ writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }

const pkg = readJSON('package.json');
if (!pkg) { console.error('package.json not found'); process.exit(1); }
const version = pkg.version;
const now = new Date().toISOString();

// Update system.meta.json
const metaPath = 'system.meta.json';
const meta = readJSON(metaPath) || {};
meta.version = version;
meta.buildDate = now;
writeJSON(metaPath, meta);

// Update all module manifests
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

for (const p of walk('modules')) {
  if (!p.endsWith('module.manifest.json')) continue;
  const m = readJSON(p); if (!m) continue;
  m.version = version;
  writeJSON(p, m);
}

console.log(`Synchronized version ${version} at ${now}`);

