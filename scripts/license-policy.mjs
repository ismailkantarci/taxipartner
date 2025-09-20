#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';

const reportPath = 'release-pack/licenses.json';
if (!existsSync(reportPath)) {
  console.error('licenses.json not found. Run npm run license:report first.');
  process.exit(1);
}
const data = JSON.parse(readFileSync(reportPath, 'utf-8'));
const denyFile = 'license-denylist.txt';
const allowFile = 'license-allowlist.txt';
const deny = existsSync(denyFile) ? readFileSync(denyFile, 'utf-8').split(/\r?\n/).filter(Boolean) : [];
const allow = existsSync(allowFile) ? readFileSync(allowFile, 'utf-8').split(/\r?\n/).filter(Boolean) : [];

let violations = [];
for (const [pkg, meta] of Object.entries(data)) {
  const lic = (meta.licenses || meta.license || '').toString();
  if (deny.length && deny.some(d => lic.includes(d))) {
    violations.push({ pkg, license: lic, reason: 'denylist' });
    continue;
  }
  if (allow.length && !allow.some(a => lic.includes(a))) {
    violations.push({ pkg, license: lic, reason: 'not-allowed' });
  }
}

if (violations.length) {
  console.error('License policy violations found:');
  for (const v of violations) console.error(`- ${v.pkg}: ${v.license} (${v.reason})`);
  process.exit(1);
}
console.log('License policy OK');

