import express from 'express';
import { authenticator } from 'otplib';
import { z } from 'zod';

import { prisma } from './db.js';
import { hash, compare } from './crypto.js';
import { sign, verifyToken } from './jwt.js';
import { authGuard, ensureDevUser } from './authGuard.js';
import { DEV_BYPASS_AUTH, DEV_BYPASS_EMAIL } from './env.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const totpSetupSchema = z.object({
  userId: z.string().min(1)
});

const totpVerifySchema = z.object({
  userId: z.string().min(1),
  code: z.string().min(6)
});

const inviteSchema = z.object({
  email: z.string().email(),
  roles: z.array(z.string()).default([]),
  claims: z.record(z.any()).optional()
});

const inviteAcceptSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  totp_code: z.string().optional()
});

const router = express.Router();

async function createSession(userId: string) {
  const session = await prisma.session.create({ data: { userId } });
  const token = sign({ sub: userId, sid: session.id });
  return { token, sessionId: session.id };
}

router.post('/register', async (req, res) => {
  if (process.env.NODE_ENV && !['development', 'test'].includes(process.env.NODE_ENV)) {
    res.status(403).json({ ok: false, error: 'Register endpoint only available in development' });
    return;
  }
  const parsed = registerSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Geçersiz alanlar', issues: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(409).json({ ok: false, error: 'Kullanıcı zaten var' });
    return;
  }
  const user = await prisma.user.create({ data: { email, password: await hash(password) } });
  res.status(201).json({ ok: true, user: { id: user.id, email: user.email } });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Geçersiz kimlik bilgileri', issues: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  if (DEV_BYPASS_AUTH && email === DEV_BYPASS_EMAIL) {
    await ensureDevUser();
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ ok: false, error: 'Geçersiz kimlik' });
    return;
  }
  const ok = await compare(password, user.password);
  if (!ok) {
    res.status(401).json({ ok: false, error: 'Geçersiz kimlik' });
    return;
  }
  if (user.mfaEnabled && user.mfaSecret) {
    res.json({ ok: true, mfa_required: true, userId: user.id });
    return;
  }
  const session = await createSession(user.id);
  res.json({ ok: true, token: session.token, userId: user.id });
});

router.post('/totp/setup', authGuard, async (req, res) => {
  const parsed = totpSetupSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Geçersiz istek', issues: parsed.error.flatten() });
    return;
  }
  const { userId } = parsed.data;
  const requester = (req as any).user;
  if (requester.id !== userId) {
    res.status(403).json({ ok: false, error: 'Yalnızca kendi MFA ayarlarınızı düzenleyebilirsiniz' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı' });
    return;
  }
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, 'TAXIPartner', secret);
  await prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });
  res.json({ ok: true, secret, otpauth });
});

router.post('/totp/verify', async (req, res) => {
  const parsed = totpVerifySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Geçersiz istek', issues: parsed.error.flatten() });
    return;
  }
  const { userId, code } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaSecret) {
    res.status(400).json({ ok: false, error: 'Kurulum gerekli' });
    return;
  }
  const valid = authenticator.check(code, user.mfaSecret);
  if (!valid) {
    res.status(400).json({ ok: false, error: 'Kod hatalı' });
    return;
  }
  await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
  const session = await createSession(userId);
  res.json({ ok: true, token: session.token, userId });
});

router.post('/invite', authGuard, async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Geçersiz alanlar', issues: parsed.error.flatten() });
    return;
  }
  const requester = (req as any).user;
  if (!requester.roles?.includes('Superadmin')) {
    res.status(403).json({ ok: false, error: 'Yalnızca Superadmin davet oluşturabilir' });
    return;
  }
  const { email, roles, claims } = parsed.data;
  const inviteToken = sign({ type: 'invite', email, roles, claims }, 60 * 60 * 24 * 7);
  res.json({ ok: true, invite: inviteToken });
});

router.post('/invite/accept', async (req, res) => {
  const parsed = inviteAcceptSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Geçersiz alanlar', issues: parsed.error.flatten() });
    return;
  }
  const { token, password } = parsed.data;
  let payload: any;
  try {
    payload = verifyToken(token);
  } catch (error) {
    res.status(400).json({ ok: false, error: 'Davet geçersiz veya süresi dolmuş' });
    return;
  }
  if (!payload?.email) {
    res.status(400).json({ ok: false, error: 'Davet eksik' });
    return;
  }

  const passwordHash = await hash(password);
  const user = await prisma.user.upsert({
    where: { email: payload.email },
    create: {
      email: payload.email,
      password: passwordHash,
      claimsJson: payload.claims ? JSON.stringify(payload.claims) : null
    },
    update: {
      password: passwordHash,
      claimsJson: payload.claims ? JSON.stringify(payload.claims) : null
    }
  });

  if (Array.isArray(payload.roles) && payload.roles.length > 0) {
    const roles = await prisma.role.findMany({ where: { name: { in: payload.roles } } });
    for (const role of roles) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id }
      });
    }
  }

  res.json({ ok: true, userId: user.id });
});

router.post('/logout', authGuard, async (req, res) => {
  const session = (req as any).session;
  await prisma.session.update({ where: { id: session.id }, data: { revoked: true } });
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      res.status(200).json({ ok: true, authenticated: false });
      return;
    }
    const token = header.slice(7);
    try {
      verifyToken(token);
      res.json({ ok: true, authenticated: true });
    } catch {
      res.json({ ok: true, authenticated: false });
    }
  } catch {
    res.json({ ok: true, authenticated: false });
  }
});

export const authRouter = router;
