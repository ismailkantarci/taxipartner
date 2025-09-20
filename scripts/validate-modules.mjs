#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}

function fail(msg){ console.error(`Module validation failed: ${msg}`); process.exitCode = 1; }

const files = walk('modules').filter(p => p.endsWith('module.manifest.json'));
for (const p of files) {
  let j;
  try { j = JSON.parse(readFileSync(p, 'utf-8')); } catch { fail(`${p}: invalid JSON`); continue; }
  const required = ['name','entry','version'];
  for (const k of required) if (!j[k]) fail(`${p}: missing ${k}`);
  if (j.type && !['core','functional'].includes(j.type)) fail(`${p}: invalid type ${j.type}`);
  if (typeof j.version !== 'string') fail(`${p}: version must be string`);
}
if (process.exitCode) {
  console.error('Module manifest validation completed with errors.');
} else {
  console.log(`Module manifest validation OK (${files.length} files).`);
}

