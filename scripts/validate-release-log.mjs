#!/usr/bin/env node
import { readFileSync } from 'node:fs';

function die(msg){ console.error(msg); process.exit(1); }
function readJSON(p){ try{ return JSON.parse(readFileSync(p,'utf-8')); }catch(e){ die(`Cannot read ${p}: ${e.message}`);} }

const arr = readJSON('modules/ReleaseManagement/release-log.json') || [];
if (!Array.isArray(arr) || !arr.length) die('release-log.json empty or invalid');

const errors = [];
const required = ['version','date','status','author','description'];
const top = arr[0];
for (const r of arr.slice(0,10)){
  for (const k of required){ if (!(k in r)) errors.push(`Missing ${k} in v${r.version||'?'} `); }
  const d = r.description || {}; if (!d.tr && !d.de && !d.en) errors.push(`Empty description for v${r.version}`);
  if (r.quality && !['auto','edited'].includes(r.quality)) errors.push(`Invalid quality for v${r.version}`);
  if (r.state && !['draft','final'].includes(r.state)) errors.push(`Invalid state for v${r.version}`);
}

if (errors.length){
  console.error('Release log validation failed:');
  errors.forEach(e=>console.error(' -',e));
  process.exit(2);
}

console.log(`Release log ok. Top version v${top.version}`);

