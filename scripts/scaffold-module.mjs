#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const name = (process.argv[2] || '').trim();
if (!name || /[^A-Za-z0-9._-]/.test(name)) {
  console.error('Usage: node scripts/scaffold-module.mjs <ModuleName>');
  process.exit(1);
}

const base = join('modules', name);
if (existsSync(base)) {
  console.error(`Module ${name} already exists.`);
  process.exit(1);
}
mkdirSync(base, { recursive: true });

const pkg = JSON.parse(readFileSync('package.json','utf-8'));
const version = pkg.version || '0.1.0';

writeFileSync(join(base, 'index.module.js'), `// modules/${name}/index.module.js\nimport { AppState } from '../core.state/app.state.module.js';\n\nexport default {\n  init(target) {\n    target.innerHTML = \`\n      <h1 class=\\"text-xl font-bold mb-4\\">${name}</h1>\n      <p class=\\"text-gray-600 dark:text-gray-300\\">${name} module scaffolded. User: <strong>\${AppState.currentUser?.fullName || '—'}</strong></p>\n    \`;\n  }\n};\n`);

writeFileSync(join(base, 'module.manifest.json'), JSON.stringify({
  name,
  version,
  type: 'functional',
  entry: 'index.module.js',
  author: 'System',
  description: `${name} module`,
  lastUpdated: new Date().toISOString()
}, null, 2));

writeFileSync(join(base, 'AUDIT.md'), `# Module Audit — ${name}\n\n> Auto-generated. Do not edit manually. Latest first.\n\n`);
writeFileSync(join(base, 'audit.log.json'), '[]\n');

console.log(`Module ${name} scaffolded at ${base}`);

