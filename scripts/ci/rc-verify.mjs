#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });

const killProcess = proc => {
  if (!proc || proc.killed) return;
  try {
    proc.kill('SIGTERM');
  } catch {}
};

(async () => {
  try {
    await run('npm', ['run', 'verify']);
    await run('npm', ['run', 'build']);
    await run('npx', ['playwright', 'install', '--with-deps']);

    const server = spawn('npx', ['--yes', 'http-server', 'dist', '-p', '4173', '-c-1'], {
      stdio: 'inherit'
    });

    const cleanup = () => killProcess(server);
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(1);
    });

    await sleep(2500);

    await run('npx', [
      '--yes',
      'lighthouse',
      'http://127.0.0.1:4173',
      '--only-categories=performance,accessibility,best-practices,seo',
      '--quiet',
      '--chrome-flags=--headless=new',
      '--output',
      'json',
      '--output-path',
      'docs/lighthouse/ci-report.json'
    ]);

    await run('npm', ['run', 'verify:e2e']);

    cleanup();
  } catch (error) {
    console.error('[rc-verify] hata:', error?.message ?? error);
    process.exit(1);
  }
})();
