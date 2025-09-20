#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'modules/ReleaseManagement/release-log.json';
const data = JSON.parse(readFileSync(path,'utf-8'));
let changed = false;

for (const e of data) {
  const d = e.description;
  if (!d) continue;
  if (typeof d === 'string') continue; // migrate script handles strings
  const en = d.en || d.de || d.tr || Object.values(d)[0];
  if (en) {
    if (!d.de) { d.de = `${en} [DRAFT]`; changed = true; }
    if (!d.tr) { d.tr = `${en} [DRAFT]`; changed = true; }
    if (!d.en) { d.en = `${en}`; changed = true; }
  }
}

if (changed) writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log(changed ? 'Filled missing translations with [DRAFT].' : 'No missing translations.');

