import fs from 'fs';
import { globSync } from 'glob';

const seeds = JSON.parse(fs.readFileSync('identity/seeds/seed_role_permissions.json','utf8'));
const allowed = new Set(seeds.templates.flatMap(t => t.allow));
const files = globSync('identity/src/**/*.ts');
const hits = new Map();

for (const file of files) {
  const text = fs.readFileSync(file,'utf8');
  const matches = text.matchAll(/\btp\.[a-zA-Z0-9_.:-]+/g);
  for (const m of matches) {
    const key = m[0];
    if (!hits.has(key)) hits.set(key, []);
    hits.get(key).push(file);
  }
}

const missing = [];
for (const [key, locs] of hits) {
  if (!allowed.has(key)) missing.push({ key, locs: Array.from(new Set(locs)) });
}

console.log('# Missing/undefined permission references (best-effort)');
missing.forEach(m => {
  console.log('-', m.key, '→', m.locs.join(', '));
});
