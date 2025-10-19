process.env.NODE_ENV = 'test';
const dbUrl = new URL('../../prisma/auth-test.db', import.meta.url);
process.env.DATABASE_URL = dbUrl.href;
process.env.DEV_BYPASS_AUTH = 'false';

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { authenticator } from 'otplib';

const { prisma } = await import('../src/db.ts');
const { app } = await import('../src/server.ts');

let server;
let baseUrl;

async function resetDatabase() {
  await prisma.approval.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
}

async function post(path, body, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  return { status: res.status, json: await res.json() };
}

async function get(path, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return { status: res.status, json: await res.json() };
}

before(async () => {
  await resetDatabase();
  await prisma.role.create({
    data: {
      name: 'Superadmin',
      scope: 'global',
      isSystem: true
    }
  });
  await prisma.role.create({ data: { name: 'Standard User', scope: 'global' } });

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await prisma.$disconnect();
});

test('register → login → TOTP → protected call', async () => {
  const email = 'user@test.local';
  const password = 'Passw0rd!';

  const register = await post('/auth/register', { email, password });
  assert.equal(register.status, 201);
  assert.equal(register.json.ok, true);
  const userId = register.json.user.id;

  const login = await post('/auth/login', { email, password });
  assert.equal(login.status, 200);
  assert.equal(login.json.ok, true);
  assert.ok(login.json.token);

  const setup = await post('/auth/totp/setup', { userId }, login.json.token);
  assert.equal(setup.status, 200);
  assert.equal(setup.json.ok, true);
  assert.ok(setup.json.secret);
  const secret = setup.json.secret;

  const code = authenticator.generate(secret);
  const verify = await post('/auth/totp/verify', { userId, code });
  assert.equal(verify.status, 200);
  assert.equal(verify.json.ok, true);
  assert.ok(verify.json.token);

  const loginMfa = await post('/auth/login', { email, password });
  assert.equal(loginMfa.status, 200);
  assert.equal(loginMfa.json.ok, true);
  assert.equal(loginMfa.json.mfa_required, true);
  assert.equal(loginMfa.json.userId, userId);

  const code2 = authenticator.generate(secret);
  const verify2 = await post('/auth/totp/verify', { userId, code: code2 });
  assert.equal(verify2.status, 200);
  assert.ok(verify2.json.token);

  const approvals = await get('/approval/list', verify2.json.token);
  assert.equal(approvals.status, 200);
  assert.equal(approvals.json.ok, true);
  assert(Array.isArray(approvals.json.approvals));
});
