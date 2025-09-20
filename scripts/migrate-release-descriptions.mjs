#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'modules/ReleaseManagement/release-log.json';
let data;
try { data = JSON.parse(readFileSync(path,'utf-8')); } catch (e) {
  console.error('Cannot read release-log.json:', e.message); process.exit(1);
}

let changed = false;
for (const e of data) {
  if (!e || !e.description) continue;
  if (typeof e.description === 'string') {
    const txt = e.description;
    e.description = { en: txt, de: txt, tr: txt };
    changed = true;
  }
}

if (changed) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log('release-log.json migrated to multi-language descriptions.');
} else {
  console.log('No migration needed.');
}

