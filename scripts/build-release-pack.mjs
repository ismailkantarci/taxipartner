#!/usr/bin/env node
import { mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';

const outDir = resolve('release-pack');
mkdirSync(outDir, { recursive: true });

function sha256(filePath){
  const buf = readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

function loadJSON(path, fallback){ try { return JSON.parse(readFileSync(path,'utf-8')); } catch { return fallback; } }

const pkg = loadJSON('package.json', {});
const meta = loadJSON('system.meta.json', {});
const version = pkg.version || meta.version || '0.0.0';
const commit = process.env.GITHUB_SHA || loadJSON('.git/ORIG_HEAD','').toString() || 'unknown';

// Copy artefacts (ensure built CSS exists)
if (!existsSync('dist/output.css')) {
  console.warn('dist/output.css not found. Run build first.');
}
if (existsSync('dist/output.css')) {
  copyFileSync('dist/output.css', join(outDir, 'output.css'));
}

// Create MANIFEST.json
const manifest = {
  version,
  commit,
  buildDate: new Date().toISOString(),
  artefacts: readdirSync(outDir)
};
writeFileSync(join(outDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));

// Generate checksums for files in release-pack
let checksums = '';
readdirSync(outDir).forEach(name => {
  if (name === 'checksums.txt') return;
  const p = join(outDir, name);
  const sum = sha256(p);
  checksums += `${sum}  ${name}\n`;
});
writeFileSync(join(outDir, 'checksums.txt'), checksums);

// Build RELEASE_NOTES.md from CHANGELOG or release-log.json
let notes = `# Release Notes v${version}\n\n`;
try {
  const changelog = readFileSync('CHANGELOG.md','utf-8');
  const idx = changelog.indexOf(`## v${version} `);
  if (idx !== -1) {
    const section = changelog.slice(idx);
    const next = section.indexOf('\n## v');
    notes = next !== -1 ? section.slice(0, next) : section;
  } else {
    const log = loadJSON('modules/ReleaseManagement/release-log.json', []);
    const entry = log.find(x => String(x.version) === String(version));
    if (entry) {
      notes += `- Date: ${entry.date || '-'}\n- Status: ${entry.status || '-'}\n- Author: ${entry.author || '-'}\n- ${entry.description || ''}\n`;
    }
  }
} catch {}
writeFileSync(join(outDir, 'RELEASE_NOTES.md'), notes);

console.log('Release package prepared at release-pack/.');

