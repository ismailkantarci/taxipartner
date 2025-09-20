#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function sh(cmd) {
  try { return execSync(cmd, { stdio: ['ignore','pipe','ignore'], encoding: 'utf-8' }).trim(); }
  catch { return ''; }
}

function insideGit() {
  try { execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' }); return true; } catch { return false; }
}

function ensureHusky() {
  // Prefer Husky if Node/npm is used
  try {
    if (!existsSync('.husky')) {
      sh('npx husky install');
    }
    // Ensure pre-commit exists and invokes auto-release script
    mkdirSync('.husky', { recursive: true });
    const hookPath = join('.husky', 'pre-commit');
    const desired = `#!/bin/sh\n. "$(dirname "$0")/_/husky.sh"\n\nnode scripts/migrate-release-descriptions.mjs || true\nnode scripts/auto-release-log.mjs || true\n\n# Stage possibly modified files\ngit add package.json system.meta.json modules/**/module.manifest.json modules/ReleaseManagement/release-log.json 2>/dev/null || true\n`;
    try {
      const current = existsSync(hookPath) ? readFileSync(hookPath, 'utf-8') : '';
      if (!current.includes('auto-release-log.mjs')) {
        writeFileSync(hookPath, desired, { encoding: 'utf-8' });
        sh(`chmod +x ${hookPath}`);
      }
    } catch {}
    return true;
  } catch { return false; }
}

function ensureGitHooksFallback() {
  // Configure portable hooks if Husky is not preferred/available
  if (!existsSync('.githooks')) return;
  sh('git config core.hooksPath .githooks');
}

function maybeStartLocalWatch() {
  // Opt-in: start local watch if AUTO_RELEASE_WATCH=1
  if ((process.env.AUTO_RELEASE_WATCH || '').toString() !== '1') return;
  try { sh('bash scripts/local_watch.sh start'); } catch {}
}

function main() {
  const inGit = insideGit();
  if (inGit) {
    const huskyOk = ensureHusky();
    if (!huskyOk) ensureGitHooksFallback();
  } else {
    // No git repository: still allow starting local watcher via env opt-in
    // Tip: run `AUTO_RELEASE_WATCH=1 npm i` to start watcher automatically on install
  }
  // In both cases, honor AUTO_RELEASE_WATCH=1 to start local watcher
  maybeStartLocalWatch();
}

main();
