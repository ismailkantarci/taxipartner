#!/usr/bin/env node
/*
  Audit Log Generator
  - Appends commit metadata to audit/audit.log.json (dedup by commit SHA)
  - Regenerates AUDITLOG.md summary (newest first)
  - Works in CI (uses GITHUB_EVENT_PATH) and locally (uses git)
*/
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8', ...opts }).trim();
}

function readJSON(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

function writeJSON(path, data) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function getCommitsFromEvent() {
  const evPath = process.env.GITHUB_EVENT_PATH;
  if (!evPath || !existsSync(evPath)) return null;
  const payload = readJSON(evPath, null);
  if (!payload) return null;
  // Push event contains commits array; PR events do not include all diffs reliably
  if (payload.commits && Array.isArray(payload.commits) && payload.commits.length) {
    return payload.commits.map((c) => ({
      sha: c.id,
      message: c.message || '',
      authorName: c.author?.name || '',
      authorEmail: c.author?.email || '',
      timestamp: c.timestamp || new Date().toISOString(),
      added: c.added || [],
      modified: c.modified || [],
      removed: c.removed || [],
      ref: process.env.GITHUB_REF || '',
    }));
  }
  return null;
}

function getHeadCommitLocally() {
  const sha = sh('git rev-parse HEAD');
  const message = sh('git log -1 --pretty=%B');
  const authorName = sh('git log -1 --pretty=%an');
  const authorEmail = sh('git log -1 --pretty=%ae');
  const timestamp = sh('git log -1 --pretty=%aI');
  // name-status provides A/M/D + paths
  const ns = sh('git show --name-status --pretty=format: HEAD');
  const added = [], modified = [], removed = [];
  ns.split('\n').forEach((line) => {
    const m = line.match(/^([AMD])\s+(.+)$/);
    if (!m) return;
    const [, t, p] = m;
    if (t === 'A') added.push(p);
    else if (t === 'M') modified.push(p);
    else if (t === 'D') removed.push(p);
  });
  return [{ sha, message, authorName, authorEmail, timestamp, added, modified, removed, ref: sh('git rev-parse --abbrev-ref HEAD') }];
}

function normalizeRecord(r) {
  return {
    sha: r.sha,
    message: r.message.trim(),
    author: { name: r.authorName || r.author?.name || '', email: r.authorEmail || r.author?.email || '' },
    timestamp: r.timestamp || new Date().toISOString(),
    ref: r.ref || '',
    files: {
      added: r.added || [],
      modified: r.modified || [],
      removed: r.removed || [],
    }
  };
}

function toMarkdown(auditArray) {
  const lines = [
    '# Audit Log',
    '',
    '> Auto-generated. Do not edit manually. Latest first.',
    ''
  ];
  auditArray.forEach((rec) => {
    const when = new Date(rec.timestamp).toISOString().replace('T', ' ').replace('Z', ' UTC');
    lines.push(`## ${rec.sha.slice(0,7)} — ${when}`);
    const author = [rec.author?.name, rec.author?.email ? `<${rec.author.email}>` : ''].filter(Boolean).join(' ');
    lines.push(`- Author: ${author || '-'}`);
    lines.push(`- Ref: ${rec.ref || '-'}`);
    lines.push(`- Message: ${rec.message.split('\n')[0] || '-'}`);
    const counts = [
      rec.files.added?.length ? `+${rec.files.added.length}` : null,
      rec.files.modified?.length ? `~${rec.files.modified.length}` : null,
      rec.files.removed?.length ? `-${rec.files.removed.length}` : null,
    ].filter(Boolean).join(' ');
    lines.push(`- Files: ${counts || '0'}`);
    if (rec.files.added?.length) {
      lines.push('  - Added:'); rec.files.added.slice(0, 10).forEach(f => lines.push(`    - ${f}`));
      if (rec.files.added.length > 10) lines.push(`    - … ${rec.files.added.length - 10} more`);
    }
    if (rec.files.modified?.length) {
      lines.push('  - Modified:'); rec.files.modified.slice(0, 10).forEach(f => lines.push(`    - ${f}`));
      if (rec.files.modified.length > 10) lines.push(`    - … ${rec.files.modified.length - 10} more`);
    }
    if (rec.files.removed?.length) {
      lines.push('  - Removed:'); rec.files.removed.slice(0, 10).forEach(f => lines.push(`    - ${f}`));
      if (rec.files.removed.length > 10) lines.push(`    - … ${rec.files.removed.length - 10} more`);
    }
    lines.push('');
  });
  return lines.join('\n') + '\n';
}

function main() {
  const commits = getCommitsFromEvent() || getHeadCommitLocally();
  if (!commits || !commits.length) return;
  const records = commits.map(normalizeRecord);

  const auditPath = resolve('audit/audit.log.json');
  const existing = readJSON(auditPath, []);
  const seen = new Set(existing.map(r => r.sha));
  const merged = [...existing];
  records.forEach(r => { if (!seen.has(r.sha)) { merged.push(r); seen.add(r.sha); } });
  // newest first in MD; keep JSON as append-only by time
  writeJSON(auditPath, merged);

  const md = toMarkdown([...merged].sort((a, b) => (new Date(b.timestamp)) - (new Date(a.timestamp))));
  writeFileSync(resolve('AUDITLOG.md'), md);
  console.log(`Audit updated. Total records: ${merged.length}`);

  // Per-module audit: group file changes under modules/<Name>/
  const moduleChanges = new Map(); // name -> array of partial records
  for (const rec of records) {
    const all = [
      ...rec.files.added.map(p => ({ p, t: 'added' })),
      ...rec.files.modified.map(p => ({ p, t: 'modified' })),
      ...rec.files.removed.map(p => ({ p, t: 'removed' })),
    ];
    for (const { p, t } of all) {
      const m = p.match(/^modules\/([^\/]+)\/(.+)$/);
      if (!m) continue;
      const mod = m[1];
      const rel = m[2];
      if (!moduleChanges.has(mod)) moduleChanges.set(mod, []);
      moduleChanges.get(mod).push({ t, path: rel });
    }
  }

  // Apply per-module logs and bump lastUpdated in manifest
  for (const [mod, changes] of moduleChanges.entries()) {
    const base = resolve('modules', mod);
    const pathJson = resolve(base, 'audit.log.json');
    const pathMd = resolve(base, 'AUDIT.md');
    const manifestPath = resolve(base, 'module.manifest.json');

    const current = readJSON(pathJson, []);
    const seenSha = new Set(current.map(r => r.sha));

    // Merge records relevant to this module: aggregate by commit sha
    for (const rec of records) {
      if (seenSha.has(rec.sha)) continue;
      const files = { added: [], modified: [], removed: [] };
      for (const { t, path } of changes) {
        // Only include files from this commit
        const inRec = (
          (t === 'added' && rec.files.added.includes(`modules/${mod}/${path}`)) ||
          (t === 'modified' && rec.files.modified.includes(`modules/${mod}/${path}`)) ||
          (t === 'removed' && rec.files.removed.includes(`modules/${mod}/${path}`))
        );
        if (!inRec) continue;
        files[t].push(path);
      }
      const total = files.added.length + files.modified.length + files.removed.length;
      if (!total) continue;
      current.push({
        sha: rec.sha,
        message: rec.message.split('\n')[0],
        author: rec.author,
        timestamp: rec.timestamp,
        ref: rec.ref,
        files,
      });
      seenSha.add(rec.sha);
    }

    // Write per-module json
    writeJSON(pathJson, current);

    // Write per-module markdown (newest first)
    const mdLines = [
      `# Module Audit — ${mod}`,
      '',
      '> Auto-generated. Do not edit manually. Latest first.',
      ''
    ];
    [...current].sort((a, b) => (new Date(b.timestamp)) - (new Date(a.timestamp))).forEach((r) => {
      const when = new Date(r.timestamp).toISOString().replace('T', ' ').replace('Z', ' UTC');
      mdLines.push(`## ${r.sha.slice(0,7)} — ${when}`);
      mdLines.push(`- Message: ${r.message || '-'}`);
      const counts = [
        r.files.added?.length ? `+${r.files.added.length}` : null,
        r.files.modified?.length ? `~${r.files.modified.length}` : null,
        r.files.removed?.length ? `-${r.files.removed.length}` : null,
      ].filter(Boolean).join(' ');
      mdLines.push(`- Files: ${counts || '0'}`);
      ['added','modified','removed'].forEach(k => {
        const label = k.charAt(0).toUpperCase()+k.slice(1);
        if (r.files[k]?.length) {
          mdLines.push(`  - ${label}:`);
          r.files[k].slice(0, 10).forEach(f => mdLines.push(`    - ${f}`));
          if (r.files[k].length > 10) mdLines.push(`    - … ${r.files[k].length - 10} more`);
        }
      });
      mdLines.push('');
    });
    writeFileSync(pathMd, mdLines.join('\n'));

    // Update manifest lastUpdated if exists
    try {
      const man = readJSON(manifestPath, null);
      if (man) {
        man.lastUpdated = new Date().toISOString();
        writeJSON(manifestPath, man);
      }
    } catch {}
  }
}

main();
