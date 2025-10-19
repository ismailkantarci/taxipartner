import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const PORT = 3456;
let child: ChildProcess | null = null;

type JsonRequestInit = RequestInit & { headers?: Record<string, string> };

async function req(path: string, init: JsonRequestInit = {}) {
  const url = `http://127.0.0.1:${PORT}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

before(async () => {
  child = spawn(process.execPath, ['identity/src/server.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      JWT_SECRET: 'test-secret',
      EXPORT_SIGN_SECRET: 'test-export',
      DEV_BYPASS_AUTH: 'false',
      DEV_CORS_ORIGINS: 'http://localhost:5173 http://localhost:5174',
      DISABLE_SCHEDULER: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let ready = false;
  for (let attempts = 0; attempts < 40 && !ready; attempts++) {
    try {
      const { json } = await req('/health');
      ready = Boolean(json?.ok);
      if (ready) break;
    } catch {}
    await wait(250);
  }
  if (!ready) throw new Error('identity server did not start');
});

after(() => {
  try {
    if (child) {
      child.kill('SIGINT');
    }
  } catch {}
});

test('health responds ok', async () => {
  const { status, json } = await req('/health');
  assert.equal(status, 200);
  assert.ok(json?.ok);
});

test('task creation, manual run, unread count and mark-all', async () => {
  const create = await req('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      name: 'ITEST Task',
      description: 'integration test',
      cron: '*/5 * * * *',
      isEnabled: true,
      channels: { inapp: true },
      payload: { subject: 'Hello', body: 'From tests' }
    })
  });
  assert.equal(create.status, 201);
  assert.ok(create.json?.task?.id);
  const id = create.json.task.id;

  const run = await req(`/tasks/${id}/run`, { method: 'POST' });
  assert.equal(run.status, 200);
  assert.ok(run.json?.ok);

  const unread1 = await req('/notifications/unread/count');
  assert.equal(unread1.status, 200);
  assert.ok(unread1.json?.ok);
  assert.equal(typeof unread1.json.count, 'number');

  const mark = await req('/notifications/unread/mark-all', { method: 'POST', body: '{}' });
  assert.equal(mark.status, 200);
  assert.ok(mark.json?.ok);

  const unread2 = await req('/notifications/unread/count');
  assert.equal(unread2.status, 200);
  assert.ok(unread2.json?.ok);
  assert.equal(unread2.json.count, 0);
});

test('manual run with invalid payload returns Turkish JSON error', async () => {
  const create = await req('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      name: 'ITEST Invalid JSON',
      description: 'invalid payload',
      cron: '*/5 * * * *',
      isEnabled: true,
      channels: { inapp: true },
      payload: { subject: 'x', body: 'y' }
    })
  });
  assert.equal(create.status, 201);
  const id = create.json.task.id;

  const mutate = await req(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ payload: 'not-json' })
  });
  assert.equal(mutate.status, 200);

  const run = await req(`/tasks/${id}/run`, { method: 'POST' });
  assert.equal(run.status, 400);
  const msg = run.json?.error || '';
  assert.ok(msg.includes('payload alanı geçerli JSON değil') || msg.includes('payload'));
});
