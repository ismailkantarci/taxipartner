#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

function sha256File(path){
  const buf = readFileSync(path);
  return createHash('sha256').update(buf).digest('hex');
}

const version = JSON.parse(readFileSync('package.json','utf-8')).version;
const commit = process.env.GITHUB_SHA || 'unknown';
const runner = {
  os: process.env.RUNNER_OS || 'local',
  arch: process.env.RUNNER_ARCH || '',
};

const artefacts = readdirSync('release-pack').filter(n => n !== 'provenance.json');
const materials = artefacts.map(n => ({ name: n, sha256: sha256File(join('release-pack', n)) }));

const provenance = {
  _type: 'https://slsa.dev/provenance/v0.2',
  buildType: 'scripted',
  version,
  commit,
  runner,
  materials,
  timestamp: new Date().toISOString()
};

writeFileSync('release-pack/provenance.json', JSON.stringify(provenance, null, 2));
console.log('Provenance written to release-pack/provenance.json');

