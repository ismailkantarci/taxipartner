#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const raw = readFileSync('release-calendar.yml', 'utf-8');
const cfg = YAML.parse(raw);

function inFreeze(now, freeze) {
  if (!freeze) return false;
  for (const f of freeze) {
    const start = new Date(f.start);
    const end = new Date(f.end);
    if (now >= start && now <= end) return true;
  }
  return false;
}

const now = new Date();
const frozen = inFreeze(now, cfg.freeze);
const exception = (process.env.RELEASE_EXCEPTION === 'true');

if (frozen && !exception) {
  console.error(`Release is within freeze window (${now.toISOString()}). Set RELEASE_EXCEPTION=true to override.`);
  process.exit(1);
}
console.log('Calendar check OK');

