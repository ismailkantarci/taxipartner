#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'dist', 'output.css');
try {
  if (!fs.existsSync(file)) {
    console.log('[strip-webkit] dist/output.css not found, skip');
    process.exit(0);
  }
  const src = fs.readFileSync(file, 'utf8');
  // Remove any text-size-adjust declarations (vendor or standard) to silence console warnings on some engines.
  let out = src.replace(/-webkit-text-size-adjust:\s*[^;]+;?/g, '');
  out = out.replace(/\btext-size-adjust:\s*[^;]+;?/g, '');
  const changed = out !== src;
  if (changed) {
    fs.writeFileSync(file, out, 'utf8');
    console.log('[strip-webkit] Stripped text-size-adjust declarations');
  } else {
    console.log('[strip-webkit] No occurrences to strip');
  }
} catch (e) {
  console.error('[strip-webkit] Failed:', e?.message || e);
  process.exit(0);
}
