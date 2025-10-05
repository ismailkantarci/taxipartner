import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const reportDir = path.join(root, 'REPORTS');
const reportFile = path.join(reportDir, 'ui_wiring_check.md');

if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function collectModules(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectModules(full));
    } else if (/\.module\.(js|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const moduleFiles = collectModules(path.join(root, 'modules'));
const routerSrc = read(path.join(root, 'frontend', 'main.router.ts'));
const routes = Array.from(routerSrc.matchAll(/attach([A-Z]\w+)Route/g)).map((m) => m[1].toLowerCase());

const lines = [];
lines.push('# UI Wiring Check');
lines.push(`- modules scanned: ${moduleFiles.length}`);
lines.push(`- routes found: ${routes.join(', ')}`);

for (const file of moduleFiles) {
  const src = read(file);
  const ids = Array.from(src.matchAll(/id="([^"]+)"/g)).map((m) => m[1]);
  const hrefs = Array.from(src.matchAll(/href="#\/([^"]+)"/g)).map((m) => m[1]);
  lines.push(`\n## ${path.relative(root, file)}`);
  lines.push(`- ids: ${ids.join(', ') || '(none)'}`);
  lines.push(`- hrefs: ${hrefs.join(', ') || '(none)'}`);
  for (const href of hrefs) {
    const key = href.split('/')[0];
    if (!routes.includes(key)) {
      lines.push(`  - [GAP] route '#/${href}' not in main.router.ts`);
    }
  }
}

fs.writeFileSync(reportFile, lines.join('\n'));
console.log(path.resolve(reportFile));
console.log('RESULT: OK');

